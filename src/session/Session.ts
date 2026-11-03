import { tableIdOfSeat } from "@/game/maps/officeSeats";
import {
  WS_PATH,
  type ChatMessage,
  type Facing,
  type MoveAnim,
  type PlayerState,
  type ServerMessage,
} from "@/shared/protocol";
import { Emitter } from "./Emitter";
import { NetworkClient, type ConnectionStatus } from "./NetworkClient";
import { INITIAL_CALL_STATE, TableCall, type CallState } from "./TableCall";

export interface SessionState {
  status: ConnectionStatus;
  selfId: string | null;
  players: Readonly<Record<string, PlayerState>>;
  /** Mensagens da mesa atual (zera ao trocar de mesa). */
  chat: readonly ChatMessage[];
  call: CallState;
}

type SessionEvents = {
  /** Mensagem do servidor, emitida depois que o estado foi atualizado. */
  message: ServerMessage;
  status: ConnectionStatus;
};

const INITIAL_STATE: SessionState = {
  status: "closed",
  selfId: null,
  players: {},
  chat: [],
  call: INITIAL_CALL_STATE,
};

export function resolveServerUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_WS_URL;
  if (fromEnv) return fromEnv;
  // Mesma origem do site: funciona em localhost, na rede local e atrás de HTTPS/túnel.
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}${WS_PATH}`;
}

/** Retorna o id da mesa e quem está nela (incluindo você). */
export function selectTable(state: SessionState) {
  const self = state.selfId ? state.players[state.selfId] : undefined;
  const tableId = tableIdOfSeat(self?.seatId);
  const members = tableId
    ? Object.values(state.players).filter((p) => tableIdOfSeat(p.seatId) === tableId)
    : [];
  return { tableId, members };
}

/**
 * Sessão multiplayer: conexão, estado compartilhado e chamada da mesa.
 * Sem dependência de React ou Phaser — ambos se inscrevem nela.
 * Construir não tem efeitos colaterais; `start()`/`stop()` podem ser chamados várias vezes.
 */
export class Session {
  readonly events = new Emitter<SessionEvents>();
  readonly name: string;

  private state: SessionState = INITIAL_STATE;
  private readonly listeners = new Set<() => void>();
  private readonly net: NetworkClient;
  private call: TableCall | null = null;
  private unsubscribers: Array<() => void> = [];
  private lastPosition: { x: number; y: number } | null = null;
  private iceServers: RTCIceServer[] = [];
  private joined = false;

  constructor(name: string, url: string) {
    this.name = name;
    this.net = new NetworkClient(url);
  }

  // --- store para React (useSyncExternalStore) --------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = () => this.state;

  private setState(patch: Partial<SessionState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  // --- ciclo de vida -----------------------------------------------------

  start() {
    if (this.call) return;
    const call = new TableCall(
      () => this.state.selfId,
      () => this.iceServers,
      (to, data) => this.net.send({ type: "signal", to, data }),
    );
    this.call = call;
    this.unsubscribers = [
      this.net.on("status", (status) => this.handleStatus(status)),
      this.net.on("message", (msg) => this.handleMessage(msg)),
      call.on("change", (callState) => this.setState({ call: callState })),
      call.on("media", (media) => this.net.send({ type: "media", media })),
    ];
    this.net.start();
  }

  stop() {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
    this.net.stop();
    this.call?.dispose();
    this.call = null;
    this.joined = false;
    this.state = INITIAL_STATE;
    this.listeners.forEach((l) => l());
  }

  // --- ações -------------------------------------------------------------

  /** Informa a posição inicial do jogador local; entra na sala assim que conectar. */
  join(x: number, y: number) {
    this.lastPosition = { x, y };
    this.trySendJoin();
  }

  sendMove(x: number, y: number, facing: Facing, anim: MoveAnim) {
    this.lastPosition = { x, y };
    this.net.send({ type: "move", x, y, facing, anim });
  }

  requestSit(seatId: string) {
    this.net.send({ type: "sit", seatId });
  }

  stand() {
    this.net.send({ type: "stand" });
  }

  sendChat(text: string) {
    const trimmed = text.trim();
    if (trimmed) this.net.send({ type: "chat", text: trimmed });
  }

  toggleMic() {
    this.call?.toggleMic();
  }

  toggleCam() {
    this.call?.toggleCam();
  }

  /** Cadeiras ocupadas: seatId → playerId. */
  occupiedSeats(): Map<string, string> {
    const map = new Map<string, string>();
    for (const p of Object.values(this.state.players)) if (p.seatId) map.set(p.seatId, p.id);
    return map;
  }

  // --- interno -----------------------------------------------------------

  private trySendJoin() {
    if (this.joined || !this.lastPosition || this.state.status !== "open") return;
    this.joined = true;
    this.net.send({ type: "join", name: this.name, ...this.lastPosition });
  }

  private handleStatus(status: ConnectionStatus) {
    if (status !== "open") {
      // Perdeu a conexão: o servidor já liberou a cadeira; zera o estado remoto.
      this.joined = false;
      this.setState({ status, selfId: null, players: {}, chat: [] });
      this.call?.sync(false, []);
    } else {
      this.setState({ status });
      this.trySendJoin();
    }
    this.events.emit("status", status);
  }

  private handleMessage(msg: ServerMessage) {
    const players = this.state.players;
    const patchPlayer = (id: string, patch: Partial<PlayerState>) => {
      const current = players[id];
      if (current) this.setState({ players: { ...players, [id]: { ...current, ...patch } } });
    };

    switch (msg.type) {
      case "welcome":
        this.iceServers = msg.iceServers ?? [];
        this.setState({
          selfId: msg.selfId,
          players: Object.fromEntries(msg.players.map((p) => [p.id, p])),
          chat: [],
        });
        break;
      case "player-joined":
        this.setState({ players: { ...players, [msg.player.id]: msg.player } });
        break;
      case "player-left": {
        const next = { ...players };
        delete next[msg.id];
        this.setState({ players: next });
        break;
      }
      case "player-moved":
        // Posições mudam a cada frame: atualiza sem notificar o React.
        if (players[msg.id]) {
          Object.assign(players[msg.id], { x: msg.x, y: msg.y, facing: msg.facing, anim: msg.anim });
        }
        break;
      case "player-seated": {
        const before = selectTable(this.state).tableId;
        patchPlayer(msg.id, { seatId: msg.seatId });
        if (selectTable(this.state).tableId !== before) this.setState({ chat: [] });
        break;
      }
      case "player-media":
        patchPlayer(msg.id, { media: msg.media });
        break;
      case "chat":
        if (msg.message.tableId === selectTable(this.state).tableId) {
          this.setState({ chat: [...this.state.chat, msg.message].slice(-200) });
        }
        break;
      case "signal":
        this.call?.handleSignal(msg.from, msg.data);
        break;
      case "sit-rejected":
        break;
    }

    if (msg.type === "welcome" || msg.type === "player-left" || msg.type === "player-seated") {
      this.syncCallPeers();
    }
    this.events.emit("message", msg);
  }

  private syncCallPeers() {
    const { tableId, members } = selectTable(this.state);
    const others = members.filter((p) => p.id !== this.state.selfId).map((p) => p.id);
    this.call?.sync(tableId !== null, others);
  }
}
