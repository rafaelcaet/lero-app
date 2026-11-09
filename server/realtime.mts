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
import { isActivity } from "../src/shared/activities.ts";
import { BUBBLE_COOLDOWN_MS, sanitizeBubble } from "../src/shared/bubbles.ts";
import { sanitizeAppearance } from "../src/shared/appearance.ts";
import {
  COIN_INTERVAL_MS,
  COINS_PER_INTERVAL,
  hasItem,
  isCostumeId,
  isPetKind,
  isRideKind,
  isShopItemId,
  ownsItem,
  PET_KINDS,
  RENTAL_DURATION_MS,
  RENTAL_MAX_MS,
  SHOP_ITEM_BY_ID,
  type OwnedItem,
  type PetKind,
} from "../src/shared/shop.ts";
import { MemoryStore, type Store } from "./db/store.mts";
import { gearOf, isWalletKey, publicWallet, WalletStore, type StoredWallet } from "./wallets.mts";

/** Mensagens por segundo aceitas de cada conexão (acima disso, descarta). */
const MAX_MESSAGES_PER_SECOND = 60;
const WORLD_W = MAP_WIDTH * TILE_SIZE;
const WORLD_H = MAP_HEIGHT * TILE_SIZE;
const FACINGS: ReadonlySet<string> = new Set<Facing>(["down", "left", "right", "up"]);
/** Quantas mensagens antigas da mesa são enviadas ao sentar. */
const CHAT_HISTORY_LIMIT = 50;

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
  /** Carregando a carteira do banco (entre o "join" e o "welcome"). */
  joining: boolean;
  /** Sessão aberta no banco e quando começou. */
  sessionId: Promise<string> | null;
  connectedAt: number;
  /** Último balão de fala aceito (anti-spam). */
  lastBubbleAt: number;
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

// --- persistência -------------------------------------------------------

let store: Store = new MemoryStore();
let wallets = new WalletStore(store);

/** Gravação que não bloqueia o jogo: se falhar, só registra no log. */
function persist(label: string, task: Promise<unknown>) {
  task.catch((err) => console.warn(`[db] falha ao salvar ${label}:`, err));
}

/** Id de conexão atual de cada chave online (para mensagens antigas apontarem para quem está aqui). */
function onlineIdsByKey(): Map<string, string> {
  const ids = new Map<string, string>();
  for (const [id, c] of clients) if (c.state && c.wallet) ids.set(c.wallet.key, id);
  return ids;
}

async function sendChatHistory(id: string, client: Client, tableId: string) {
  try {
    const history = await store.recentChat(tableId, CHAT_HISTORY_LIMIT);
    if (clients.get(id) !== client || tableOf(client.state) !== tableId) return; // saiu da mesa enquanto carregava
    const ids = onlineIdsByKey();
    if (client.wallet) ids.set(client.wallet.key, id);
    const messages = history.map(({ playerKey, ...m }) => ({ ...m, fromId: ids.get(playerKey) ?? m.fromId }));
    send(client, { type: "chat-history", tableId, messages });
  } catch (err) {
    console.warn(`[db] falha ao carregar o chat da mesa ${tableId}:`, err);
  }
}

// --- Lerocoins e loja ----------------------------------------------------

function clientsOfWallet(wallet: StoredWallet): Client[] {
  return [...clients.values()].filter((c) => c.state && c.wallet === wallet);
}

/** Envia a carteira aos clientes dela e avisa todos se o veículo, mascote ou fantasia mudou. */
function walletChanged(wallet: StoredWallet, now = Date.now()) {
  wallets.markDirty(wallet);
  const gear = gearOf(wallet, now);
  for (const c of clientsOfWallet(wallet)) {
    send(c, { type: "wallet", wallet: publicWallet(wallet), serverNow: now });
    const state = c.state!;
    if (state.ride !== gear.ride || state.pet !== gear.pet || state.costume !== gear.costume) {
      state.ride = gear.ride;
      state.pet = gear.pet;
      state.costume = gear.costume;
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
      // Aluguel acabou: desce do veículo / tira a fantasia, a menos que sejam comprados.
      if (wallet.ride && !hasItem(wallet, wallet.ride, now)) wallet.ride = null;
      if (wallet.costume && !hasItem(wallet, wallet.costume, now)) wallet.costume = null;
      changed = true;
    }
    if (changed) walletChanged(wallet, now);
  }
}

function handleRent(client: Client, wallet: StoredWallet, itemId: unknown) {
  const item = isShopItemId(itemId) ? SHOP_ITEM_BY_ID.get(itemId) : undefined;
  if (!item) return;
  if (ownsItem(wallet, item.id)) return send(client, { type: "rent-rejected", item: item.id, reason: "owned" });
  if (wallet.coins < item.price) return send(client, { type: "rent-rejected", item: item.id, reason: "no-coins" });

  const now = Date.now();
  let rental = wallet.rentals.find((r) => r.item === item.id && r.expiresAt > now);
  const kind = rental ? "extend" : "new";
  if (rental) {
    // Já alugado: soma mais uma hora (mantém o mesmo mascote).
    if (rental.expiresAt - now + RENTAL_DURATION_MS > RENTAL_MAX_MS) {
      return send(client, { type: "rent-rejected", item: item.id, reason: "max-time" });
    }
    rental.expiresAt += RENTAL_DURATION_MS;
  } else {
    wallet.rentals = wallet.rentals.filter((r) => r.item !== item.id);
    rental = {
      item: item.id,
      expiresAt: now + RENTAL_DURATION_MS,
      ...(item.id === "pet" ? { pet: PET_KINDS[Math.floor(Math.random() * PET_KINDS.length)] } : {}),
    };
    wallet.rentals.push(rental);
    // Veículo novo já sai andando nele; fantasia nova já sai vestida.
    if (isRideKind(item.id)) wallet.ride = item.id;
    if (isCostumeId(item.id)) wallet.costume = item.id;
  }
  wallet.coins -= item.price;
  walletChanged(wallet, now);
  // A carteira é gravada logo, para a compra não se perder se o servidor cair.
  persist("carteira", wallets.flush());
  persist(
    "compra",
    store.recordPurchase({
      playerKey: wallet.key,
      item: item.id,
      pet: rental.pet ?? null,
      price: item.price,
      kind,
      expiresAt: rental.expiresAt,
      coinsAfter: wallet.coins,
    }),
  );
}

/** Compra definitiva: o item fica com o jogador para sempre. O mascote é escolhido, não sorteado. */
function handleBuy(client: Client, wallet: StoredWallet, itemId: unknown, petKind: unknown) {
  const item = isShopItemId(itemId) ? SHOP_ITEM_BY_ID.get(itemId) : undefined;
  if (!item) return;
  if (item.id === "pet" && !isPetKind(petKind)) return;
  if (ownsItem(wallet, item.id)) return send(client, { type: "buy-rejected", item: item.id, reason: "owned" });
  if (wallet.coins < item.buyPrice) return send(client, { type: "buy-rejected", item: item.id, reason: "no-coins" });

  const now = Date.now();
  const owned: OwnedItem = item.id === "pet" ? { item: "pet", pet: petKind as PetKind } : { item: item.id };
  wallet.owned.push(owned);
  // Um aluguel ativo do mesmo item perde o sentido (o tempo restante não é devolvido).
  wallet.rentals = wallet.rentals.filter((r) => r.item !== item.id);
  // Veículo novo já sai andando nele; fantasia nova já sai vestida.
  if (isRideKind(item.id)) wallet.ride = item.id;
  if (isCostumeId(item.id)) wallet.costume = item.id;
  wallet.coins -= item.buyPrice;
  walletChanged(wallet, now);
  persist("carteira", wallets.flush());
  persist(
    "compra",
    store.recordPurchase({
      playerKey: wallet.key,
      item: item.id,
      pet: owned.pet ?? null,
      price: item.buyPrice,
      kind: "buy",
      expiresAt: null,
      coinsAfter: wallet.coins,
    }),
  );
}

function handleEquip(wallet: StoredWallet, ride: unknown) {
  const now = Date.now();
  const next = isRideKind(ride) && hasItem(wallet, ride, now) ? ride : null;
  if (next === wallet.ride) return;
  wallet.ride = next;
  walletChanged(wallet, now);
}

/** Veste (ou, com null, tira) uma fantasia alugada ou comprada. */
function handleWear(wallet: StoredWallet, costume: unknown) {
  const now = Date.now();
  // Fantasia inválida ou que o jogador não tem: ignora (não tira a que está vestida).
  if (costume !== null && !(isCostumeId(costume) && hasItem(wallet, costume, now))) return;
  const next = costume;
  if (next === wallet.costume) return;
  wallet.costume = next;
  walletChanged(wallet, now);
}

// --- regras --------------------------------------------------------------

function freeSeat(state: PlayerState) {
  if (state.seatId && occupancy.get(state.seatId) === state.id) occupancy.delete(state.seatId);
  state.seatId = null;
}

function setActivity(state: PlayerState, activity: PlayerState["activity"]) {
  if (state.activity === activity) return;
  state.activity = activity;
  broadcast({ type: "player-activity", id: state.id, activity });
}

function handleSit(id: string, client: Client, state: PlayerState, seatId: string) {
  const seat = seats.get(seatId);
  if (!seat) return send(client, { type: "sit-rejected", seatId, reason: "unknown-seat" });

  const occupant = occupancy.get(seatId);
  if (occupant && occupant !== state.id) {
    return send(client, { type: "sit-rejected", seatId, reason: "occupied" });
  }
  if (Math.hypot(seat.x - state.x, seat.y - state.y) > LIMITS.sitDistance) {
    return send(client, { type: "sit-rejected", seatId, reason: "too-far" });
  }

  const previousTable = tableOf(state);
  freeSeat(state);
  occupancy.set(seatId, state.id);
  state.seatId = seatId;
  state.anim = "idle";
  state.facing = seat.facing;
  state.activity = null;
  broadcast({ type: "player-seated", id: state.id, seatId });
  if (seat.tableId !== previousTable) void sendChatHistory(id, client, seat.tableId);
}

function handleStand(state: PlayerState) {
  if (!state.seatId) return;
  freeSeat(state);
  broadcast({ type: "player-seated", id: state.id, seatId: null });
}

async function handleJoin(id: string, client: Client, msg: Extract<ClientMessage, { type: "join" }>) {
  if (client.state || client.joining) return;
  client.joining = true;
  const key = isWalletKey(msg.walletKey) ? msg.walletKey : randomUUID();
  let wallet: StoredWallet;
  try {
    wallet = await wallets.acquire(key);
  } catch (err) {
    // Sem a carteira não dá para entrar; o cliente reconecta e tenta de novo.
    console.warn("[db] falha ao carregar carteira:", err);
    client.joining = false;
    client.ws.close(1011, "storage unavailable");
    return;
  }
  client.joining = false;
  if (clients.get(id) !== client) {
    wallets.release(key); // desconectou enquanto carregava
    return;
  }

  const name = String(msg.name ?? "").trim().slice(0, LIMITS.nameLength) || "Visitante";
  const now = Date.now();
  // Começa a contar o tempo agora (a menos que a mesma carteira já esteja online em outra aba).
  if (clientsOfWallet(wallet).length === 0) wallet.lastAwardAt = now;
  client.wallet = wallet;
  const gear = gearOf(wallet, now);
  const appearance = sanitizeAppearance(msg.appearance);
  client.state = {
    id,
    name,
    appearance,
    x: isNum(msg.x) ? clamp(msg.x, 0, WORLD_W) : WORLD_W / 2,
    y: isNum(msg.y) ? clamp(msg.y, 0, WORLD_H) : WORLD_H / 2,
    facing: "down",
    anim: "idle",
    seatId: null,
    activity: null,
    media: { mic: false, cam: false },
    ...gear,
  };
  const players = [...clients.values()].flatMap((c) => (c.state ? [c.state] : []));
  send(client, { type: "welcome", selfId: id, players, iceServers });
  send(client, { type: "wallet", wallet: publicWallet(wallet), serverNow: now });
  broadcast({ type: "player-joined", player: client.state }, id);

  client.connectedAt = now;
  client.sessionId = store.playerJoined(key, id, { name, appearance }, now);
  persist("entrada do jogador", client.sessionId);
}

/** Saída: libera a cadeira e a carteira e fecha a sessão no banco. */
function handleLeave(id: string, client: Client) {
  const { state, wallet, sessionId } = client;
  if (!state || !wallet) return;
  freeSeat(state);
  broadcast({ type: "player-left", id });
  wallets.release(wallet.key);
  wallets.markDirty(wallet);
  if (sessionId) {
    const position = { x: state.x, y: state.y };
    persist(
      "saída do jogador",
      sessionId.then((sid) => store.playerLeft(wallet.key, sid, position, client.connectedAt, Date.now())),
    );
  }
}

function handleMessage(id: string, client: Client, msg: ClientMessage) {
  if (msg.type === "join") {
    void handleJoin(id, client, msg);
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
      if (state.anim === "walk") setActivity(state, null); // andar interrompe a atividade
      else if (state.activity) state.facing = "down"; // atividades sempre de frente
      broadcast(
        { type: "player-moved", id, x: state.x, y: state.y, facing: state.facing, anim: state.anim },
        id,
      );
      return;
    }
    case "rent":
      return handleRent(client, wallet, msg.item);
    case "buy":
      return handleBuy(client, wallet, msg.item, msg.pet);
    case "equip":
      return handleEquip(wallet, msg.ride);
    case "wear":
      return handleWear(wallet, msg.costume);
    case "activity": {
      if (state.seatId) return; // sentado não faz atividades
      if (msg.activity !== null && !isActivity(msg.activity)) return;
      if (msg.activity) {
        state.facing = "down";
        state.anim = "idle";
      }
      return setActivity(state, msg.activity);
    }
    case "bubble": {
      const bubble = sanitizeBubble(msg.bubble);
      const now = Date.now();
      if (!bubble || now - client.lastBubbleAt < BUBBLE_COOLDOWN_MS) return;
      client.lastBubbleAt = now;
      broadcast({ type: "player-bubble", id, bubble });
      return;
    }
    case "sit":
      return handleSit(id, client, state, String(msg.seatId));
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
      persist("mensagem do chat", store.saveChatMessage({ ...message, playerKey: wallet.key }));
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
      if (target.wallet) {
        persist(
          "mensagem direta",
          store.saveDirectMessage({
            id: message.id,
            fromKey: wallet.key,
            toKey: target.wallet.key,
            fromName: state.name,
            toName: target.state.name,
            text,
            ts: message.ts,
          }),
        );
      }
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
  /** Onde os dados são persistidos (MongoDB ou memória). Veja server/db/store.mts. */
  store: Store;
}

export interface RealtimeServer {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
  close(): Promise<void>;
}

export function createRealtimeServer(options: RealtimeOptions): RealtimeServer {
  iceServers = options.iceServers;
  store = options.store;
  wallets = new WalletStore(store);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  wss.on("connection", (ws) => {
    const id = randomUUID().slice(0, 8);
    const client: Client = {
      ws,
      alive: true,
      windowStart: Date.now(),
      windowCount: 0,
      state: null,
      wallet: null,
      joining: false,
      sessionId: null,
      connectedAt: 0,
      lastBubbleAt: 0,
    };
    clients.set(id, client);

    ws.on("pong", () => (client.alive = true));
    ws.on("message", (raw) => {
      if (!allowMessage(client)) return;
      const msg = parse(raw.toString());
      if (msg) handleMessage(id, client, msg);
    });
    ws.on("close", () => {
      clients.delete(id);
      handleLeave(id, client);
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
    async close() {
      clearInterval(heartbeat);
      clearInterval(coinTimer);
      // Fecha as sessões abertas antes de gravar as carteiras e desconectar do banco.
      const leaving = [...clients].flatMap(([id, c]) => (c.state && c.sessionId ? [{ id, c }] : []));
      const now = Date.now();
      await Promise.allSettled(
        leaving.map(({ c }) =>
          c.sessionId!.then((sid) => store.playerLeft(c.wallet!.key, sid, { x: c.state!.x, y: c.state!.y }, c.connectedAt, now)),
        ),
      );
      for (const { c } of leaving) c.state = null; // o "close" do socket não grava de novo
      await wallets.close().catch((err) => console.warn("[wallets] falha ao salvar ao desligar:", err));
      for (const c of clients.values()) c.ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await store.close();
    },
  };
}

export const SEAT_COUNT = seats.size;
