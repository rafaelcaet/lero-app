import { renderCharacterFrame } from "@/game/characters/characterArt";
import { appearanceKey, type Appearance } from "@/shared/appearance";
import type { CostumeId } from "@/shared/costumes";

const cache = new Map<string, string>();

/** O personagem com a fantasia, de frente, como data URL (só no navegador; fica em cache). */
export function costumeImageUrl(appearance: Appearance, costume: CostumeId): string {
  const key = `${appearanceKey(appearance)}-${costume}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const image = renderCharacterFrame(appearance, "down", 0, 4, costume);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}
