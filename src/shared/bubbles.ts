/**
 * Balões de fala: mensagens curtas ou emotes que aparecem ao lado da boca do
 * personagem por alguns segundos. Puro (importável pelo Node e pelo Next).
 */

/** Tamanho máximo do texto de um balão (em caracteres visíveis). */
export const BUBBLE_MAX_LENGTH = 20;
/** Quanto tempo o balão fica na tela. */
export const BUBBLE_DURATION_MS = 4500;
/** Intervalo mínimo entre dois balões do mesmo jogador (anti-spam). */
export const BUBBLE_COOLDOWN_MS = 600;

export const EMOTES = [
  { id: "thumbs-up", label: "Beleza" },
  { id: "heart", label: "Coração" },
  { id: "question", label: "Dúvida" },
  { id: "thumbs-down", label: "Negativo" },
] as const;

export type Emote = (typeof EMOTES)[number]["id"];

export type Bubble = { kind: "text"; text: string } | { kind: "emote"; emote: Emote };

const EMOTE_IDS: ReadonlySet<unknown> = new Set(EMOTES.map((e) => e.id));

export const isEmote = (value: unknown): value is Emote => EMOTE_IDS.has(value);

const segmenter = new Intl.Segmenter("pt-BR", { granularity: "grapheme" });

/** Caracteres visíveis (um emoji, mesmo composto, conta como 1). */
const graphemes = (text: string) => Array.from(segmenter.segment(text), (s) => s.segment);

/** Limpa o texto: sem quebras/controles, espaços colapsados e até 20 caracteres. */
export function sanitizeBubbleText(raw: unknown): string {
  const clean = String(raw ?? "")
    // Controles e caracteres invisíveis viram espaço (menos o ZWJ, que compõe emojis).
    .replace(/(?!\u200D)[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return graphemes(clean).slice(0, BUBBLE_MAX_LENGTH).join("").trim();
}

export const bubbleTextLength = (text: string) => graphemes(text).length;

/** Corta no limite de caracteres sem limpar o resto (para o campo enquanto se digita). */
export function limitBubbleText(text: string): string {
  const parts = graphemes(text);
  return parts.length > BUBBLE_MAX_LENGTH ? parts.slice(0, BUBBLE_MAX_LENGTH).join("") : text;
}

/** Valida um balão vindo da rede; null se inválido. */
export function sanitizeBubble(raw: unknown): Bubble | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Partial<{ kind: string; text: unknown; emote: unknown }>;
  if (b.kind === "emote") return isEmote(b.emote) ? { kind: "emote", emote: b.emote } : null;
  if (b.kind === "text") {
    const text = sanitizeBubbleText(b.text);
    return text ? { kind: "text", text } : null;
  }
  return null;
}
