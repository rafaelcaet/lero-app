/**
 * Pixel art dos itens da loja (puro, sem Phaser): veículos (bicicleta e carro
 * conversível) e mascotes. Mesmo estilo dos personagens (GBA, 2× de escala).
 *
 * Layout de cada sheet: linhas = direções (down, left, right, up);
 * colunas = 2 frames (rodas girando / mascote pulando).
 */
import type { PetKind, RideKind } from "../../shared/shop.ts";
import { createImage, darken, lighten, PixelCanvas, type Palette, type RgbaImage } from "./pixelArt.ts";

export const GEAR_DIRECTIONS = ["down", "left", "right", "up"] as const;
export type GearDirection = (typeof GEAR_DIRECTIONS)[number];
export const GEAR_FRAMES = 2;
/** Pixels de tela por pixel virtual (igual aos personagens). */
export const GEAR_SCALE = 2;

export interface SheetSpec {
  /** Tamanho do frame em pixels virtuais. */
  width: number;
  height: number;
  /**
   * Quantos pixels virtuais o frame desce abaixo dos pés do personagem
   * (o sprite é ancorado pela base).
   */
  belowFeet: number;
  /** Quanto o personagem sobe (pixels virtuais) quando está no veículo. */
  lift?: number;
}

type Draw = (c: PixelCanvas, dir: GearDirection, frame: number) => void;

function renderSheet(spec: SheetSpec, draw: Draw): RgbaImage {
  const fw = spec.width * GEAR_SCALE;
  const fh = spec.height * GEAR_SCALE;
  const image = createImage(fw * GEAR_FRAMES, fh * GEAR_DIRECTIONS.length);
  GEAR_DIRECTIONS.forEach((dir, row) => {
    for (let frame = 0; frame < GEAR_FRAMES; frame++) {
      const c = new PixelCanvas(spec.width, spec.height);
      draw(c, dir, frame);
      c.blit(image.data, image.width, frame * fw, row * fh, GEAR_SCALE);
    }
  });
  return image;
}

/** Linha de Bresenham. */
function line(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, color: number) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    c.set(x0, y0, color);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

const TIRE = 0x30303c;
const TIRE_LIGHT = 0x585868;
const METAL = 0xb8c0cc;
const METAL_DARK = 0x6c7480;

/** Roda vista de lado (7 × 7), com raios que alternam por frame. */
function sideWheel(c: PixelCanvas, cx: number, cy: number, frame: number) {
  const rim = [
    "..TTT..",
    ".T...T.",
    "T.....T",
    "T.....T",
    "T.....T",
    ".T...T.",
    "..TTT..",
  ];
  c.ascii(cx - 3, cy - 3, rim, { T: TIRE });
  c.set(cx - 1, cy - 3, TIRE_LIGHT);
  const spokes = frame === 0 ? [[0, -1], [0, 1], [-1, 0], [1, 0], [0, -2], [0, 2], [-2, 0], [2, 0]] : [[-1, -1], [1, 1], [-1, 1], [1, -1], [-2, -2], [2, 2], [-2, 2], [2, -2]];
  for (const [dx, dy] of spokes) c.set(cx + dx, cy + dy, METAL_DARK);
  c.set(cx, cy, METAL);
}

// --- bicicleta ---------------------------------------------------------------

const BIKE = 0x3078d8;

export const RIDE_SPECS: Record<RideKind, SheetSpec> = {
  bike: { width: 22, height: 18, belowFeet: 2, lift: 2 },
  car: { width: 30, height: 20, belowFeet: 3, lift: 3 },
};

const drawBike: Draw = (c, dir, frame) => {
  const F = BIKE;
  const f = darken(BIKE, 0.3);
  const cx = 11;
  if (dir === "down" || dir === "up") {
    // De frente/de costas: guidão atravessado e uma roda no meio.
    const wheelTop = 12;
    for (let y = wheelTop; y < 18; y++) c.rect(cx - 1, y, 2, 1, TIRE);
    c.set(cx - 1, wheelTop + 1 + (frame % 2) * 3, TIRE_LIGHT);
    if (dir === "down") {
      c.rect(cx - 6, 10, 12, 1, METAL); // guidão
      c.set(cx - 7, 10, TIRE).set(cx + 6, 10, TIRE); // manoplas
      c.rect(cx - 1, 11, 2, 2, F); // garfo
      c.rect(cx - 1, 11, 2, 1, 0xf8e070); // farol
      c.rect(cx - 2, 12, 4, 1, f); // para-lama
    } else {
      c.set(cx - 7, 10, TIRE).set(cx + 6, 10, TIRE);
      c.rect(cx - 2, 11, 4, 1, METAL_DARK); // bagageiro
      c.rect(cx - 1, 12, 2, 1, 0xe83040); // refletor
    }
    c.outline();
    c.shadow(cx, 17.2, 3, 1);
    return;
  }

  // De lado (desenhado virado para a direita e espelhado para a esquerda).
  const draw = (x: number) => (dir === "left" ? c.width - 1 - x : x);
  const L = (x0: number, y0: number, x1: number, y1: number, color: number) =>
    line(c, draw(x0), y0, draw(x1), y1, color);
  const rearX = 5;
  const frontX = 17;
  const axleY = 14;
  sideWheel(c, draw(rearX), axleY, frame);
  sideWheel(c, draw(frontX), axleY, frame);
  L(rearX, axleY, 10, axleY, F); // corrente
  L(rearX, axleY, 8, 9, F); // traseira até o selim
  L(8, 9, 10, axleY, F); // tubo do selim
  L(10, axleY, 15, 9, F); // tubo inferior
  L(8, 9, 15, 9, f); // tubo superior
  L(15, 8, frontX, axleY, METAL_DARK); // garfo
  L(14, 7, 16, 7, METAL); // guidão
  c.set(draw(16), 7, TIRE);
  c.rect(Math.min(draw(7), draw(9)), 8, 3, 1, 0x282830); // selim
  c.set(draw(10), axleY, METAL); // pedivela
  c.set(draw(10), axleY + 1 - frame * 2, METAL_DARK);
  c.outline();
  c.shadow(11, 17.4, 9, 1);
};

// --- carro conversível -------------------------------------------------------

const CAR = 0xd83a3a;

const drawCar: Draw = (c, dir, frame) => {
  const B = CAR;
  const b = darken(CAR, 0.28);
  const hi = lighten(CAR, 0.35);
  const glass = 0xa8d8f8;
  const cx = 15;

  if (dir === "down" || dir === "up") {
    // De frente/de costas: carroceria larga cobrindo o motorista da cintura para baixo.
    const left = cx - 10;
    const w = 20;
    // Rodas nos cantos.
    c.rect(left, 15, 3, 4, TIRE).rect(left + w - 3, 15, 3, 4, TIRE);
    c.set(left + 1, 15 + frame, TIRE_LIGHT).set(left + w - 2, 15 + frame, TIRE_LIGHT);
    c.rect(left, 10, w, 6, B);
    c.rect(left, 10, w, 1, hi);
    c.rect(left, 15, w, 1, b);
    if (dir === "down") {
      // Para-brisa transparente na frente do motorista.
      for (let x = left + 3; x < left + w - 3; x++) {
        for (let y = 8; y < 10; y++) c.set(x, y, glass, 80);
      }
      c.rect(left + 3, 7, w - 6, 1, METAL_DARK);
      c.rect(left + 3, 7, 1, 3, METAL_DARK).rect(left + w - 4, 7, 1, 3, METAL_DARK);
      c.rect(left + 1, 12, 3, 2, 0xf8f0a0).rect(left + w - 4, 12, 3, 2, 0xf8f0a0); // faróis
      c.rect(left + 6, 12, w - 12, 2, 0x40404c); // grade
      for (let x = left + 7; x < left + w - 6; x += 2) c.set(x, 12, METAL_DARK);
    } else {
      c.rect(left + 1, 12, 3, 2, 0xff3040).rect(left + w - 4, 12, 3, 2, 0xff3040); // lanternas
      c.rect(left + 7, 12, w - 14, 2, 0xe8e8e0); // placa
      c.rect(left + 8, 13, w - 16, 1, 0x505060);
    }
    c.rect(left, 16, w, 1, METAL); // para-choque
    c.outline();
    c.shadow(cx, 18.6, 11, 1.2);
    return;
  }

  // De lado (virado para a direita).
  const draw = (x: number) => (dir === "left" ? c.width - 1 - x : x);
  const R = (x: number, y: number, w: number, h: number, color: number, alpha = 255) => {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) c.set(draw(xx), yy, color, alpha);
    }
  };
  // Carroceria: porta-malas (esq.) mais alto, capô (dir.) descendo.
  R(2, 10, 26, 5, B);
  R(1, 11, 1, 3, B);
  R(28, 11, 1, 3, B);
  R(2, 10, 7, 1, hi);
  R(20, 10, 8, 1, hi);
  R(9, 10, 11, 1, b); // borda do habitáculo
  R(2, 14, 26, 1, b);
  R(13, 11, 1, 3, b); // porta
  R(15, 12, 2, 1, METAL); // maçaneta
  R(28, 11, 1, 1, 0xf8f0a0); // farol
  R(1, 11, 1, 1, 0xff3040); // lanterna
  // Para-brisa inclinado na frente do motorista.
  for (let y = 6; y < 10; y++) R(19 + Math.floor((y - 6) / 2), y, 1, 1, METAL_DARK);
  for (let y = 7; y < 10; y++) R(20 + Math.floor((y - 6) / 2), y, 2, 1, glass, 120);
  R(1, 15, 28, 1, METAL); // para-choques/estribo
  const wheel = (x: number) => {
    const wx = draw(x);
    c.rect(wx - 2, 15, 5, 4, TIRE);
    c.rect(wx - 1, 16, 3, 2, METAL_DARK);
    c.set(wx + (frame === 0 ? -1 : 1), 16, METAL);
  };
  wheel(7);
  wheel(23);
  c.outline();
  c.shadow(15, 19.4, 14, 1);
};

export function renderRideSheet(kind: RideKind): RgbaImage {
  return renderSheet(RIDE_SPECS[kind], kind === "bike" ? drawBike : drawCar);
}

// --- mascotes ----------------------------------------------------------------

export const PET_SPEC: SheetSpec = { width: 14, height: 14, belowFeet: 0 };

type PetViews = { down: string[]; up: string[]; right: string[] };

const PET_PALETTES: Record<PetKind, Palette> = {
  pikachu: { Y: 0xf8d838, y: 0xd0a420, K: 0x282028, W: 0xffffff, R: 0xe84838, M: 0x803030, N: 0x8c5828 },
  squirtle: { U: 0x68b8e8, u: 0x3c84c0, N: 0xb06c34, n: 0x7c4420, C: 0xf0d890, c: 0xc8a860, K: 0x282028, W: 0xffffff, M: 0x803030 },
  charmander: { O: 0xf08838, C: 0xf8d890, K: 0x282028, W: 0xffffff, M: 0x803030, F: 0xf04818, f: 0xf8d030 },
  bulbasaur: { G: 0x70c8a8, g: 0x3c8c70, V: 0x58b040, v: 0x2c7028, R: 0xc83030, W: 0xffffff, M: 0x803030 },
};

const PET_ART: Record<PetKind, PetViews> = {
  pikachu: {
    down: [
      ".K........K.",
      ".KY......YK.",
      "..YY....YY..",
      "..YYYYYYYY..",
      ".YYYYYYYYYY.",
      ".YKWYYYYKWY.",
      ".YKKYYYYKKY.",
      ".RRYYMMYYRR.",
      "..YYYYYYYY.Y",
      "..yYYYYYYyYY",
      "..YYYYYYYY..",
      "..yy....yy..",
    ],
    up: [
      ".K........K.",
      ".KY......YK.",
      "..YY....YY..",
      "..YYYYYYYY..",
      ".YYYYYYYYYY.",
      ".YYYYYYYYYY.",
      ".YYYYYYYYYYY",
      "..YYYYYYYYY.",
      "..YNNNNNNYYY",
      "..YYYYYYYY..",
      "..YNNNNNNY..",
      "..yy....yy..",
    ],
    right: [
      ".......K.K..",
      ".......KYKY.",
      "......YYYYY.",
      "..YY.YYYYYYY",
      ".YY..YYYYYKW",
      "..YY.YYYYYKK",
      ".YY..RRYYYYY",
      "..NN..YYYYM.",
      "...NNYYYYY..",
      ".....YyYYY..",
      ".....YYYYy..",
      ".....yy.yy..",
    ],
  },
  squirtle: {
    down: [
      "...UUUUUU...",
      "..UUUUUUUU..",
      ".UUUUUUUUUU.",
      ".UKWUUUUKWU.",
      ".UKKUUUUKKU.",
      ".UUUUMMUUUU.",
      "..UUUUUUUU..",
      ".UNCCCCCCNU.",
      "UU.CcCCcC.UU",
      "..NCCCCCCN..",
      "...UCCCCU...",
      "..uUU..UUu..",
    ],
    up: [
      "...UUUUUU...",
      "..UUUUUUUU..",
      ".UUUUUUUUUU.",
      ".UUUUUUUUUU.",
      ".UUUUUUUUUU.",
      "..UUUUUUUU..",
      "..cNNNNNNc..",
      ".cNnNNNNnNc.",
      "UcNNnNNnNNcU",
      ".cNnNNNNnNc.",
      "..cNNUUNNc..",
      "..uU.UU.Uu..",
    ],
    right: [
      ".....UUUUU..",
      "....UUUUUUU.",
      "....UUUUUKWU",
      "....UUUUUKKU",
      "....UUUUUUUU",
      ".....UUUUUM.",
      "..cNNNUUUU..",
      ".cNnNNCCCU..",
      "UcNNnNCCUU..",
      "UUcNNNCCC...",
      ".U.cNNCCC...",
      "....uU.uU...",
    ],
  },
  charmander: {
    down: [
      "....OOOO....",
      "...OOOOOO...",
      "..OOOOOOOO..",
      "..OKWOOKWO..",
      "..OKKOOKKO..",
      "..OOOMMOOO..",
      "...OOOOOO.F.",
      "..OOCCCCOOFf",
      ".OOOCCCCOOf.",
      "...OCCCCOO..",
      "...OOOOOO...",
      "...OO..OO...",
    ],
    up: [
      "....OOOO....",
      "...OOOOOO...",
      "..OOOOOOOO..",
      "..OOOOOOOO..",
      "..OOOOOOOO..",
      "..OOOOOOOO..",
      "...OOOOOO...",
      ".OOOOOOOOOO.",
      "...OOOOOO...",
      "...OOOOOO.F.",
      "...OOOOOOOFf",
      "...OO..OOFfF",
    ],
    right: [
      ".....OOOO...",
      "....OOOOOO..",
      "....OOOOKWO.",
      "....OOOOKKOO",
      "....OOOOOOOO",
      ".....OOOOMO.",
      ".F....OOOO..",
      "FfF..OCCOOO.",
      ".F..OOCCC...",
      "..OOOOCCC...",
      "....OOOOO...",
      "....OO.OO...",
    ],
  },
  bulbasaur: {
    down: [
      "....VVVV....",
      "...VvVVvV...",
      "..VVVvvVVV..",
      ".G.VVVVVV.G.",
      ".GGGGGGGGGG.",
      "GGRWGGGGRWGG",
      "GGRRGGGGRRGG",
      "GGGGgMMgGGGG",
      ".GGGGGGGGGG.",
      "..GgGGGGgG..",
      "..GGG..GGG..",
      "..gWg..gWg..",
    ],
    up: [
      "....VVVV....",
      "...VvVVvV...",
      "..VVVvvVVV..",
      ".VVVVvvVVVV.",
      ".GVVVVVVVVG.",
      "GGGVVVVVVGGG",
      "GGGGgGGgGGGG",
      "GGgGGGGGGgGG",
      ".GGGGgGGGGG.",
      "..GGGGGGGG..",
      "..GGG..GGG..",
      "..ggg..ggg..",
    ],
    right: [
      "...VVVV.....",
      "..VvVVvV....",
      ".VVVvvVVV...",
      ".VVVVVVVVG.G",
      "..VVVVVVGGGG",
      "..GGGGGGGRWG",
      ".GGgGGGGGRRG",
      ".GGGGgGGGGGG",
      ".GGgGGGGGgM.",
      "..GGGGGGGG..",
      "..GG.GG.GG..",
      "..gg.gg.gg..",
    ],
  },
};

export function renderPetSheet(kind: PetKind): RgbaImage {
  const art = PET_ART[kind];
  const palette = PET_PALETTES[kind];
  return renderSheet(PET_SPEC, (c, dir, frame) => {
    const rows = dir === "left" || dir === "right" ? art.right : art[dir];
    // Frame 1: pulinho de 1 pixel.
    c.ascii(1, 1 - frame, rows, palette, dir === "left");
    c.outline();
    c.shadow(7, 13.2, 4.5, 1);
  });
}
