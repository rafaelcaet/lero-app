import * as Phaser from "phaser";
import type { RgbaImage } from "./pixelArt";

/** Registra um buffer RGBA como textura (canvas) do Phaser. */
export function addRgbaTexture(scene: Phaser.Scene, key: string, image: RgbaImage) {
  const texture = scene.textures.createCanvas(key, image.width, image.height);
  if (!texture) throw new Error(`Falha ao criar a textura "${key}"`);
  const pixels = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  texture.context.putImageData(pixels, 0, 0);
  texture.refresh();
  return texture;
}
