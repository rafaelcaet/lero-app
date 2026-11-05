/** Texturas e animações dos veículos e mascotes (gerados sob demanda). */
import * as Phaser from "phaser";
import type { PetKind, RideKind } from "@/shared/shop";
import {
  GEAR_DIRECTIONS,
  GEAR_FRAMES,
  GEAR_SCALE,
  PET_SPEC,
  renderPetSheet,
  renderRideSheet,
  RIDE_SPECS,
  type GearDirection,
  type SheetSpec,
} from "./gearArt";
import { addRgbaTexture } from "./rgbaTexture";

export type { GearDirection };

function ensureSheet(scene: Phaser.Scene, key: string, spec: SheetSpec, render: () => ReturnType<typeof renderPetSheet>) {
  if (scene.textures.exists(key)) return;
  const texture = addRgbaTexture(scene, key, render());
  const fw = spec.width * GEAR_SCALE;
  const fh = spec.height * GEAR_SCALE;
  GEAR_DIRECTIONS.forEach((_, row) => {
    for (let col = 0; col < GEAR_FRAMES; col++) {
      texture.add(row * GEAR_FRAMES + col, 0, col * fw, row * fh, fw, fh);
    }
  });
}

export const gearFrame = (dir: GearDirection, col = 0) => GEAR_DIRECTIONS.indexOf(dir) * GEAR_FRAMES + col;

/** Animação de 2 frames por direção: `${key}-${dir}` (rápida) e `${key}-${dir}-slow`. */
function ensureAnims(scene: Phaser.Scene, key: string, fast: number, slow: number) {
  for (const dir of GEAR_DIRECTIONS) {
    const frames = [0, 1].map((col) => ({ key, frame: gearFrame(dir, col) }));
    if (!scene.anims.exists(`${key}-${dir}`)) scene.anims.create({ key: `${key}-${dir}`, frames, frameRate: fast, repeat: -1 });
    if (!scene.anims.exists(`${key}-${dir}-slow`)) scene.anims.create({ key: `${key}-${dir}-slow`, frames, frameRate: slow, repeat: -1 });
  }
}

export function ensureRideTexture(scene: Phaser.Scene, kind: RideKind): string {
  const key = `ride-${kind}`;
  ensureSheet(scene, key, RIDE_SPECS[kind], () => renderRideSheet(kind));
  ensureAnims(scene, key, 10, 1);
  return key;
}

export function ensurePetTexture(scene: Phaser.Scene, kind: PetKind): string {
  const key = `pet-${kind}`;
  ensureSheet(scene, key, PET_SPEC, () => renderPetSheet(kind));
  ensureAnims(scene, key, 8, 2);
  return key;
}

export const rideSpec = (kind: RideKind) => RIDE_SPECS[kind];
