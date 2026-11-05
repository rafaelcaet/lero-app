import {
  GEAR_DIRECTIONS,
  GEAR_SCALE,
  PET_SPEC,
  renderPetSheet,
  renderRideSheet,
  RIDE_SPECS,
  type GearDirection,
} from "@/game/graphics/gearArt";
import { isPetKind, type PetKind, type RideKind } from "@/shared/shop";

const cache = new Map<string, string>();

/** Um frame do veículo/mascote como data URL (só no navegador; fica em cache). */
export function gearImageUrl(kind: RideKind | PetKind, dir: GearDirection = "down"): string {
  const key = `${kind}-${dir}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const pet = isPetKind(kind);
  const spec = pet ? PET_SPEC : RIDE_SPECS[kind];
  const sheet = pet ? renderPetSheet(kind) : renderRideSheet(kind);
  const fw = spec.width * GEAR_SCALE;
  const fh = spec.height * GEAR_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = fw;
  canvas.height = fh;
  const row = GEAR_DIRECTIONS.indexOf(dir);
  const full = new ImageData(new Uint8ClampedArray(sheet.data), sheet.width, sheet.height);
  canvas.getContext("2d")?.putImageData(full, 0, -row * fh, 0, row * fh, fw, fh);
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}
