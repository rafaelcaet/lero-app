import { renderCharacterFrame, type Direction } from "@/game/characters/characterArt";
import { appearanceKey, type Appearance } from "@/shared/appearance";
import type { CostumeId } from "@/shared/costumes";

/** Desenha um frame do personagem num <canvas> (16 × 16 pixels virtuais × `scale`). */
export function paintCharacter(
  canvas: HTMLCanvasElement,
  appearance: Appearance,
  dir: Direction = "down",
  column = 0,
  scale = 1,
) {
  const image = renderCharacterFrame(appearance, dir, column, scale);
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
}

const portraits = new Map<string, string>();

/** Retrato (cabeça e ombros, 14 × 14), com a fantasia se houver, como data URL. Só no navegador; fica em cache. */
export function portraitUrl(appearance: Appearance, costume: CostumeId | null = null): string {
  const key = `${appearanceKey(appearance)}-${costume ?? ""}`;
  const cached = portraits.get(key);
  if (cached) return cached;
  const frame = renderCharacterFrame(appearance, "down", 0, 1, costume);
  const canvas = document.createElement("canvas");
  canvas.width = 14;
  canvas.height = 14;
  canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(frame.data), 16, 16), -1, 0);
  const url = canvas.toDataURL();
  portraits.set(key, url);
  return url;
}
