/**
 * Aparência do personagem escolhida pelo jogador. Puro (sem Phaser/React):
 * usado pela tela de entrada, pelo gerador de sprites e pelo servidor (validação).
 */

export type BodyType = "male" | "female";

export interface Appearance {
  body: BodyType;
  hairStyle: number;
  hairColor: number;
  skin: number;
  eyes: number;
  outfit: number;
  outfitColor: number;
  shoes: number;
  shoeColor: number;
}

export interface NamedColor {
  label: string;
  color: number;
}

export const BODY_TYPES: ReadonlyArray<{ id: BodyType; label: string }> = [
  { id: "male", label: "Masculino" },
  { id: "female", label: "Feminino" },
];

export const HAIR_STYLES = ["Curto", "Espetado", "Longo", "Rabo de cavalo", "Maria-chiquinha", "Careca"] as const;

export const HAIR_COLORS: readonly NamedColor[] = [
  { label: "Castanho", color: 0x5a3622 },
  { label: "Preto", color: 0x26222a },
  { label: "Loiro", color: 0xe0b450 },
  { label: "Ruivo", color: 0xc0502c },
  { label: "Castanho claro", color: 0x9a6a3c },
  { label: "Grisalho", color: 0xb8b8c0 },
  { label: "Azul", color: 0x4a74d0 },
  { label: "Rosa", color: 0xe07aa8 },
];

export const SKIN_TONES: readonly NamedColor[] = [
  { label: "Muito clara", color: 0xfde0c8 },
  { label: "Clara", color: 0xf4c8a0 },
  { label: "Média", color: 0xdca478 },
  { label: "Morena", color: 0xb47c50 },
  { label: "Escura", color: 0x8a5634 },
  { label: "Muito escura", color: 0x5e3a24 },
];

export const EYE_STYLES = ["Clássico", "Grandes", "Sorridente", "Sério"] as const;

export const OUTFITS = ["Camiseta", "Moletom", "Camisa social", "Terno", "Vestido"] as const;

export const OUTFIT_COLORS: readonly NamedColor[] = [
  { label: "Verde", color: 0x2fa37a },
  { label: "Vermelho", color: 0xd9534f },
  { label: "Azul", color: 0x4f7fd9 },
  { label: "Amarelo", color: 0xe8c040 },
  { label: "Roxo", color: 0x8e5bd9 },
  { label: "Laranja", color: 0xf08a3c },
  { label: "Rosa", color: 0xe874a8 },
  { label: "Branco", color: 0xe8e8f0 },
  { label: "Cinza", color: 0x7a8090 },
  { label: "Preto", color: 0x34343e },
];

export const SHOE_STYLES = ["Tênis", "Sapato social", "Bota", "Sandália"] as const;

export const SHOE_COLORS: readonly NamedColor[] = [
  { label: "Preto", color: 0x24242c },
  { label: "Branco", color: 0xe8e8f0 },
  { label: "Marrom", color: 0x7a4a2a },
  { label: "Vermelho", color: 0xc83c3c },
  { label: "Azul", color: 0x3c64c8 },
  { label: "Verde", color: 0x3c9c5c },
  { label: "Bege", color: 0xd8c09a },
  { label: "Rosa", color: 0xe07aa8 },
];

/** Quantidade de opções de cada campo numérico (para validar e sortear). */
export const APPEARANCE_LIMITS: Record<Exclude<keyof Appearance, "body">, number> = {
  hairStyle: HAIR_STYLES.length,
  hairColor: HAIR_COLORS.length,
  skin: SKIN_TONES.length,
  eyes: EYE_STYLES.length,
  outfit: OUTFITS.length,
  outfitColor: OUTFIT_COLORS.length,
  shoes: SHOE_STYLES.length,
  shoeColor: SHOE_COLORS.length,
};

const FIELDS = Object.keys(APPEARANCE_LIMITS) as Array<keyof typeof APPEARANCE_LIMITS>;

export const DEFAULT_APPEARANCE: Appearance = {
  body: "male",
  hairStyle: 0,
  hairColor: 0,
  skin: 1,
  eyes: 0,
  outfit: 0,
  outfitColor: 0,
  shoes: 0,
  shoeColor: 0,
};

/** Aceita qualquer valor (vindo da rede ou do localStorage) e devolve uma aparência válida. */
export function sanitizeAppearance(raw: unknown): Appearance {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Appearance = { ...DEFAULT_APPEARANCE, body: src.body === "female" ? "female" : "male" };
  for (const field of FIELDS) {
    const v = src[field];
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < APPEARANCE_LIMITS[field]) {
      out[field] = v;
    }
  }
  return out;
}

export function randomAppearance(random: () => number = Math.random): Appearance {
  const pick = (n: number) => Math.floor(random() * n);
  const out: Appearance = { ...DEFAULT_APPEARANCE, body: random() < 0.5 ? "male" : "female" };
  for (const field of FIELDS) out[field] = pick(APPEARANCE_LIMITS[field]);
  return out;
}

/** Chave estável (ex.: para cache de texturas): "m-0-0-1-0-0-0-0-0". */
export function appearanceKey(a: Appearance): string {
  return [a.body === "female" ? "f" : "m", ...FIELDS.map((f) => a[f])].join("-");
}

/** 0x2fa37a → "#2fa37a" */
export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
