/**
 * Paletas de cor dos personagens. Módulo puro (sem Phaser): usado pelo gerador
 * de sprites e também pela interface em React (ex.: avatar na lista de jogadores).
 */

export interface CharacterPalette {
  skin: number;
  hair: number;
  shirt: number;
  shirtShade: number;
  pants: number;
  shoes: number;
}

export const DEFAULT_PALETTE: CharacterPalette = {
  skin: 0xf2c9a0,
  hair: 0x4a2e1f,
  shirt: 0x2fa37a,
  shirtShade: 0x237d5d,
  pants: 0x2b3350,
  shoes: 0x16161c,
};

/** Variações de cor para diferenciar jogadores (índice atribuído pelo servidor). */
export const CHARACTER_PALETTES: readonly CharacterPalette[] = [
  DEFAULT_PALETTE,
  { skin: 0xe0a77a, hair: 0x1f1a17, shirt: 0xd9534f, shirtShade: 0xa83c39, pants: 0x3a3a46, shoes: 0x16161c },
  { skin: 0xf5d6b8, hair: 0xd9a441, shirt: 0x4f7fd9, shirtShade: 0x3a62ab, pants: 0x2b2b33, shoes: 0x16161c },
  { skin: 0x9c6644, hair: 0x15110e, shirt: 0xe0c14a, shirtShade: 0xb39633, pants: 0x34405e, shoes: 0x16161c },
  { skin: 0xf2c9a0, hair: 0xa8432a, shirt: 0x8e5bd9, shirtShade: 0x6d43ab, pants: 0x2b3350, shoes: 0x16161c },
  { skin: 0x6e4a32, hair: 0x2a2a2a, shirt: 0xf08a3c, shirtShade: 0xbf6b2b, pants: 0x3d4a3a, shoes: 0x16161c },
];

/** Índice válido de paleta para qualquer inteiro vindo do servidor. */
export function paletteIndex(colorIndex: number): number {
  const n = CHARACTER_PALETTES.length;
  return ((colorIndex % n) + n) % n;
}

export function paletteOf(colorIndex: number): CharacterPalette {
  return CHARACTER_PALETTES[paletteIndex(colorIndex)];
}

/** 0x2fa37a → "#2fa37a" */
export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
