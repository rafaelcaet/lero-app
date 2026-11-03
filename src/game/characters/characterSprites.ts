/**
 * Spritesheet e animações de personagens gerados com Phaser Graphics.
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
import { DEFAULT_PALETTE, paletteIndex, type CharacterPalette } from "./characterPalettes";

const T = TILE_SIZE;

export const DIRECTIONS = ["down", "left", "right", "up"] as const;
export type Direction = (typeof DIRECTIONS)[number];
export type AnimState = "idle" | "walk" | "sit";

const IDLE = { base: 0, breath: 1, blink: 2 } as const;
const WALK_START = 3;
const WALK_FRAME_COUNT = 4;
const SIT = WALK_START + WALK_FRAME_COUNT;
export const FRAMES_PER_DIRECTION = SIT + 1;

export {
  CHARACTER_PALETTES,
  DEFAULT_PALETTE,
  type CharacterPalette,
} from "./characterPalettes";

export function characterTextureKey(colorIndex: number): string {
  return `character-${paletteIndex(colorIndex)}`;
}

interface Pose {
  /** Deslocamento vertical do corpo inteiro (passo da caminhada). */
  bob: number;
  /** Deslocamento só do tronco/cabeça (respiração). */
  breath: number;
  /** Afastamento das pernas na vista lateral (+ = perna da frente adiante). */
  stride: number;
  /** Elevação de cada perna na vista frontal/traseira. */
  liftLeft: number;
  liftRight: number;
  /** Balanço dos braços. */
  swing: number;
  eyesClosed: boolean;
  sitting: boolean;
}

const NEUTRAL: Pose = {
  bob: 0,
  breath: 0,
  stride: 0,
  liftLeft: 0,
  liftRight: 0,
  swing: 0,
  eyesClosed: false,
  sitting: false,
};

/** Poses por coluna do sheet. */
const POSES: Pose[] = [
  NEUTRAL,
  { ...NEUTRAL, breath: 1 },
  { ...NEUTRAL, eyesClosed: true },
  // Caminhada: contato → passagem → contato (lado oposto) → passagem
  { ...NEUTRAL, stride: 4, liftRight: 2, swing: 2 },
  { ...NEUTRAL, bob: -1, liftLeft: 1 },
  { ...NEUTRAL, stride: -4, liftLeft: 2, swing: -2 },
  { ...NEUTRAL, bob: -1, liftRight: 1 },
  // Sentado: corpo mais baixo, pernas dobradas.
  { ...NEUTRAL, bob: 2, sitting: true },
];

export function frameIndex(dir: Direction, column: number): number {
  return DIRECTIONS.indexOf(dir) * FRAMES_PER_DIRECTION + column;
}

export function animKey(textureKey: string, state: AnimState, dir: Direction): string {
  return `${textureKey}-${state}-${dir}`;
}

/** Pincel que desenha num frame (ox, oy), com espelhamento horizontal opcional. */
function brush(g: Phaser.GameObjects.Graphics, ox: number, oy: number, mirror: boolean) {
  return {
    rect(x: number, y: number, w: number, h: number, color: number) {
      const px = mirror ? T - x - w : x;
      g.fillStyle(color).fillRect(ox + px, oy + y, w, h);
    },
    circle(x: number, y: number, r: number, color: number) {
      g.fillStyle(color).fillCircle(ox + (mirror ? T - x : x), oy + y, r);
    },
    shadow() {
      g.fillStyle(0x000000, 0.25).fillEllipse(ox + 16, oy + 29, 16, 5);
    },
  };
}

function drawFrontOrBack(
  b: ReturnType<typeof brush>,
  p: Pose,
  c: CharacterPalette,
  facingUp: boolean,
) {
  const top = p.bob + p.breath;

  b.shadow();
  // pernas (a elevada fica mais curta, sugerindo o passo)
  const leg = (x: number, lift: number) => {
    const h = 6 - lift;
    b.rect(x, 22 + p.bob, 3, h, c.pants);
    b.rect(x, 21 + p.bob + h, 3, 2, c.shoes);
  };
  if (p.sitting) {
    // De frente: coxas para a frente (curtas); de costas: o encosto cobre as pernas.
    if (!facingUp) {
      b.rect(11, 22 + p.bob, 10, 3, c.pants);
      b.rect(12, 25 + p.bob, 3, 2, c.shoes);
      b.rect(17, 25 + p.bob, 3, 2, c.shoes);
    }
  } else {
    leg(12, p.liftLeft);
    leg(17, p.liftRight);
  }

  // braços balançam em oposição
  b.rect(8, 15 + top + p.swing / 2, 2, 6, c.shirtShade);
  b.rect(22, 15 + top - p.swing / 2, 2, 6, c.shirtShade);
  b.rect(8, 21 + top + p.swing / 2, 2, 1, c.skin);
  b.rect(22, 21 + top - p.swing / 2, 2, 1, c.skin);

  // tronco
  b.rect(10, 14 + top, 12, 9 - p.breath, c.shirt);
  b.rect(10, 21 + p.bob, 12, 1, c.shirtShade);

  // cabeça
  b.circle(16, 9 + top, 6, c.skin);
  if (facingUp) {
    b.circle(16, 8 + top, 6, c.hair);
    b.rect(10, 9 + top, 12, 3, c.hair);
  } else {
    b.rect(10, 3 + top, 12, 3, c.hair);
    b.rect(10, 5 + top, 2, 3, c.hair);
    b.rect(20, 5 + top, 2, 3, c.hair);
    const eyeH = p.eyesClosed ? 1 : 2;
    const eyeY = 9 + top + (p.eyesClosed ? 1 : 0);
    b.rect(13, eyeY, 2, eyeH, 0x1a1a1a);
    b.rect(17, eyeY, 2, eyeH, 0x1a1a1a);
  }
}

/** Vista lateral desenhada olhando para a direita (a esquerda é espelhada). */
function drawSide(b: ReturnType<typeof brush>, p: Pose, c: CharacterPalette) {
  const top = p.bob + p.breath;

  b.shadow();
  // perna de trás (mais escura) e perna da frente
  const leg = (x: number, color: number) => {
    b.rect(x, 22 + p.bob, 3, 6, color);
    b.rect(x, 27 + p.bob, 4, 2, c.shoes);
  };
  if (p.sitting) {
    b.rect(13, 21 + p.bob, 9, 3, c.pants); // coxa na horizontal
    b.rect(19, 24 + p.bob, 3, 3, c.pants); // canela
    b.rect(19, 26 + p.bob, 4, 2, c.shoes);
  } else {
    leg(14 - Math.round(p.stride / 2), c.shoes);
    leg(14 + Math.round(p.stride / 2), c.pants);
  }

  // braço de trás
  b.rect(14 + p.swing, 15 + top, 3, 6, c.shirtShade);
  // tronco
  b.rect(11, 14 + top, 10, 9 - p.breath, c.shirt);
  b.rect(11, 21 + p.bob, 10, 1, c.shirtShade);
  // braço da frente (oposto ao de trás)
  b.rect(15 - p.swing, 15 + top, 3, 6, c.shirtShade);
  b.rect(15 - p.swing, 21 + top, 3, 1, c.skin);

  // cabeça
  b.circle(16, 9 + top, 6, c.skin);
  b.rect(10, 3 + top, 11, 3, c.hair);
  b.rect(10, 5 + top, 4, 6, c.hair);
  const eyeH = p.eyesClosed ? 1 : 2;
  b.rect(19, 9 + top + (p.eyesClosed ? 1 : 0), 2, eyeH, 0x1a1a1a);
}

/** Gera o spritesheet de um personagem e registra frames numerados. */
export function generateCharacterSheet(
  scene: Phaser.Scene,
  textureKey: string,
  palette: CharacterPalette = DEFAULT_PALETTE,
) {
  if (scene.textures.exists(textureKey)) return;

  const g = scene.make.graphics({}, false);
  DIRECTIONS.forEach((dir, row) => {
    POSES.forEach((pose, col) => {
      const b = brush(g, col * T, row * T, dir === "left");
      if (dir === "left" || dir === "right") drawSide(b, pose, palette);
      else drawFrontOrBack(b, pose, palette, dir === "up");
    });
  });
  g.generateTexture(textureKey, T * FRAMES_PER_DIRECTION, T * DIRECTIONS.length);
  g.destroy();

  const texture = scene.textures.get(textureKey);
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
