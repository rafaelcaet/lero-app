/**
 * Arte dos personagens em pixel art estilo Pokémon de GameBoy/GBA (16 × 16
 * pixels virtuais por frame, ampliados para TILE_SIZE), montada em camadas a
 * partir da aparência escolhida (sexo, cabelo, pele, olhos, roupa, sapato).
 * Puro, sem Phaser.
 *
 * Layout do sheet: linhas = direções (down, left, right, up);
 * colunas = 0 idle · 1 idle (respiração) · 2 idle (piscada) · 3–6 caminhada · 7 sentado
 */
import {
  HAIR_COLORS,
  OUTFIT_COLORS,
  SHOE_COLORS,
  SKIN_TONES,
  type Appearance,
} from "../../shared/appearance.ts";
import { TILE_SIZE } from "../constants.ts";
import { createImage, darken, lighten, mix, PixelCanvas, type Palette, type RgbaImage } from "../graphics/pixelArt.ts";

export const DIRECTIONS = ["down", "left", "right", "up"] as const;
export type Direction = (typeof DIRECTIONS)[number];

const N = 16;

export interface Pose {
  /** Perna erguida (passo): -1 esquerda da tela, 1 direita, 0 nenhuma. */
  step: -1 | 0 | 1;
  /** Balanço dos braços: -1, 0 ou 1. */
  swing: -1 | 0 | 1;
  eyesClosed: boolean;
  sitting: boolean;
}

const NEUTRAL: Pose = { step: 0, swing: 0, eyesClosed: false, sitting: false };

/** Poses por coluna do sheet. */
export const POSES: readonly Pose[] = [
  NEUTRAL,
  NEUTRAL, // "respiração": mantido igual (no GBA o idle é estático)
  { ...NEUTRAL, eyesClosed: true },
  // Caminhada: passo → parado → outro passo → parado
  { ...NEUTRAL, step: -1, swing: 1 },
  NEUTRAL,
  { ...NEUTRAL, step: 1, swing: -1 },
  NEUTRAL,
  { ...NEUTRAL, sitting: true },
];

// --- cores -----------------------------------------------------------------

const OUTFIT = { tshirt: 0, hoodie: 1, dressShirt: 2, suit: 3, dress: 4 } as const;
const SHOE = { sneaker: 0, formal: 1, boot: 2, sandal: 3 } as const;
const EYES = { classic: 0, big: 1, happy: 2, serious: 3 } as const;

interface Colors extends Palette {
  H: number; L: number; h: number; K: number;
  S: number; s: number; R: number;
  C: number; l: number; c: number;
  P: number; p: number;
  B: number; b: number;
  E: number; W: number; T: number;
}

function colorsFor(a: Appearance): Colors {
  const hair = HAIR_COLORS[a.hairColor].color;
  const skin = SKIN_TONES[a.skin].color;
  const top = OUTFIT_COLORS[a.outfitColor].color;
  const shoe = SHOE_COLORS[a.shoeColor].color;
  const pantsByOutfit = [0x3c5a9c, 0x3a3a48, 0x2c3040, darken(top, 0.45), skin];
  const pants = pantsByOutfit[a.outfit];
  // Gravata: vermelha, ou azul-marinho se o terno já for avermelhado.
  const tie = (top >> 16) > 0xb0 && ((top >> 8) & 0xff) < 0x80 ? 0x283060 : 0xc03038;
  return {
    H: hair, L: lighten(hair, 0.35), h: darken(hair, 0.3), K: lighten(skin, 0.4),
    S: skin, s: darken(skin, 0.15), R: mix(skin, 0xff5a7a, 0.3),
    C: top, l: lighten(top, 0.3), c: darken(top, 0.22),
    P: pants, p: darken(pants, 0.3),
    B: shoe, b: lighten(shoe, 0.4),
    E: 0x202030, W: 0xf8f8f8, T: tie,
  };
}

// --- cabeça ----------------------------------------------------------------

type View = "front" | "back" | "side";

const HEAD_BASE = [
  "................",
  ".....SSSSSS.....",
  "....SSSSSSSS....",
  "...SSSSSSSSSS...",
  "...SSSSSSSSSS...",
  "...SSSSSSSSSS...",
  "...SSSSSSSSSS...",
  "...sSSSSSSSSs...",
  "....sSSSSSSs....",
];

/** Sobrepõe linhas (caracteres "." não mexem). */
function overlay(base: readonly string[], extra: Record<number, string>): string[] {
  const rows = [...base];
  for (const [key, row] of Object.entries(extra)) {
    const y = Number(key);
    const current = (rows[y] ?? "").padEnd(N, ".");
    rows[y] = [...current].map((ch, x) => (row[x] && row[x] !== "." ? row[x] : ch)).join("");
  }
  return rows;
}

const SHORT: Record<View, string[]> = {
  front: [
    "................",
    ".....HHHHHH.....",
    "....HLLHHHHH....",
    "...HLHHHHHHHh...",
    "...HHHHHHHHHh...",
    "...Hh......hH...",
    "...H........H...",
  ],
  back: [
    "................",
    ".....HHHHHH.....",
    "....HLLHHHHH....",
    "...HLHHHHHHHh...",
    "...HHHHHHHHHh...",
    "...HHHHHHHHHh...",
    "...HHHHHHHHhh...",
    "...hHHHHHHhhh...",
    "....hh....hh....",
  ],
  side: [
    "................",
    ".....HHHHHH.....",
    "....HLLHHHHH....",
    "...HLHHHHHHHH...",
    "...HHHHHHHHHh...",
    "...HHHHHh.......",
    "...HHHH.........",
    "...hHH..........",
    "....h...........",
  ],
};

const SPIKY_TOP = { 1: "...H.HHH.HH.H...", 2: "...HLHLHHLHHH..." };

const PIGTAILS = {
  4: "..H..........H..",
  5: ".HH..........HH.",
  6: ".Hh..........hH.",
  7: ".hh..........hh.",
  8: "..h..........h..",
};

const HAIR_STYLES: Record<View, string[]>[] = [
  // Curto
  SHORT,
  // Espetado
  {
    front: overlay(SHORT.front.map((r, i) => (i === 1 ? "................" : r)), { ...SPIKY_TOP, 5: "...HhH.H..HhH..." }),
    back: overlay(SHORT.back.map((r, i) => (i === 1 ? "................" : r)), SPIKY_TOP),
    side: overlay(SHORT.side.map((r, i) => (i === 1 ? "................" : r)), {
      1: "....H.HHH.HH....",
      2: "...HLHLHHLHHH...",
      3: "...HLHHHHHHHHH..",
      5: "...HHHHHhH.H....",
    }),
  },
  // Longo
  {
    front: [
      "................",
      ".....HHHHHH.....",
      "....HLLHHHHH....",
      "...HLHHHHHHHh...",
      "..HHHHHHHHHHhh..",
      "..HHh......hHh..",
      "..HH........Hh..",
      "..HH........hh..",
      "..Hh........hh..",
      "..hh........hh..",
      "...h........h...",
    ],
    back: [
      "................",
      ".....HHHHHH.....",
      "....HLLHHHHH....",
      "...HLHHHHHHHh...",
      "..HHHHHHHHHHhh..",
      "..HHHHHHHHHHhh..",
      "..HLHHHHHHHHhh..",
      "..HHHHHHHHHHhh..",
      "..HHHHHHHHHHhh..",
      "..hHHHHHHHHhhh..",
      "...hhhhhhhhhh...",
    ],
    side: [
      "................",
      ".....HHHHHH.....",
      "....HLLHHHHH....",
      "...HLHHHHHHHH...",
      "..HHHHHHHHHHh...",
      "..HHHHHHh.......",
      "..HHHHH.........",
      "..HHHH..........",
      "..HHHh..........",
      "..hHHh..........",
      "...hh...........",
    ],
  },
  // Rabo de cavalo
  {
    front: SHORT.front.slice(0, 6),
    back: overlay(SHORT.back, {
      7: ".......hh.......",
      8: ".......HH.......",
      9: ".......Hh.......",
      10: ".......hh.......",
      11: "........h.......",
    }),
    side: overlay(SHORT.side, {
      4: "..HH............",
      5: ".HHh............",
      6: ".Hh.............",
      7: ".hh.............",
      8: "..h.............",
    }),
  },
  // Maria-chiquinha
  {
    front: overlay(SHORT.front, PIGTAILS),
    back: overlay(SHORT.back, PIGTAILS),
    side: overlay(SHORT.side, {
      5: "..H.............",
      6: ".HH.............",
      7: ".Hh.............",
      8: ".hh.............",
      9: "..h.............",
    }),
  },
  // Careca (só o brilho na cabeça)
  {
    front: ["", "", ".....KK.........", "....K..........."],
    back: ["", "", ".....KK.........", "....K..........."],
    side: ["", "", "......KK........", ".....K.........."],
  },
];

type Px = [number, number, keyof Colors];

/** Olhos na vista frontal: [aberto, piscando]. */
const EYES_FRONT: Array<[Px[], Px[]]> = [
  [
    [[5, 6, "E"], [5, 7, "E"], [10, 6, "E"], [10, 7, "E"]],
    [[5, 7, "E"], [10, 7, "E"]],
  ],
  [
    [[5, 6, "W"], [6, 6, "E"], [5, 7, "E"], [6, 7, "E"], [9, 6, "W"], [10, 6, "E"], [9, 7, "E"], [10, 7, "E"]],
    [[5, 7, "E"], [6, 7, "E"], [9, 7, "E"], [10, 7, "E"]],
  ],
  [
    [[4, 7, "E"], [5, 6, "E"], [6, 7, "E"], [9, 7, "E"], [10, 6, "E"], [11, 7, "E"]],
    [[4, 7, "E"], [5, 6, "E"], [6, 7, "E"], [9, 7, "E"], [10, 6, "E"], [11, 7, "E"]],
  ],
  [
    [[5, 5, "h"], [6, 5, "h"], [9, 5, "h"], [10, 5, "h"], [5, 7, "E"], [6, 7, "E"], [9, 7, "E"], [10, 7, "E"]],
    [[5, 5, "h"], [6, 5, "h"], [9, 5, "h"], [10, 5, "h"], [5, 7, "E"], [6, 7, "E"], [9, 7, "E"], [10, 7, "E"]],
  ],
];

/** Olhos na vista lateral (olhando para a direita). */
const EYES_SIDE: Array<[Px[], Px[]]> = [
  [[[10, 6, "E"], [10, 7, "E"]], [[10, 7, "E"]]],
  [[[10, 6, "W"], [11, 6, "E"], [10, 7, "E"], [11, 7, "E"]], [[10, 7, "E"], [11, 7, "E"]]],
  [[[9, 7, "E"], [10, 6, "E"], [11, 7, "E"]], [[9, 7, "E"], [10, 6, "E"], [11, 7, "E"]]],
  [[[10, 5, "h"], [11, 5, "h"], [10, 7, "E"], [11, 7, "E"]], [[10, 5, "h"], [11, 5, "h"], [10, 7, "E"], [11, 7, "E"]]],
];

function drawPixels(cv: PixelCanvas, pixels: readonly Px[], col: Colors, dy: number) {
  for (const [x, y, key] of pixels) cv.set(x, y + dy, col[key]);
}

function drawHead(cv: PixelCanvas, view: View, a: Appearance, col: Colors, pose: Pose, dy: number) {
  const female = a.body === "female";
  cv.ascii(0, dy, HEAD_BASE, col);
  if (view === "side") cv.set(7, 6 + dy, col.s); // orelha
  if (view === "front" && female) cv.set(4, 7 + dy, col.R).set(11, 7 + dy, col.R); // bochechas

  cv.ascii(0, dy, HAIR_STYLES[a.hairStyle][view], col);

  if (view === "back") return;
  const [open, closed] = (view === "front" ? EYES_FRONT : EYES_SIDE)[a.eyes];
  drawPixels(cv, pose.eyesClosed ? closed : open, col, dy);
  // Cílios (feminino), no canto externo do olho aberto
  if (female && !pose.eyesClosed && a.eyes !== EYES.happy) {
    const y = (a.eyes === EYES.serious ? 7 : 6) + dy;
    if (view === "front") {
      cv.set(4, y, col.E).set(11, y, col.E);
    } else if (a.eyes === EYES.classic) {
      cv.set(11, y, col.E);
    }
  }
}

// --- corpo -----------------------------------------------------------------

function shoePixels(a: Appearance, col: Colors, width: 2 | 3): number[] {
  const { B, b, S, W } = col;
  switch (a.shoes) {
    case SHOE.formal:
      return width === 2 ? [b, B] : [B, B, b];
    case SHOE.sandal:
      return width === 2 ? [B, S] : [S, B, S];
    case SHOE.boot:
      return width === 2 ? [b, B] : [B, B, B];
    default:
      return width === 2 ? [B, B] : [B, B, W];
  }
}

function drawFrontBack(cv: PixelCanvas, a: Appearance, col: Colors, pose: Pose, back: boolean) {
  const female = a.body === "female";
  const dress = a.outfit === OUTFIT.dress;
  const y0 = pose.sitting ? 1 : 0;
  const t = 9 + y0; // tronco: linhas t..t+2
  const l = 12 + y0; // quadril: linha l; pernas l+1; pés l+2
  const x0 = female ? 5 : 4;
  const x1 = female ? 10 : 11;

  // pernas e pés
  const legColor = dress ? col.S : col.P;
  const legShade = dress ? col.s : col.p;
  const hip = dress ? col.C : col.P;
  if (pose.sitting) {
    if (back) {
      cv.rect(x0, l, x1 - x0 + 1, 1, hip);
    } else {
      cv.rect(x0, l, x1 - x0 + 1, 1, dress ? col.c : legShade);
      cv.rect(5, l, 2, 1, dress ? col.C : legColor).rect(9, l, 2, 1, dress ? col.C : legColor);
      const [s0, s1] = shoePixels(a, col, 2);
      for (const x of [5, 9]) cv.set(x, l + 1, s0).set(x + 1, l + 1, s1);
    }
  } else {
    if (dress) {
      cv.rect(3, l, 10, 1, col.C);
      cv.set(3, l, col.c).set(12, l, col.c);
    } else {
      cv.rect(x0, l, x1 - x0 + 1, 1, col.P);
      cv.set(x0, l, col.p).set(x1, l, col.p);
    }
    const [s0, s1] = shoePixels(a, col, 2);
    const leg = (x: number, lifted: boolean) => {
      if (lifted) {
        cv.set(x, l + 1, s0).set(x + 1, l + 1, s1);
        return;
      }
      if (a.shoes === SHOE.boot) cv.set(x, l + 1, col.B).set(x + 1, l + 1, darken(col.B, 0.15));
      else cv.set(x, l + 1, legColor).set(x + 1, l + 1, legShade);
      cv.set(x, l + 2, s0).set(x + 1, l + 2, s1);
    };
    leg(5, pose.step === -1);
    leg(9, pose.step === 1);
  }

  // tronco
  cv.rect(x0, t, x1 - x0 + 1, 3, col.C);
  cv.rect(x0, t + 2, x1 - x0 + 1, 1, col.c);
  if (!back) cv.set(x0 + 1, t, col.l).set(x0 + 2, t, col.l);

  if (!back) {
    switch (a.outfit) {
      case OUTFIT.tshirt:
        cv.set(7, t, col.c).set(8, t, col.c);
        break;
      case OUTFIT.hoodie:
        cv.rect(x0 + 1, t, x1 - x0 - 1, 1, col.c);
        cv.set(6, t + 1, col.l).set(9, t + 1, col.l);
        break;
      case OUTFIT.dressShirt:
        cv.set(6, t, lighten(col.C, 0.55)).set(9, t, lighten(col.C, 0.55));
        cv.set(7, t, col.c).set(8, t, col.c);
        cv.set(8, t + 1, col.c);
        break;
      case OUTFIT.suit:
        cv.set(6, t, col.c).set(9, t, col.c);
        // camisa em V + gravata comprida (2 linhas, para não parecer boca)
        cv.set(7, t, col.W).set(8, t, col.T);
        cv.set(7, t + 1, col.W).set(8, t + 1, col.T);
        cv.set(8, t + 2, darken(col.T, 0.2));
        break;
      case OUTFIT.dress:
        cv.set(7, t, col.S).set(8, t, col.S); // decote
        cv.rect(x0, t + 2, x1 - x0 + 1, 1, col.c); // cintura
        break;
    }
  } else if (a.outfit === OUTFIT.hoodie) {
    cv.rect(6, t - 1, 4, 1, col.c); // capuz nas costas
    cv.rect(x0 + 1, t, x1 - x0 - 1, 1, col.c);
  }

  // braços (balançam em oposição)
  const arm = (x: number, lift: number) => {
    const y = t + lift;
    const sleeve = a.outfit === OUTFIT.tshirt ? 1 : a.outfit === OUTFIT.dress ? 0 : 2;
    for (let i = 0; i < 3; i++) {
      cv.set(x, y + i, i < sleeve && i < 2 ? col.c : col.S);
    }
  };
  arm(x0 - 1, pose.swing === 1 ? -1 : 0);
  arm(x1 + 1, pose.swing === -1 ? -1 : 0);

  drawHead(cv, back ? "back" : "front", a, col, pose, y0);
}

/** Vista lateral olhando para a direita (a esquerda é espelhada). */
function drawSide(cv: PixelCanvas, a: Appearance, col: Colors, pose: Pose) {
  const female = a.body === "female";
  const dress = a.outfit === OUTFIT.dress;
  const y0 = pose.sitting ? 1 : 0;
  const t = 9 + y0;
  const l = 12 + y0;
  const x0 = female ? 6 : 5;
  const legColor = dress ? col.S : col.P;
  const shoes = shoePixels(a, col, 3);
  const boot = a.shoes === SHOE.boot;

  const foot = (x: number, y: number, dim: boolean) =>
    shoes.forEach((c, i) => cv.set(x + i, y, dim ? darken(c, 0.2) : c));

  if (pose.sitting) {
    cv.rect(5, l, 7, 1, dress ? col.C : legColor); // coxa na horizontal
    cv.rect(10, l + 1, 2, 1, boot ? col.B : legColor);
    foot(10, l + 2, false);
  } else {
    const backX = pose.step === 0 ? 6 : pose.step === -1 ? 8 : 5;
    const frontX = pose.step === 0 ? 8 : pose.step === -1 ? 5 : 9;
    cv.rect(backX, l + 1, 2, 1, boot ? darken(col.B, 0.2) : darken(legColor, 0.25));
    foot(backX, l + 2, true);
    if (dress) cv.rect(4, l, 8, 1, col.C).set(4, l, col.c);
    else cv.rect(5, l, 6, 1, col.P);
    cv.rect(frontX, l + 1, 2, 1, boot ? col.B : legColor);
    foot(frontX, l + 2, false);
  }

  cv.rect(x0, t, 11 - x0, 3, col.C);
  cv.rect(x0, t + 2, 11 - x0, 1, col.c);
  cv.rect(9, t, 2, 1, col.l);
  if (a.outfit === OUTFIT.suit) cv.set(10, t, col.W).set(10, t + 1, col.T);
  if (a.outfit === OUTFIT.dressShirt) cv.set(10, t, lighten(col.C, 0.55));
  if (a.outfit === OUTFIT.dress) cv.set(10, t, col.S);

  drawHead(cv, "side", a, col, pose, y0);
  if (a.outfit === OUTFIT.hoodie) cv.set(4, t - 1, col.c).set(5, t - 1, col.c); // capuz

  // braço da frente
  const ax = 7 + (pose.sitting ? 1 : pose.swing);
  const sleeve = a.outfit === OUTFIT.tshirt ? 1 : a.outfit === OUTFIT.dress ? 0 : 2;
  for (let i = 0; i < 3; i++) {
    const color = i < sleeve ? col.c : col.S;
    cv.set(ax, t + i, color).set(ax + 1, t + i, i < sleeve ? col.c : i === 2 ? col.S : col.s);
  }
}

/** Desenha um frame (16 × 16 virtuais) já com contorno e sombra. */
export function drawCharacterFrame(dir: Direction, pose: Pose, appearance: Appearance): PixelCanvas {
  const col = colorsFor(appearance);
  const cv = new PixelCanvas(N, N);
  if (dir === "down") drawFrontBack(cv, appearance, col, pose, false);
  else if (dir === "up") drawFrontBack(cv, appearance, col, pose, true);
  else drawSide(cv, appearance, col, pose);

  let out = cv;
  if (dir === "left") {
    out = new PixelCanvas(N, N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const c = cv.get(x, y);
        if (c >= 0) out.set(N - 1 - x, y, c);
      }
    }
  }
  out.outline();
  if (!pose.sitting) out.shadow(8, 15, 5, 1.2);
  return out;
}

/** Sheet completo de um personagem (8 colunas × 4 direções). */
export function renderCharacterSheet(appearance: Appearance): RgbaImage {
  const scale = TILE_SIZE / N;
  const image = createImage(TILE_SIZE * POSES.length, TILE_SIZE * DIRECTIONS.length);
  DIRECTIONS.forEach((dir, row) => {
    POSES.forEach((pose, col) => {
      drawCharacterFrame(dir, pose, appearance).blit(image.data, image.width, col * TILE_SIZE, row * TILE_SIZE, scale);
    });
  });
  return image;
}

/** Um frame isolado em RGBA (ex.: prévia na tela de entrada e avatar). */
export function renderCharacterFrame(appearance: Appearance, dir: Direction, column: number, scale = 1): RgbaImage {
  const image = createImage(N * scale, N * scale);
  drawCharacterFrame(dir, POSES[column] ?? NEUTRAL, appearance).blit(image.data, image.width, 0, 0, scale);
  return image;
}
