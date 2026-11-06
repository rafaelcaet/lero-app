import { tableIdOfSeat } from "@/game/maps/officeSeats";
import { DEFAULT_APPEARANCE, sanitizeAppearance, type Appearance } from "@/shared/appearance";
import {
  WS_PATH,
  type ChatMessage,
  type DirectMessage,
  type Facing,
  type MoveAnim,
  type PlayerState,
  type RentRejectReason,
  type ServerMessage,
} from "@/shared/protocol";
import type { Activity } from "@/shared/activities";
import { sanitizeBubbleText, type Emote } from "@/shared/bubbles";
import type { RideKind, ShopItemId, Wallet } from "@/shared/shop";
import { Emitter } from "./Emitter";
import { NetworkClient, type ConnectionStatus } from "./NetworkClient";
import { INITIAL_CALL_STATE, TableCall, type CallState } from "./TableCall";

/** Conversa de DM com outro jogador (só em memória, nesta aba). */
export interface DmConversation {
  peerId: string;
  /** Nome e aparência guardados para a conversa continuar legível se a pessoa sair. */
  peerName: string;
  appearance: Appearance;
  messages: readonly DirectMessage[];
  unread: number;
}

export interface SessionState {
  status: ConnectionStatus;
  selfId: string | null;
  players: Readonly<Record<string, PlayerState>>;
  /** Mensagens da mesa atual (zera ao trocar de mesa). */
  chat: readonly ChatMessage[];
  call: CallState;
  /** Jogador que o personagem local está seguindo (só no cliente). */
  followTargetId: string | null;
  /** Conversas de DM por id do outro jogador. */
  dms: Readonly<Record<string, DmConversation>>;
  /** Lerocoins e aluguéis do jogador. null até o servidor mandar (ou se não suportar). */
  wallet: Wallet | null;
  /** Relógio do servidor − relógio local (ms), para os contadores de aluguel. */
  serverClockOffset: number;
  /** Último aluguel recusado (para a loja mostrar o motivo). */
  rentRejection: { item: ShopItemId; reason: RentRejectReason; at: number } | null;
}

/**
 * Garante uma aparência válida. Se o servidor não mandar o campo (ex.: versão
 * desatualizada), usa `fallback` — para o próprio jogador, a escolha local.
 */
function withAppearance(player: PlayerState, fallback: Appearance): PlayerState {
  const appearance = player.appearance ? sanitizeAppearance(player.appearance) : fallback;
  return { ...player, appearance, ride: player.ride ?? null, pet: player.pet ?? null, activity: player.activity ?? null };
}

/** Quantas conversas têm mensagens não lidas. */
export function unreadConversations(state: SessionState): number {
  return Object.values(state.dms).filter((c) => c.unread > 0).length;
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
  followTargetId: null,
  dms: {},
  wallet: null,
  serverClockOffset: 0,
  rentRejection: null,
};

const MAX_DM_HISTORY = 300;

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
  readonly appearance: Appearance;

  private state: SessionState = INITIAL_STATE;
  private readonly listeners = new Set<() => void>();
  private readonly net: NetworkClient;
  private call: TableCall | null = null;
  private unsubscribers: Array<() => void> = [];
  private lastPosition: { x: number; y: number } | null = null;
  private iceServers: RTCIceServer[] = [];
  private joined = false;

  private readonly walletKey: string | undefined;

  constructor(name: string, appearance: Appearance, url: string, walletKey?: string) {
    this.name = name;
    this.appearance = appearance;
    this.walletKey = walletKey;
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
    this.setState({ call: call.getState() });
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

  /** Aluga um item da loja por 1 hora (ou soma mais 1 hora se já estiver alugado). */
  rent(item: ShopItemId) {
    this.setState({ rentRejection: null });
    this.net.send({ type: "rent", item });
  }

  /** Sobe num veículo alugado (ou desce, com null). */
  equipRide(ride: RideKind | null) {
    this.net.send({ type: "equip", ride });
  }

  /** Começa uma atividade (comer, fumar, dormir) ou, com null, para. */
  setActivity(activity: Activity | null) {
    this.net.send({ type: "activity", activity });
  }

  /** Balão de fala com texto curto (até 20 caracteres) ao lado do personagem. */
  sayBubble(text: string) {
    const clean = sanitizeBubbleText(text);
    if (clean) this.net.send({ type: "bubble", bubble: { kind: "text", text: clean } });
  }

  /** Balão de fala com um emote (beleza, coração, dúvida, negativo). */
  sendEmote(emote: Emote) {
    this.net.send({ type: "bubble", bubble: { kind: "emote", emote } });
  }

  /** Faz o personagem local caminhar até outro jogador e acompanhá-lo. */
  follow(playerId: string) {
    if (playerId === this.state.selfId || !this.state.players[playerId]) return;
    if (this.state.followTargetId !== playerId) this.setState({ followTargetId: playerId });
  }

  stopFollow() {
    if (this.state.followTargetId !== null) this.setState({ followTargetId: null });
  }

  toggleMic() {
    this.call?.toggleMic();
  }

  toggleCam() {
    this.call?.toggleCam();
  }

  setInputVolume(volume: number) {
    this.call?.setInputVolume(volume);
  }

  setOutputVolume(volume: number) {
    this.call?.setOutputVolume(volume);
  }

  /** Nível do microfone (0–1) para o medidor; 0 sem chamada ativa. */
  getInputLevel(): number {
    return this.call?.getInputLevel() ?? 0;
  }

  /** Envia uma DM. A mensagem entra na conversa quando o servidor confirma. */
  sendDm(to: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed || to === this.state.selfId || !this.state.players[to]) return;
    this.net.send({ type: "dm", to, text: trimmed });
  }

  /** Zera o contador de não lidas de uma conversa (ex.: ao abri-la). */
  markDmRead(peerId: string) {
    const conversation = this.state.dms[peerId];
    if (conversation && conversation.unread > 0) {
      this.setState({ dms: { ...this.state.dms, [peerId]: { ...conversation, unread: 0 } } });
    }
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
    this.net.send({
      type: "join",
      name: this.name,
      appearance: this.appearance,
      walletKey: this.walletKey,
      ...this.lastPosition,
    });
  }

  private handleStatus(status: ConnectionStatus) {
    if (status !== "open") {
      // Perdeu a conexão: o servidor já liberou a cadeira; zera o estado remoto.
      this.joined = false;
      this.setState({ status, selfId: null, players: {}, chat: [], followTargetId: null });
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
          players: Object.fromEntries(
            msg.players.map((p) => [p.id, withAppearance(p, p.id === msg.selfId ? this.appearance : DEFAULT_APPEARANCE)]),
          ),
          chat: [],
        });
        break;
      case "player-joined":
        this.setState({ players: { ...players, [msg.player.id]: withAppearance(msg.player, DEFAULT_APPEARANCE) } });
        break;
      case "player-left": {
        const next = { ...players };
        delete next[msg.id];
        const followTargetId = this.state.followTargetId === msg.id ? null : this.state.followTargetId;
        this.setState({ players: next, followTargetId });
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
        patchPlayer(msg.id, { seatId: msg.seatId, activity: null });
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
      case "chat-history":
        if (msg.tableId === selectTable(this.state).tableId) {
          // Junta com o que chegou ao vivo enquanto o histórico carregava.
          const byId = new Map([...msg.messages, ...this.state.chat].map((m) => [m.id, m]));
          const chat = [...byId.values()].sort((a, b) => a.ts - b.ts).slice(-200);
          this.setState({ chat });
        }
        break;
      case "dm":
        this.receiveDm(msg.message);
        break;
      case "signal":
        this.call?.handleSignal(msg.from, msg.data);
        break;
      case "player-activity":
        patchPlayer(msg.id, { activity: msg.activity });
        break;
      case "player-gear":
        patchPlayer(msg.id, { ride: msg.ride, pet: msg.pet });
        break;
      case "wallet":
        this.setState({ wallet: msg.wallet, serverClockOffset: msg.serverNow - Date.now() });
        break;
      case "rent-rejected":
        this.setState({ rentRejection: { item: msg.item, reason: msg.reason, at: Date.now() } });
        break;
      case "sit-rejected":
        break;
    }

    if (msg.type === "welcome" || msg.type === "player-left" || msg.type === "player-seated") {
      this.syncCallPeers();
    }
    this.events.emit("message", msg);
  }

  private receiveDm(message: DirectMessage) {
    const selfId = this.state.selfId;
    const incoming = message.toId === selfId;
    const peerId = incoming ? message.fromId : message.toId;
    const peer = this.state.players[peerId];
    const current = this.state.dms[peerId];
    const conversation: DmConversation = {
      peerId,
      peerName: peer?.name ?? current?.peerName ?? message.fromName,
      appearance: peer?.appearance ?? current?.appearance ?? DEFAULT_APPEARANCE,
      messages: [...(current?.messages ?? []), message].slice(-MAX_DM_HISTORY),
      unread: (current?.unread ?? 0) + (incoming ? 1 : 0),
    };
    this.setState({ dms: { ...this.state.dms, [peerId]: conversation } });
  }

  private syncCallPeers() {
    const { tableId, members } = selectTable(this.state);
    const others = members.filter((p) => p.id !== this.state.selfId).map((p) => p.id);
    this.call?.sync(tableId !== null, others);
  }
}
