/**
 * Fantasias da loja em pixel art (16 × 16 virtuais), desenhadas como camadas
 * sobre o personagem de characterArt.ts. Cada fantasia pode:
 *  - forçar campos da aparência (estilo de roupa, sapato, olhos…) e cores;
 *  - trocar o formato da cabeça, o cabelo (máscaras, capacetes) e os olhos;
 *  - desenhar atrás do corpo (capas), sobre o tronco (emblemas, cintos),
 *    sobre a cabeça (chapéus, sorrisos) e por cima de tudo (barba, cajado).
 *
 * Coordenadas como no resto da arte: cabeça nas linhas 0–8 (+ `dy`), tronco em
 * `t..t+2`, quadril em `l`, pernas em `l+1` e pés em `l+2`. A vista lateral olha
 * para a direita (a esquerda é espelhada). Puro, sem Phaser.
 */
import type { Appearance } from "../../shared/appearance.ts";
import type { CostumeId } from "../../shared/costumes.ts";
import type { PixelCanvas } from "../graphics/pixelArt.ts";
import type { Colors, Pose, Px, View } from "./characterArt.ts";

export interface DrawCtx {
  view: View;
  /** Primeira linha do tronco. */
  t: number;
  /** Linha do quadril. */
  l: number;
  /** Colunas das bordas do tronco (na lateral, x1 é a frente). */
  x0: number;
  x1: number;
  /** Deslocamento vertical da cabeça (sentado, cochilando). */
  dy: number;
  pose: Pose;
  /** Cores do personagem já com as da fantasia e a paleta extra. */
  col: Colors;
}

type Rows = Partial<Record<View, readonly string[]>>;
type Eyes = Partial<Record<"front" | "side", [open: Px[], closed: Px[]]>>;

export interface CostumeArt {
  appearance?: Partial<Omit<Appearance, "body">>;
  colors?: { skin?: number; top?: number; pants?: number; shoe?: number; hair?: number };
  /** Cores extras, usadas pelas letras das camadas abaixo. */
  palette?: Record<string, number>;
  /** Formato da cabeça (no lugar da cabeça redonda). */
  head?: Rows;
  /** No lugar do cabelo (máscara, capacete). Linhas vazias = sem cabelo. */
  hair?: Rows;
  eyes?: Eyes;
  /** Quantos pixels do braço a manga cobre (0–2). */
  sleeve?: 0 | 1 | 2;
  sleeveColor?: number;
  /** Cor das mãos (luvas). */
  hands?: number;
  /** Cor das pernas entre o quadril e o pé (meião, manto). */
  legs?: number;
  behind?(cv: PixelCanvas, ctx: DrawCtx): void;
  torso?(cv: PixelCanvas, ctx: DrawCtx): void;
  headOver?(cv: PixelCanvas, ctx: DrawCtx): void;
  over?(cv: PixelCanvas, ctx: DrawCtx): void;
}

const NO_HAIR: Rows = { front: [], back: [], side: [] };

/** Linhas de arte com deslocamento vertical (`.` = não mexe). */
function art(cv: PixelCanvas, ctx: DrawCtx, rows: readonly string[], dy = ctx.dy) {
  cv.ascii(0, dy, rows, ctx.col);
}

/** Cinto na última linha do tronco, em qualquer vista. */
function belt(cv: PixelCanvas, { t, x0, x1 }: DrawCtx, color: number) {
  cv.rect(x0, t + 2, x1 - x0 + 1, 1, color);
}

/** Capa: aparece dos lados (de frente), cobre as costas (de costas) e fica atrás (de lado). */
function capeBehind(cv: PixelCanvas, { view, t, l }: DrawCtx, color: number) {
  if (view === "front") cv.rect(2, t, 12, l + 2 - t, color);
  else if (view === "side") cv.rect(3, t, 2, l + 2 - t, color);
}
function capeOverBack(cv: PixelCanvas, { view, t, l }: DrawCtx, color: number, fold: number) {
  if (view !== "back") return;
  cv.rect(3, t, 10, l + 2 - t, color);
  for (let y = t + 1; y < l + 2; y++) cv.set(5, y, fold).set(10, y, fold);
}

/** Camisa amarela da seleção: gola verde e o 10 nas costas. */
function brazilJersey(cv: PixelCanvas, ctx: DrawCtx) {
  const { view, t, col } = ctx;
  if (view === "front") cv.set(7, t, col.V).set(8, t, col.V);
  else if (view === "side") cv.set(10, t, col.V);
  else {
    cv.set(6, t, col.V).set(6, t + 1, col.V); // 1
    cv.rect(8, t, 2, 2, col.V).set(8, t, col.C); // 0
  }
}

const BRAZIL = {
  appearance: { outfit: 0, shoes: 0 },
  colors: { top: 0xf6d22a, pants: 0x2a50b0, shoe: 0x26262c },
  sleeve: 1,
  sleeveColor: 0x1a9a48,
  legs: 0xf4f4f4, // meião branco
  torso: brazilJersey,
} satisfies Partial<CostumeArt>;

export const COSTUME_ART: Record<CostumeId, CostumeArt> = {
  // --- Flash: máscara vermelha com asinhas, raio no peito, botas amarelas ---
  flash: {
    appearance: { outfit: 0, shoes: 2 },
    colors: { top: 0xd02828, pants: 0xd02828, shoe: 0xf0c020 },
    palette: { M: 0xd02828, m: 0x981818, Y: 0xf8d030, y: 0xc89810 },
    sleeve: 2,
    hands: 0xd02828,
    hair: {
      front: [
        "................",
        ".....MMMMMM.....",
        "....MlMMMMMM....",
        "...MlMMMMMMMm...",
        "..YMMMMMMMMMmY..",
        ".YyMMMMMMMMMMyY.",
        "...MMMMMMMMMm...",
      ],
      back: [
        "................",
        ".....MMMMMM.....",
        "....MlMMMMMM....",
        "...MlMMMMMMMm...",
        "..YMMMMMMMMMmY..",
        ".YyMMMMMMMMMMyY.",
        "...MMMMMMMMMm...",
        "...mMMMMMMMMm...",
        "....mmMMMMmm....",
      ],
      side: [
        "................",
        ".....MMMMMM.....",
        "....MlMMMMMM....",
        "...MlMMMMMMMM...",
        "...MMMMYMMMMm...",
        "...MMMYyMMMMM...",
        "...MMMMMMMMMM...",
        "...mMMMM........",
        "....mm..........",
      ],
    },
    torso(cv, ctx) {
      const { view, t, col } = ctx;
      if (view === "front") cv.set(7, t, col.W).set(8, t, col.Y).set(7, t + 1, col.Y).set(8, t + 1, col.W);
      else if (view === "side") cv.set(10, t, col.Y);
      belt(cv, ctx, col.Y);
    },
  },

  // --- Batman: capuz com orelhas, olhos brancos, capa, cinto e morcego ---
  batman: {
    appearance: { outfit: 0, shoes: 2 },
    colors: { top: 0x5a5e6a, pants: 0x5a5e6a, shoe: 0x22222a },
    palette: { M: 0x2a2a34, m: 0x1a1a22, Y: 0xf0c838, A: 0x24242e, a: 0x16161e },
    sleeve: 2,
    hands: 0x22222a,
    hair: {
      front: [
        "....M......M....",
        "....MMMMMMMM....",
        "....MMMMMMMM....",
        "...MMMMMMMMMM...",
        "...MMMMMMMMMM...",
        "...MMMMMMMMMM...",
        "...MMMMMMMMMM...",
        "...MM......MM...",
      ],
      back: [
        "....M......M....",
        "....MMMMMMMM....",
        "....MMMMMMMM....",
        "...MMMMMMMMMM...",
        "...MMMMMMMMMM...",
        "...MMMMMMMMMM...",
        "...MMMMMMMMMM...",
        "...MMMMMMMMMM...",
        "....MMMMMMMM....",
      ],
      side: [
        ".....M..........",
        ".....MMMMMM.....",
        "....MMMMMMMM....",
        "...MMMMMMMMMM...",
        "...MMMMMMMMMM...",
        "...MMMMMMMMMM...",
        "...MMMMMMMMMM...",
        "...MMMMMM.......",
        "....MM..........",
      ],
    },
    eyes: {
      front: [
        [[5, 6, "W"], [6, 6, "W"], [9, 6, "W"], [10, 6, "W"]],
        [[5, 6, "m"], [6, 6, "m"], [9, 6, "m"], [10, 6, "m"]],
      ],
      side: [[[10, 6, "W"], [11, 6, "W"]], [[10, 6, "m"], [11, 6, "m"]]],
    },
    behind: (cv, ctx) => capeBehind(cv, ctx, ctx.col.A),
    torso(cv, ctx) {
      const { view, t, col } = ctx;
      if (view === "front") cv.set(6, t, col.Y).set(7, t, col.m).set(8, t, col.m).set(9, t, col.Y);
      else if (view === "side") cv.set(10, t, col.Y);
      belt(cv, ctx, col.Y);
    },
    over: (cv, ctx) => capeOverBack(cv, ctx, ctx.col.A, ctx.col.a),
  },

  // --- Majin Boo: pele rosa, antena, colete preto, calça branca bufante, capa roxa ---
  majinboo: {
    appearance: { outfit: 0, shoes: 2, eyes: 3 },
    colors: { skin: 0xf4a0c4, top: 0x2a2232, pants: 0xf4f4fa, shoe: 0xe8b838 },
    palette: { Y: 0xe8b838, V: 0x6a3aa0, v: 0x4a2878 },
    sleeve: 0,
    hands: 0xf8f8f8,
    hair: {
      front: ["......sSS......."],
      back: [".......SSs......"],
      side: ["...sSS..........", "..s............."],
    },
    behind: (cv, ctx) => capeBehind(cv, ctx, ctx.col.V),
    torso(cv, ctx) {
      const { view, t, l, x0, x1, col } = ctx;
      // Colete aberto mostrando o peito.
      if (view === "front") cv.rect(7, t, 2, 2, col.S);
      else if (view === "side") cv.set(10, t, col.S).set(10, t + 1, col.S);
      belt(cv, ctx, col.Y);
      if (view === "front") cv.set(7, t + 2, col.E).set(8, t + 2, col.E); // "M" do cinto
      // Calça bufante: o quadril passa um pixel de cada lado.
      if (view === "side") cv.rect(x0 - 1, l, x1 - x0 + 3, 1, col.P);
      else cv.rect(x0 - 1, l, x1 - x0 + 3, 1, col.P).set(x0 - 1, l, col.p).set(x1 + 1, l, col.p);
    },
    over: (cv, ctx) => capeOverBack(cv, ctx, ctx.col.V, ctx.col.v),
  },

  // --- Shrek: pele verde, orelhas de corneta, camisa creme e colete marrom ---
  shrek: {
    appearance: { outfit: 0, shoes: 2, eyes: 0 },
    colors: { skin: 0x8cbc48, top: 0x6a4426, pants: 0x7a5a36, shoe: 0x3a2818 },
    palette: { O: 0xe4d8b8, D: 0x3a2818 },
    sleeve: 2,
    sleeveColor: 0xe4d8b8,
    hair: {
      front: ["", "", "", ".s............s.", "..S..........S.."],
      back: ["", "", "", ".s............s.", "..S..........S.."],
      side: ["", "", "", "......s.........", ".......s........"],
    },
    torso(cv, ctx) {
      const { view, t, col } = ctx;
      if (view === "front") cv.rect(7, t, 2, 2, col.O);
      else if (view === "side") cv.set(10, t, col.O).set(10, t + 1, col.O);
      belt(cv, ctx, col.D);
    },
  },

  // --- Gandalf: manto cinza, cabelo e barba longos, chapéu pontudo e cajado ---
  gandalf: {
    appearance: { outfit: 4, hairStyle: 2, shoes: 2, eyes: 3 },
    colors: { top: 0x9a9aa8, hair: 0xd4d4dc, shoe: 0x4a3420 },
    palette: { G: 0x56566a, g: 0x3e3e4e, Z: 0xdcdce4, z: 0xb0b0ba, F: 0x8a5a34, f: 0x5a3a20 },
    sleeve: 2,
    legs: 0x86869a,
    headOver(cv, ctx) {
      const { view } = ctx;
      if (view === "side") {
        art(cv, ctx, [
          "....gG..........",
          ".....GGG........",
          ".....GGGGG......",
          "....GGGGGGG.....",
          "..GGGGGGGGGGGG..",
        ]);
      } else {
        art(cv, ctx, [
          "........GGg.....",
          ".......GGGg.....",
          "......GGGGGg....",
          ".....GGGGGGGg...",
          ".GGGGGGGGGGGGGg.",
        ]);
      }
    },
    over(cv, ctx) {
      const { view, dy, l, x0, x1, col } = ctx;
      // Barba por cima do peito.
      if (view === "front") {
        art(cv, ctx, ["", "", "", "", "", "", "", "....zZZZZZZz....", ".....ZZZZZZ.....", "......ZZZZz.....", "......ZZZz......", ".......Zz......."]);
      } else if (view === "side") {
        art(cv, ctx, ["", "", "", "", "", "", "", ".........ZZZ....", ".........ZZZ....", "..........Zz....", "..........Z....."]);
      }
      // Cajado na mão (de frente na direita da tela, de costas na esquerda).
      const x = view === "front" ? x1 + 2 : view === "back" ? x0 - 2 : 12;
      for (let y = dy + 3; y <= l + 2; y++) cv.set(x, y, col.F);
      cv.set(x, dy + 2, col.f).set(x, dy + 1, col.f).set(view === "back" ? x - 1 : x + 1, dy + 2, col.f);
    },
  },

  // --- Bomberman: capacete branco, rosto com olhos ovais, pompom rosa, macacão azul ---
  bomberman: {
    appearance: { outfit: 0, shoes: 2 },
    colors: { skin: 0xf6f6fa, top: 0x3060d0, pants: 0xf0f0f8, shoe: 0xf070a8 },
    palette: { O: 0xf8c8a0, Q: 0xf070a8, Y: 0xf0c838 },
    sleeve: 2,
    sleeveColor: 0xf0f0f8,
    hands: 0xf070a8,
    hair: {
      front: [".......QQ.......", "", "", "", "", "....OOOOOOOO....", "....OOOOOOOO....", "....OOOOOOOO...."],
      back: [".......QQ......."],
      side: [".......QQ.......", "", "", "", "", "........OOOO....", "........OOOO....", "........OOOO...."],
    },
    eyes: {
      front: [
        [[6, 5, "E"], [6, 6, "E"], [9, 5, "E"], [9, 6, "E"]],
        [[6, 6, "E"], [9, 6, "E"]],
      ],
      side: [[[10, 5, "E"], [10, 6, "E"]], [[10, 6, "E"]]],
    },
    torso(cv, ctx) {
      const { view, t, col } = ctx;
      belt(cv, ctx, col.E);
      if (view === "front") cv.set(7, t + 2, col.Y).set(8, t + 2, col.Y);
      else if (view === "side") cv.set(10, t + 2, col.Y);
    },
  },

  // --- Bob Esponja: cabeça quadrada com furinhos, olhos grandes, gravata e calça marrom ---
  spongebob: {
    appearance: { outfit: 0, shoes: 0 },
    colors: { skin: 0xf4e040, top: 0xf4f4f4, pants: 0x8a5a2a, shoe: 0x26262c },
    palette: { U: 0x3a7ad8, X: 0xd02828 },
    sleeve: 1,
    legs: 0xf8f8f8, // meia branca
    head: {
      front: [
        "................",
        "..SSSSSSSSSSSS..",
        "..SSsSSSSSSsSS..",
        "..SSSSSSSSSSSS..",
        "..SSSSSSSSSSSS..",
        "..SSSSSSSSSSSS..",
        "..SsSSSSSSSSSS..",
        "..SSSSSSSSSSsS..",
        "..SSSSSSSSSSSS..",
      ],
      back: [
        "................",
        "..SSSSSSSSSSSS..",
        "..SSSSSSsSSSSS..",
        "..SsSSSSSSSSSS..",
        "..SSSSSSSSSSsS..",
        "..SSSSSSSSSSSS..",
        "..SSSSsSSSSSSS..",
        "..SSSSSSSSSsSS..",
        "..SSSSSSSSSSSS..",
      ],
      side: [
        "................",
        "....SSSSSSSS....",
        "....SSsSSSSS....",
        "....SSSSSSSS....",
        "....SSSSSSSS....",
        "....SsSSSSSS....",
        "....SSSSSSSS....",
        "....SSSSSsSS....",
        "....SSSSSSSS....",
      ],
    },
    hair: NO_HAIR,
    eyes: {
      front: [
        [[5, 4, "W"], [6, 4, "W"], [5, 5, "W"], [6, 5, "U"], [9, 4, "W"], [10, 4, "W"], [9, 5, "U"], [10, 5, "W"]],
        [[5, 5, "E"], [6, 5, "E"], [9, 5, "E"], [10, 5, "E"]],
      ],
      side: [
        [[10, 4, "W"], [11, 4, "W"], [10, 5, "W"], [11, 5, "U"]],
        [[10, 5, "E"], [11, 5, "E"]],
      ],
    },
    headOver(cv, ctx) {
      const { view, dy, col } = ctx;
      // Sorriso com os dois dentes.
      if (view === "front") {
        cv.set(5, 6 + dy, col.E).set(10, 6 + dy, col.E);
        for (let x = 6; x <= 9; x++) cv.set(x, 7 + dy, col.E);
        cv.set(7, 8 + dy, col.W).set(8, 8 + dy, col.W);
      } else if (view === "side") {
        cv.set(10, 7 + dy, col.E).set(11, 7 + dy, col.E).set(11, 8 + dy, col.W);
      }
    },
    torso(cv, ctx) {
      const { view, t, x0, x1, col } = ctx;
      if (view === "front") cv.set(7, t, col.X).set(7, t + 1, col.X).set(6, t, col.W).set(8, t, col.W);
      else if (view === "side") cv.set(10, t, col.X).set(10, t + 1, col.X);
      // Calça até a cintura, com cinto de furinhos.
      belt(cv, ctx, col.P);
      if (view !== "side") for (let x = x0 + 1; x < x1; x += 2) cv.set(x, t + 2, col.E);
    },
  },

  // --- Neymar: camisa 10 da seleção e cabelo escuro com o topo descolorido ---
  neymar: {
    ...BRAZIL,
    appearance: { ...BRAZIL.appearance, eyes: 0 },
    colors: { ...BRAZIL.colors, skin: 0xd8a478, hair: 0x3a2a20 },
    palette: { N: 0xeacb6a, V: 0x1a9a48 },
    hair: {
      front: [
        "......NNNN......",
        ".....HNNNNH.....",
        "....hHNNNNHh....",
        "...h.HHHHHH.h...",
        "...h........h...",
      ],
      back: [
        "......NNNN......",
        ".....HNNNNH.....",
        "....hHNNNNHh....",
        "...hHHHHHHHHh...",
        "...hhHHHHHHhh...",
        "....h......h....",
      ],
      side: [
        ".......NNNN.....",
        ".....HHNNNNH....",
        "....hHHNNNNH....",
        "...hHHHHHHHH....",
        "...hhHHh........",
      ],
    },
  },

  // --- Ronaldinho: camisa 10, cabelão cacheado com faixa e o sorrisão ---
  ronaldinho: {
    ...BRAZIL,
    appearance: { ...BRAZIL.appearance, eyes: 2 },
    colors: { ...BRAZIL.colors, skin: 0x8a5634, hair: 0x1e1a1e },
    palette: { Q: 0xf4f4f4, V: 0x1a9a48 },
    hair: {
      front: [
        ".....HHHHHH.....",
        "....HHHHHHHH....",
        "...HHLHHHHLHH...",
        "..HQQQQQQQQQQH..",
        "..HH........HH..",
        "..HH........HH..",
        "..Hh........hH..",
        "..hH........Hh..",
        "..hh........hh..",
        "...h........h...",
      ],
      back: [
        ".....HHHHHH.....",
        "....HHHHHHHH....",
        "...HHLHHHHLHH...",
        "..HQQQQQQQQQQH..",
        "..HHHHHHHHHHHH..",
        "..HLHHHHHHHLHH..",
        "..HHHHHHHHHHHH..",
        "..hHHHHHHHHHHh..",
        "..hhHHHHHHHHhh..",
        "...hhhhhhhhhh...",
      ],
      side: [
        ".....HHHHHH.....",
        "....HHHHHHHH....",
        "...HHLHHHHHHH...",
        "..HQQQQQQQQQQ...",
        "..HHHHHHH.......",
        "..HHHHHH........",
        "..HHHHH.........",
        "..hHHH..........",
        "..hhh...........",
      ],
    },
    headOver(cv, { view, dy, col }) {
      // O sorrisão.
      if (view === "front") for (let x = 6; x <= 9; x++) cv.set(x, 8 + dy, col.W);
      else if (view === "side") cv.set(10, 8 + dy, col.W).set(11, 8 + dy, col.W);
    },
  },
};
