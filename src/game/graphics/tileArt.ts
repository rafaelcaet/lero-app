/**
 * Tileset do escritório em pixel art no estilo GBA (16 × 16 pixels virtuais,
 * ampliados para TILE_SIZE). Puro: gera um buffer RGBA sem Phaser.
 */
import { TILE_SIZE } from "../constants.ts";
import { Tile, TILESET_TILE_COUNT } from "../maps/tiles.ts";
import { createImage, darken, PixelCanvas, type RgbaImage } from "./pixelArt.ts";

/** Resolução da arte de cada tile, em pixels virtuais. */
export const ART_SIZE = 16;
const N = ART_SIZE;

// --- pisos (sem contorno, emendam sem costura) ------------------------------

function woodFloor(c: PixelCanvas) {
  const light = 0xecc690;
  const mid = 0xdcae72;
  const grain = 0xcfa066;
  const seam = 0xb07c46;
  // Tábuas horizontais de 4 px; só algumas têm emenda vertical (tábuas longas).
  const joints: Array<number | null> = [4, null, 12, null];
  const grains: Array<[number, number]> = [[9, 1], [10, 1], [11, 1], [2, 5], [3, 5], [12, 6], [13, 6], [6, 9], [7, 9], [1, 13], [2, 13], [9, 14], [10, 14], [11, 14]];
  c.paint((x, y) => {
    const plank = Math.floor(y / 4);
    const row = y % 4;
    const joint = joints[plank];
    if (row === 3 || x === joint) return seam;
    if (row === 0 || (joint !== null && x === (joint + 1) % N)) return light;
    return mid;
  });
  for (const [x, y] of grains) if (c.get(x, y) === mid) c.set(x, y, grain);
}

function carpet(c: PixelCanvas) {
  const base = 0x6a8cc8;
  const light = 0x86a6dc;
  const dark = 0x5874b0;
  // Padrão de losangos com período de 8 px.
  c.paint((x, y) => {
    const px = x % 8;
    const py = y % 8;
    const d = Math.abs(px - 4) + Math.abs(py - 4);
    if (d === 2) return light;
    if (d === 0) return dark;
    if ((px + py) % 2 === 0 && d >= 4) return dark;
    return base;
  });
}

function rug(c: PixelCanvas) {
  const base = 0xc04850;
  const baseLight = 0xcc5a5c;
  const line = 0xd88a62;
  const lineShade = 0x9c3440;
  const motif = 0xe8c080;
  const motifShade = 0x8c2c3c;
  // Treliça de losangos com período de 16 px e uma flor no centro de cada um.
  c.paint((x, y) => {
    const a = (x + y) % 16;
    const b = (x - y + 16) % 16;
    if (a === 0 || b === 0) return line;
    if (a === 1 || b === 15) return lineShade;
    const d = Math.min(
      Math.abs(x - 8) + Math.abs(y),
      Math.abs(x - 8) + Math.abs(y - 16),
      Math.abs(x) + Math.abs(y - 8),
      Math.abs(x - 16) + Math.abs(y - 8),
    );
    if (d === 0) return motif;
    if (d === 1) return motifShade;
    if (d === 2 && (x + y) % 2 === 0) return motif;
    return d >= 5 ? baseLight : base;
  });
}

// --- paredes ---------------------------------------------------------------

function wallTop(c: PixelCanvas) {
  const base = 0x5a6080;
  const light = 0x737a9c;
  const mortar = 0x3c405a;
  // Blocos de 8 × 4, desencontrados a cada fileira.
  c.paint((x, y) => {
    const row = Math.floor(y / 4);
    const offset = row % 2 === 0 ? 0 : 4;
    const bx = (x + offset) % 8;
    if (y % 4 === 3 || bx === 7) return mortar;
    if (y % 4 === 0 || bx === 0) return light;
    return base;
  });
}

function wallFace(c: PixelCanvas) {
  const trimLight = 0x9a6a40;
  const trim = 0x7a4c2c;
  const paper = 0xf4ecd4;
  const stripe = 0xe4d8b8;
  const paperShade = 0xd8caa6;
  const wood = 0xcc945c;
  const woodLight = 0xdcac74;
  const woodDark = 0xa86e3c;
  const base = 0x6e4426;
  c.paint((x, y) => {
    if (y === 0) return trimLight;
    if (y === 1) return trim;
    if (y === 2) return paperShade; // sombra do rodateto
    if (y <= 8) return x % 4 === 1 ? stripe : paper;
    if (y === 9) return woodLight; // borda do lambri
    if (y <= 13) {
      // Painéis de 8 px com moldura
      const px = x % 8;
      if (px === 0) return woodDark;
      if (px === 1 || y === 10) return woodLight;
      return wood;
    }
    if (y === 14) return base;
    return 0x4c2e1a;
  });
}

// --- objetos (com contorno) ------------------------------------------------

function desk(c: PixelCanvas) {
  const top = 0xd49a5c;
  const topLight = 0xe8b878;
  const topShade = 0xbc8448;
  const front = 0x9c6232;
  const frontDark = 0x7a4824;
  // Tampo (emenda na horizontal com a mesa vizinha)
  c.rect(0, 6, N, 1, topLight);
  c.rect(0, 7, N, 5, top);
  c.rect(0, 11, N, 1, topShade);
  c.rect(0, 12, N, 2, front);
  c.rect(0, 14, N, 1, frontDark);
  // Teclado
  c.ascii(4, 9, ["kkkkkkkk", "KKKKKKKK"], { k: 0xe8e8f0, K: 0xa8a8b8 });
  // Monitor
  c.ascii(3, 0, [
    ".gggggggg.",
    "gGsssssssg",
    "gsLLssssDg",
    "gsLssssDDg",
    "gssssDDDDg",
    "gGGGGGGGGg",
    "....hh....",
    "...hHHh...",
  ], {
    g: 0x9898a8,
    G: 0xc8c8d8,
    s: 0x58a8e8,
    L: 0xb8e8ff,
    D: 0x3c78c0,
    h: 0x707080,
    H: 0x585868,
  });
  c.outline();
}

function chair(c: PixelCanvas) {
  c.ascii(0, 0, [
    "................",
    "................",
    ".....BBBBBB.....",
    "....BLLBBBBB....",
    "....BLBBBBBb....",
    "....BBBBBBBb....",
    "....bBBBBBbb....",
    ".....bbbbbb.....",
    "...SSSSSSSSSS...",
    "...SLLSSSSSSs...",
    "....ssssssss....",
    ".......pp.......",
    ".......pP.......",
    "....dddddddd....",
    "....w......w....",
    "................",
  ], {
    B: 0x4a6cd0,
    L: 0x88aaf4,
    b: 0x3450a4,
    S: 0x5a7cdc,
    s: 0x3c5aac,
    p: 0x8890a0,
    P: 0x606878,
    d: 0x4c5060,
    w: 0x2c2c38,
  });
  c.outline();
}

function plant(c: PixelCanvas) {
  c.ascii(0, 0, [
    "................",
    "......gGGg......",
    "....gGGLLGGg....",
    "...gGLLGGGGGg...",
    "..gGGLGGdGGLGg..",
    "..GGGGGdGGGGGd..",
    "..gGLGGGGGLGdd..",
    "...dGGGdGGGddd..",
    "....ddGGGddd....",
    "....OOOOOOOO....",
    "....RRRRRRRr....",
    ".....oOOOOor....",
    ".....oOOOOor....",
    "......orrrr.....",
    "................",
    "................",
  ], {
    G: 0x48a858,
    L: 0x88d878,
    g: 0x2e8a48,
    d: 0x24683c,
    O: 0xd07848,
    o: 0xe89868,
    R: 0xb05c34,
    r: 0x8c4426,
  });
  c.outline();
  c.shadow(8, 14, 5, 1.6);
}

function bookshelf(c: PixelCanvas) {
  const frameLight = 0xb07a44;
  const frame = 0x8c5a30;
  const frameDark = 0x6a4020;
  const inside = 0x3c2414;
  c.rect(0, 0, N, N, frame);
  c.rect(0, 0, N, 1, frameLight);
  c.rect(0, 15, N, 1, frameDark);
  c.rect(15, 1, 1, 14, frameDark);
  c.rect(0, 1, 1, 14, frameLight);
  // Dois nichos: linhas 2–6 e 9–13
  const books = [0xd85050, 0x4c84d8, 0xe8c048, 0x58b068, 0xa868c8, 0xe88848, 0x50b0b0];
  for (const [y0, seed] of [[2, 0], [9, 3]] as const) {
    c.rect(1, y0, 14, 5, inside);
    let x = 1;
    let i = seed;
    while (x < 15) {
      const color = books[i % books.length];
      const h = 5 - ((i * 7) % 3 === 0 ? 1 : 0);
      const w = Math.min(i % 4 === 2 ? 3 : 2, 15 - x);
      c.rect(x, y0 + 5 - h, w, h, color);
      c.rect(x + w - 1, y0 + 5 - h, 1, h, darken(color, 0.28));
      c.set(x, y0 + 5 - h + 1, 0xf8f0e0); // etiqueta na lombada
      x += w;
      i++;
    }
    c.rect(1, y0 + 5, 14, 1, frameLight); // prateleira
  }
  c.rect(1, 1, 14, 1, frame);
  c.rect(1, 8, 14, 1, frame);
}

function collision(c: PixelCanvas) {
  c.paint(() => 0xff0044);
  c.alpha.fill(100);
}

const painters: Partial<Record<number, (c: PixelCanvas) => void>> = {
  [Tile.FLOOR_WOOD]: woodFloor,
  [Tile.FLOOR_CARPET]: carpet,
  [Tile.WALL_TOP]: wallTop,
  [Tile.WALL_FACE]: wallFace,
  [Tile.DESK]: desk,
  [Tile.CHAIR]: chair,
  [Tile.PLANT]: plant,
  [Tile.BOOKSHELF]: bookshelf,
  [Tile.RUG]: rug,
  [Tile.COLLISION]: collision,
};

/** Tileset completo numa faixa horizontal: frame = gid - 1. */
export function renderTileset(): RgbaImage {
  const scale = TILE_SIZE / N;
  const image = createImage(TILE_SIZE * TILESET_TILE_COUNT, TILE_SIZE);
  for (let gid = 1; gid <= TILESET_TILE_COUNT; gid++) {
    const canvas = new PixelCanvas(N, N);
    painters[gid]?.(canvas);
    canvas.blit(image.data, image.width, (gid - 1) * TILE_SIZE, 0, scale);
  }
  return image;
}
