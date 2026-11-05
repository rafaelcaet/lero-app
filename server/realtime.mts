/**
 * Tempo real do escritório: posições, cadeiras, chat por mesa, DMs e sinalização
 * WebRTC. Áudio/vídeo não passam por aqui (vão P2P entre os navegadores).
 * Montado no mesmo servidor HTTP do Next (veja server/main.mts), no caminho /ws.
 */
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from "../src/game/constants.ts";
import { createOfficeLayout } from "../src/game/maps/officeLayout.ts";
import { computeSeats, type Seat } from "../src/game/maps/seats.ts";
import {
  LIMITS,
  type ClientMessage,
  type Facing,
  type PlayerState,
  type ServerMessage,
} from "../src/shared/protocol.ts";
import { sanitizeAppearance } from "../src/shared/appearance.ts";
import {
  COIN_INTERVAL_MS,
  COINS_PER_INTERVAL,
  isRideKind,
  isShopItemId,
  PET_KINDS,
  RENTAL_DURATION_MS,
  RENTAL_MAX_MS,
  SHOP_ITEM_BY_ID,
} from "../src/shared/shop.ts";
import { gearOf, isWalletKey, publicWallet, WalletStore, type StoredWallet } from "./wallets.mts";

/** Mensagens por segundo aceitas de cada conexão (acima disso, descarta). */
const MAX_MESSAGES_PER_SECOND = 60;
const WORLD_W = MAP_WIDTH * TILE_SIZE;
const WORLD_H = MAP_HEIGHT * TILE_SIZE;
const FACINGS: ReadonlySet<string> = new Set<Facing>(["down", "left", "right", "up"]);

const seats = new Map<string, Seat>(computeSeats(createOfficeLayout()).map((s) => [s.id, s]));
/** seatId → playerId */
const occupancy = new Map<string, string>();

interface Client {
  ws: WebSocket;
  alive: boolean;
  /** Janela simples de rate limit. */
  windowStart: number;
  windowCount: number;
  state: PlayerState | null; // null até o "join"
  wallet: StoredWallet | null; // idem
}
const clients = new Map<string, Client>();

// --- envio ---------------------------------------------------------------

function send(client: Client, msg: ServerMessage) {
  if (client.ws.readyState === WebSocket.OPEN) client.ws.send(JSON.stringify(msg));
}

function broadcast(msg: ServerMessage, exceptId?: string) {
  for (const [id, c] of clients) if (id !== exceptId && c.state) send(c, msg);
}

function tableOf(state: PlayerState | null): string | null {
  return state?.seatId ? (seats.get(state.seatId)?.tableId ?? null) : null;
}

// --- validação -----------------------------------------------------------

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function parse(raw: string): ClientMessage | null {
  try {
    const msg = JSON.parse(raw);
    return msg && typeof msg.type === "string" ? (msg as ClientMessage) : null;
  } catch {
    return null;
  }
}

// --- Lerocoins e loja ----------------------------------------------------

let wallets = new WalletStore("");

function clientsOfWallet(wallet: StoredWallet): Client[] {
  return [...clients.values()].filter((c) => c.state && c.wallet === wallet);
}

/** Envia a carteira aos clientes dela e avisa todos se o veículo/mascote mudou. */
function walletChanged(wallet: StoredWallet, now = Date.now()) {
  wallets.markDirty();
  const gear = gearOf(wallet, now);
  for (const c of clientsOfWallet(wallet)) {
    send(c, { type: "wallet", wallet: publicWallet(wallet), serverNow: now });
    const state = c.state!;
    if (state.ride !== gear.ride || state.pet !== gear.pet) {
      state.ride = gear.ride;
      state.pet = gear.pet;
      broadcast({ type: "player-gear", id: state.id, ...gear });
    }
  }
}

/** Uma vez por segundo: credita moedas por tempo online e encerra aluguéis vencidos. */
function walletTick() {
  const now = Date.now();
  const online = new Set<StoredWallet>();
  for (const c of clients.values()) if (c.state && c.wallet) online.add(c.wallet);

  for (const wallet of online) {
    let changed = false;
    const intervals = Math.floor((now - wallet.lastAwardAt) / COIN_INTERVAL_MS);
    if (intervals > 0) {
      wallet.coins += intervals * COINS_PER_INTERVAL;
      wallet.lastAwardAt += intervals * COIN_INTERVAL_MS;
      changed = true;
    }
    const before = wallet.rentals.length;
    wallet.rentals = wallet.rentals.filter((r) => r.expiresAt > now);
    if (wallet.rentals.length !== before) {
      if (wallet.ride && !wallet.rentals.some((r) => r.item === wallet.ride)) wallet.ride = null;
      changed = true;
    }
    if (changed) walletChanged(wallet, now);
  }
}

function handleRent(client: Client, wallet: StoredWallet, itemId: unknown) {
  const item = isShopItemId(itemId) ? SHOP_ITEM_BY_ID.get(itemId) : undefined;
  if (!item) return;
  if (wallet.coins < item.price) return send(client, { type: "rent-rejected", item: item.id, reason: "no-coins" });

  const now = Date.now();
  const current = wallet.rentals.find((r) => r.item === item.id && r.expiresAt > now);
  if (current) {
    // Já alugado: soma mais uma hora (mantém o mesmo mascote).
    if (current.expiresAt - now + RENTAL_DURATION_MS > RENTAL_MAX_MS) {
      return send(client, { type: "rent-rejected", item: item.id, reason: "max-time" });
    }
    current.expiresAt += RENTAL_DURATION_MS;
  } else {
    wallet.rentals = wallet.rentals.filter((r) => r.item !== item.id);
    wallet.rentals.push({
      item: item.id,
      expiresAt: now + RENTAL_DURATION_MS,
      ...(item.id === "pet" ? { pet: PET_KINDS[Math.floor(Math.random() * PET_KINDS.length)] } : {}),
    });
    // Veículo novo já sai andando nele.
    if (isRideKind(item.id)) wallet.ride = item.id;
  }
  wallet.coins -= item.price;
  walletChanged(wallet, now);
}

function handleEquip(wallet: StoredWallet, ride: unknown) {
  const now = Date.now();
  const next = isRideKind(ride) && wallet.rentals.some((r) => r.item === ride && r.expiresAt > now) ? ride : null;
  if (next === wallet.ride) return;
  wallet.ride = next;
  walletChanged(wallet, now);
}

// --- regras --------------------------------------------------------------

function freeSeat(state: PlayerState) {
  if (state.seatId && occupancy.get(state.seatId) === state.id) occupancy.delete(state.seatId);
  state.seatId = null;
}

function handleSit(client: Client, state: PlayerState, seatId: string) {
  const seat = seats.get(seatId);
  if (!seat) return send(client, { type: "sit-rejected", seatId, reason: "unknown-seat" });

  const occupant = occupancy.get(seatId);
  if (occupant && occupant !== state.id) {
    return send(client, { type: "sit-rejected", seatId, reason: "occupied" });
  }
  if (Math.hypot(seat.x - state.x, seat.y - state.y) > LIMITS.sitDistance) {
    return send(client, { type: "sit-rejected", seatId, reason: "too-far" });
  }

  freeSeat(state);
  occupancy.set(seatId, state.id);
  state.seatId = seatId;
  state.anim = "idle";
  state.facing = seat.facing;
  broadcast({ type: "player-seated", id: state.id, seatId });
}

function handleStand(state: PlayerState) {
  if (!state.seatId) return;
  freeSeat(state);
  broadcast({ type: "player-seated", id: state.id, seatId: null });
}

function handleMessage(id: string, client: Client, msg: ClientMessage) {
  if (msg.type === "join") {
    if (client.state) return;
    const name = String(msg.name ?? "").trim().slice(0, LIMITS.nameLength) || "Visitante";
    const wallet = wallets.get(isWalletKey(msg.walletKey) ? msg.walletKey : randomUUID());
    const now = Date.now();
    // Começa a contar o tempo agora (a menos que a mesma carteira já esteja online em outra aba).
    if (clientsOfWallet(wallet).length === 0) wallet.lastAwardAt = now;
    client.wallet = wallet;
    const gear = gearOf(wallet, now);
    client.state = {
      id,
      name,
      appearance: sanitizeAppearance(msg.appearance),
      x: isNum(msg.x) ? clamp(msg.x, 0, WORLD_W) : WORLD_W / 2,
      y: isNum(msg.y) ? clamp(msg.y, 0, WORLD_H) : WORLD_H / 2,
      facing: "down",
      anim: "idle",
      seatId: null,
      media: { mic: false, cam: false },
      ...gear,
    };
    const players = [...clients.values()].flatMap((c) => (c.state ? [c.state] : []));
    send(client, { type: "welcome", selfId: id, players, iceServers });
    send(client, { type: "wallet", wallet: publicWallet(wallet), serverNow: now });
    broadcast({ type: "player-joined", player: client.state }, id);
    return;
  }

  const state = client.state;
  const wallet = client.wallet;
  if (!state || !wallet) return;

  switch (msg.type) {
    case "move": {
      if (!isNum(msg.x) || !isNum(msg.y) || !FACINGS.has(msg.facing)) return;
      if (state.seatId) return; // sentado não anda; precisa levantar antes
      state.x = clamp(msg.x, 0, WORLD_W);
      state.y = clamp(msg.y, 0, WORLD_H);
      state.facing = msg.facing;
      state.anim = msg.anim === "walk" ? "walk" : "idle";
      broadcast(
        { type: "player-moved", id, x: state.x, y: state.y, facing: state.facing, anim: state.anim },
        id,
      );
      return;
    }
    case "rent":
      return handleRent(client, wallet, msg.item);
    case "equip":
      return handleEquip(wallet, msg.ride);
    case "sit":
      return handleSit(client, state, String(msg.seatId));
    case "stand":
      return handleStand(state);
    case "media": {
      state.media = { mic: Boolean(msg.media?.mic), cam: Boolean(msg.media?.cam) };
      broadcast({ type: "player-media", id, media: state.media }, id);
      return;
    }
    case "chat": {
      const tableId = tableOf(state);
      const text = String(msg.text ?? "").trim().slice(0, LIMITS.chatLength);
      if (!tableId || !text) return;
      const message = {
        id: randomUUID(),
        tableId,
        fromId: id,
        fromName: state.name,
        text,
        ts: Date.now(),
      };
      for (const c of clients.values()) {
        if (tableOf(c.state) === tableId) send(c, { type: "chat", message });
      }
      return;
    }
    case "dm": {
      const target = clients.get(String(msg.to));
      const text = String(msg.text ?? "").trim().slice(0, LIMITS.dmLength);
      if (!target?.state || target === client || !text) return;
      const message = {
        id: randomUUID(),
        fromId: id,
        fromName: state.name,
        toId: String(msg.to),
        text,
        ts: Date.now(),
      };
      send(target, { type: "dm", message });
      send(client, { type: "dm", message });
      return;
    }
    case "signal": {
      // Só repassa entre pessoas sentadas na mesma mesa.
      const target = clients.get(String(msg.to));
      const tableId = tableOf(state);
      if (!target || !tableId || tableOf(target.state) !== tableId) return;
      send(target, { type: "signal", from: id, data: msg.data });
      return;
    }
  }
}

// --- conexão -------------------------------------------------------------

function allowMessage(client: Client): boolean {
  const now = Date.now();
  if (now - client.windowStart >= 1000) {
    client.windowStart = now;
    client.windowCount = 0;
  }
  return ++client.windowCount <= MAX_MESSAGES_PER_SECOND;
}

let iceServers: RTCIceServer[] = [];

export interface RealtimeOptions {
  /** Servidores STUN/TURN enviados aos clientes (ex.: TURN para redes restritas). */
  iceServers: RTCIceServer[];
  /** Origens permitidas para o WebSocket. Vazio = qualquer origem. */
  allowedOrigins: string[];
  /** Arquivo JSON onde as carteiras são salvas. Vazio = só em memória. */
  walletsFile: string;
}

export interface RealtimeServer {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
  close(): Promise<void>;
}

export function createRealtimeServer(options: RealtimeOptions): RealtimeServer {
  iceServers = options.iceServers;
  wallets = new WalletStore(options.walletsFile);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  wss.on("connection", (ws) => {
    const id = randomUUID().slice(0, 8);
    const client: Client = { ws, alive: true, windowStart: Date.now(), windowCount: 0, state: null, wallet: null };
    clients.set(id, client);

    ws.on("pong", () => (client.alive = true));
    ws.on("message", (raw) => {
      if (!allowMessage(client)) return;
      const msg = parse(raw.toString());
      if (msg) handleMessage(id, client, msg);
    });
    ws.on("close", () => {
      clients.delete(id);
      if (client.state) {
        freeSeat(client.state);
        broadcast({ type: "player-left", id });
      }
    });
  });

  // Derruba conexões mortas (ex.: aba fechada ou rede caiu sem "close").
  const heartbeat = setInterval(() => {
    for (const c of clients.values()) {
      if (!c.alive) {
        c.ws.terminate();
        continue;
      }
      c.alive = false;
      c.ws.ping();
    }
  }, 15_000);
  const coinTimer = setInterval(walletTick, 1000);

  return {
    handleUpgrade(req, socket, head) {
      const origin = req.headers.origin ?? "";
      if (options.allowedOrigins.length > 0 && !options.allowedOrigins.includes(origin)) {
        console.warn(`[realtime] origem recusada: "${origin}" (permitidas: ${options.allowedOrigins.join(", ")})`);
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    },
    close() {
      clearInterval(heartbeat);
      clearInterval(coinTimer);
      wallets.close();
      for (const c of clients.values()) c.ws.terminate();
      return new Promise((resolve) => wss.close(() => resolve()));
    },
  };
}

export const SEAT_COUNT = seats.size;
