/**
 * Protocolo WebSocket compartilhado entre cliente e servidor.
 * Só tipos e constantes puras: importável pelo Node (server/) e pelo Next.
 */
import type { Appearance } from "./appearance.ts";

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
}

export interface ChatMessage {
  id: string;
  tableId: string;
  fromId: string;
  fromName: string;
  text: string;
  ts: number;
}

/** Mensagem direta (DM) entre dois jogadores. Não fica salva no servidor. */
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
  | { type: "join"; name: string; appearance: Appearance; x: number; y: number }
  | { type: "move"; x: number; y: number; facing: Facing; anim: MoveAnim }
  | { type: "sit"; seatId: string }
  | { type: "stand" }
  | { type: "chat"; text: string }
  | { type: "dm"; to: string; text: string }
  | { type: "media"; media: MediaState }
  | { type: "signal"; to: string; data: SignalData };

export type SitRejectReason = "occupied" | "too-far" | "unknown-seat";

export type ServerMessage =
  | { type: "welcome"; selfId: string; players: PlayerState[]; iceServers: RTCIceServer[] }
  | { type: "player-joined"; player: PlayerState }
  | { type: "player-left"; id: string }
  | { type: "player-moved"; id: string; x: number; y: number; facing: Facing; anim: MoveAnim }
  | { type: "player-seated"; id: string; seatId: string | null }
  | { type: "player-media"; id: string; media: MediaState }
  | { type: "sit-rejected"; seatId: string; reason: SitRejectReason }
  | { type: "chat"; message: ChatMessage }
  /** Enviada ao destinatário e devolvida ao remetente (confirma o envio). */
  | { type: "dm"; message: DirectMessage }
  | { type: "signal"; from: string; data: SignalData };
