import { renderEmote } from "@/game/graphics/emoteArt";
import type { Emote } from "@/shared/bubbles";

const cache = new Map<Emote, string>();

/** Emote em pixel art como data URL (só no navegador; fica em cache). */
export function emoteImageUrl(emote: Emote): string {
  const cached = cache.get(emote);
  if (cached) return cached;
  const image = renderEmote(emote);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  const url = canvas.toDataURL();
  cache.set(emote, url);
  return url;
}
