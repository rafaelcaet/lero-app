/**
 * Tempo real do escritório: posições, cadeiras, chat por mesa e sinalização
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

/** Mensagens por segundo aceitas de cada conexão (acima disso, descarta). */
const MAX_MESSAGES_PER_SECOND = 60;
const WORLD_W = MAP_WIDTH * TILE_SIZE;
const WORLD_H = MAP_HEIGHT * TILE_SIZE;
const COLOR_COUNT = 6;
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
}
const clients = new Map<string, Client>();
let colorCounter = 0;

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
    client.state = {
      id,
      name,
      colorIndex: colorCounter++ % COLOR_COUNT,
      x: isNum(msg.x) ? clamp(msg.x, 0, WORLD_W) : WORLD_W / 2,
      y: isNum(msg.y) ? clamp(msg.y, 0, WORLD_H) : WORLD_H / 2,
      facing: "down",
      anim: "idle",
      seatId: null,
      media: { mic: false, cam: false },
    };
    const players = [...clients.values()].flatMap((c) => (c.state ? [c.state] : []));
    send(client, { type: "welcome", selfId: id, players, iceServers });
    broadcast({ type: "player-joined", player: client.state }, id);
    return;
  }

  const state = client.state;
  if (!state) return;

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
}

export interface RealtimeServer {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
  close(): Promise<void>;
}

export function createRealtimeServer(options: RealtimeOptions): RealtimeServer {
  iceServers = options.iceServers;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  wss.on("connection", (ws) => {
    const id = randomUUID().slice(0, 8);
    const client: Client = { ws, alive: true, windowStart: Date.now(), windowCount: 0, state: null };
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

  return {
    handleUpgrade(req, socket, head) {
      const origin = req.headers.origin ?? "";
      if (options.allowedOrigins.length > 0 && !options.allowedOrigins.includes(origin)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    },
    close() {
      clearInterval(heartbeat);
      for (const c of clients.values()) c.ws.terminate();
      return new Promise((resolve) => wss.close(() => resolve()));
    },
  };
}

export const SEAT_COUNT = seats.size;
