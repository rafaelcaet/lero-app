/**
 * Pixel art dos emotes dos balões de fala (puro, sem Phaser): beleza, coração,
 * dúvida e negativo. Mesmo estilo dos personagens (contorno GBA, 2× de escala).
 */
import type { Emote } from "../../shared/bubbles.ts";
import { createImage, darken, lighten, PixelCanvas, type Palette, type RgbaImage } from "./pixelArt.ts";

/** Tamanho do emote em pixels virtuais (já com 1 px de margem para o contorno). */
export const EMOTE_SIZE = 13;
/** Pixels de tela por pixel virtual (igual aos personagens). */
export const EMOTE_SCALE = 2;

const SKIN = 0xf2c28c;
const CUFF = 0x4a74d0;
const HEART = 0xe0405a;
const QUESTION = 0xf0b030;

const HAND: Palette = {
  s: SKIN,
  l: lighten(SKIN, 0.45),
  d: darken(SKIN, 0.28),
  k: CUFF,
  K: darken(CUFF, 0.3),
};

/** Mão fechada com o polegar para cima (o negativo é a mesma arte de cabeça para baixo). */
const THUMB_UP = [
  ".....ll....",
  ".....lsd...",
  "....lssd...",
  "....lssd...",
  "...lssss...",
  "kK.lssssssd",
  "kK.sssddddd",
  "kK.ssssssss",
  "kK.sssddddd",
  "kK.ssssssss",
  "kK.dsssddd.",
];

const HEART_ART = [
  ".rr...rr.",
  "rwlr.rrrr",
  "rlrrrrrrr",
  "rrrrrrrrr",
  "rrrrrrrrd",
  ".rrrrrrd.",
  "..rrrrd..",
  "...rrd...",
  "....d....",
];

const HEART_PALETTE: Palette = { r: HEART, l: lighten(HEART, 0.4), w: 0xfff4f4, d: darken(HEART, 0.25) };

const QUESTION_ART = [
  ".lqqqq.",
  "lqqddqq",
  "qq...qq",
  ".....qq",
  "....qqd",
  "...qqd.",
  "...qq..",
  ".......",
  "...lq..",
  "...qd..",
];

const QUESTION_PALETTE: Palette = { q: QUESTION, l: lighten(QUESTION, 0.5), d: darken(QUESTION, 0.25) };

/** Desenha o emote centralizado num canvas EMOTE_SIZE × EMOTE_SIZE, com contorno. */
export function drawEmote(emote: Emote): PixelCanvas {
  const c = new PixelCanvas(EMOTE_SIZE, EMOTE_SIZE);
  const place = (rows: readonly string[], palette: Palette) => {
    const ox = Math.floor((EMOTE_SIZE - rows[0].length) / 2);
    const oy = Math.floor((EMOTE_SIZE - rows.length) / 2);
    c.ascii(ox, oy, rows, palette);
  };
  switch (emote) {
    case "thumbs-up":
      place(THUMB_UP, HAND);
      break;
    case "thumbs-down":
      place([...THUMB_UP].reverse(), HAND);
      break;
    case "heart":
      place(HEART_ART, HEART_PALETTE);
      break;
    case "question":
      place(QUESTION_ART, QUESTION_PALETTE);
      break;
  }
  return c.outline();
}

/** Emote ampliado (EMOTE_SCALE×) como imagem RGBA. */
export function renderEmote(emote: Emote): RgbaImage {
  const size = EMOTE_SIZE * EMOTE_SCALE;
  const image = createImage(size, size);
  drawEmote(emote).blit(image.data, image.width, 0, 0, EMOTE_SCALE);
  return image;
}
