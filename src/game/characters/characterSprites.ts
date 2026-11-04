/**
 * Spritesheet e animações dos personagens. A arte (pixel art estilo GBA) vem
 * de `characterArt.ts`.
 *
 * Layout do sheet (frames de 32 × 32):
 *   linhas  = direções (down, left, right, up)
 *   colunas = 0 idle · 1 idle (respiração) · 2 idle (piscada) · 3–6 caminhada · 7 sentado
 *
 * Um spritesheet PNG externo com o mesmo layout pode substituir o gerado
 * sem mudar nenhuma outra parte do código.
 */
import * as Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import { addRgbaTexture } from "../graphics/rgbaTexture";
import { DIRECTIONS, POSES, renderCharacterSheet, type Direction } from "./characterArt";
import { appearanceKey, type Appearance } from "@/shared/appearance";

const T = TILE_SIZE;

export { DIRECTIONS, type Direction };
export type AnimState = "idle" | "walk" | "sit";

const IDLE = { base: 0, breath: 1, blink: 2 } as const;
const WALK_START = 3;
const WALK_FRAME_COUNT = 4;
const SIT = WALK_START + WALK_FRAME_COUNT;
export const FRAMES_PER_DIRECTION = POSES.length;

/** Chave da textura de uma aparência (a mesma aparência reaproveita o sheet). */
export function characterTextureKey(appearance: Appearance): string {
  return `character-${appearanceKey(appearance)}`;
}

/** Gera o sheet da aparência se ainda não existir e devolve a chave da textura. */
export function ensureCharacterTexture(scene: Phaser.Scene, appearance: Appearance): string {
  const key = characterTextureKey(appearance);
  if (!scene.textures.exists(key)) generateCharacterSheet(scene, key, appearance);
  return key;
}

export function frameIndex(dir: Direction, column: number): number {
  return DIRECTIONS.indexOf(dir) * FRAMES_PER_DIRECTION + column;
}

export function animKey(textureKey: string, state: AnimState, dir: Direction): string {
  return `${textureKey}-${state}-${dir}`;
}

/** Gera o spritesheet de um personagem e registra frames numerados. */
function generateCharacterSheet(scene: Phaser.Scene, textureKey: string, appearance: Appearance) {
  const texture = addRgbaTexture(scene, textureKey, renderCharacterSheet(appearance));
  for (let row = 0; row < DIRECTIONS.length; row++) {
    for (let col = 0; col < FRAMES_PER_DIRECTION; col++) {
      texture.add(row * FRAMES_PER_DIRECTION + col, 0, col * T, row * T, T, T);
    }
  }
}

/** Cria as animações idle/walk das 4 direções para uma textura (idempotente). */
export function createCharacterAnimations(scene: Phaser.Scene, textureKey: string) {
  const frame = (dir: Direction, col: number, duration = 0) => ({
    key: textureKey,
    frame: frameIndex(dir, col),
    duration,
  });

  for (const dir of DIRECTIONS) {
    const idle = animKey(textureKey, "idle", dir);
    if (!scene.anims.exists(idle)) {
      // Respira devagar e pisca a cada ~2,5 s. (duração extra somada aos 100 ms base)
      scene.anims.create({
        key: idle,
        frameRate: 10,
        repeat: -1,
        frames: [
          frame(dir, IDLE.base, 500),
          frame(dir, IDLE.breath, 500),
          frame(dir, IDLE.base, 500),
          frame(dir, IDLE.breath, 500),
          frame(dir, IDLE.base, 300),
          frame(dir, IDLE.blink, 20),
        ],
      });
    }

    const sit = animKey(textureKey, "sit", dir);
    if (!scene.anims.exists(sit)) {
      scene.anims.create({ key: sit, frames: [frame(dir, SIT)] });
    }

    const walk = animKey(textureKey, "walk", dir);
    if (!scene.anims.exists(walk)) {
      scene.anims.create({
        key: walk,
        frameRate: 10,
        repeat: -1,
        frames: Array.from({ length: WALK_FRAME_COUNT }, (_, i) => frame(dir, WALK_START + i)),
      });
    }
  }
}
