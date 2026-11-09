/**
 * Protocolo WebSocket compartilhado entre cliente e servidor.
 * Só tipos e constantes puras: importável pelo Node (server/) e pelo Next.
 */
import type { Activity } from "./activities.ts";
import type { Appearance } from "./appearance.ts";
import type { Bubble } from "./bubbles.ts";
import type { CostumeId, PetKind, RideKind, ShopItemId, Wallet } from "./shop.ts";

/** Caminho do WebSocket do jogo (mesma origem do site). */
export const WS_PATH = "/ws";

export const LIMITS = {
  nameLength: 24,
  chatLength: 500,
  dmLength: 1000,
  /** Distância máxima (px) entre o jogador e a cadeira para poder sentar. */
  sitDistance: 56,
} as const;

export type Facing = "down" | "left" | "right" | "up";
export type MoveAnim = "idle" | "walk";

export interface MediaState {
  mic: boolean;
  cam: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  appearance: Appearance;
  x: number;
  y: number;
  facing: Facing;
  anim: MoveAnim;
  seatId: string | null;
  media: MediaState;
  /** Veículo em uso (alugado na loja). */
  ride: RideKind | null;
  /** Mascote alugado que segue o jogador. */
  pet: PetKind | null;
  /** Fantasia vestida (alugada ou comprada na loja). */
  costume: CostumeId | null;
  /** Atividade em andamento (comendo, fumando, dormindo). Cancelada ao andar ou sentar. */
  activity: Activity | null;
}

export interface ChatMessage {
  id: string;
  tableId: string;
  fromId: string;
  fromName: string;
  text: string;
  ts: number;
}

/** Mensagem direta (DM) entre dois jogadores. O servidor guarda um registro no banco. */
export interface DirectMessage {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  text: string;
  ts: number;
}

/** Dados de sinalização WebRTC repassados pelo servidor sem interpretação. */
export type SignalData =
  | { kind: "description"; description: RTCSessionDescriptionInit }
  | { kind: "candidate"; candidate: RTCIceCandidateInit };

export type ClientMessage =
  | {
      type: "join";
      name: string;
      appearance: Appearance;
      x: number;
      y: number;
      /** Chave da carteira guardada no navegador (mantém as Lerocoins entre visitas). */
      walletKey?: string;
    }
  | { type: "move"; x: number; y: number; facing: Facing; anim: MoveAnim }
  | { type: "sit"; seatId: string }
  | { type: "stand" }
  | { type: "chat"; text: string }
  | { type: "dm"; to: string; text: string }
  | { type: "media"; media: MediaState }
  | { type: "signal"; to: string; data: SignalData }
  | { type: "rent"; item: ShopItemId }
  /** Compra definitiva. `pet` escolhe o mascote (obrigatório ao comprar o mascote). */
  | { type: "buy"; item: ShopItemId; pet?: PetKind }
  /** Sobe/desce do veículo. null = andar a pé. */
  | { type: "equip"; ride: RideKind | null }
  /** Veste uma fantasia alugada/comprada. null = tira. */
  | { type: "wear"; costume: CostumeId | null }
  /** Começa uma atividade (ou null para parar). */
  | { type: "activity"; activity: Activity | null }
  /** Balão de fala (texto curto ou emote) ao lado do personagem. */
  | { type: "bubble"; bubble: Bubble };

export type SitRejectReason = "occupied" | "too-far" | "unknown-seat";

/** "owned": o item já foi comprado (não faz sentido alugar nem comprar de novo). */
export type RentRejectReason = "no-coins" | "max-time" | "owned";
export type BuyRejectReason = "no-coins" | "owned";

export type ServerMessage =
  | { type: "welcome"; selfId: string; players: PlayerState[]; iceServers: RTCIceServer[] }
  | { type: "player-joined"; player: PlayerState }
  | { type: "player-left"; id: string }
  | { type: "player-moved"; id: string; x: number; y: number; facing: Facing; anim: MoveAnim }
  | { type: "player-seated"; id: string; seatId: string | null }
  | { type: "player-media"; id: string; media: MediaState }
  | { type: "sit-rejected"; seatId: string; reason: SitRejectReason }
  | { type: "chat"; message: ChatMessage }
  /** Mensagens anteriores da mesa, enviadas ao sentar (da mais antiga para a mais nova). */
  | { type: "chat-history"; tableId: string; messages: ChatMessage[] }
  /** Enviada ao destinatário e devolvida ao remetente (confirma o envio). */
  | { type: "dm"; message: DirectMessage }
  | { type: "signal"; from: string; data: SignalData }
  /** Carteira do próprio jogador. `serverNow` permite corrigir a diferença de relógio. */
  | { type: "wallet"; wallet: Wallet; serverNow: number }
  | { type: "rent-rejected"; item: ShopItemId; reason: RentRejectReason }
  | { type: "buy-rejected"; item: ShopItemId; reason: BuyRejectReason }
  | { type: "player-activity"; id: string; activity: Activity | null }
  /** Balão de fala de um jogador (enviado a todos, inclusive a quem falou). */
  | { type: "player-bubble"; id: string; bubble: Bubble }
  | { type: "player-gear"; id: string; ride: RideKind | null; pet: PetKind | null; costume: CostumeId | null };
