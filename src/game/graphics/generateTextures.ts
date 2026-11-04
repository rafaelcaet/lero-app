/**
 * Gera o tileset a partir da pixel art em código, sem arquivos de imagem.
 * Os sheets dos personagens são gerados sob demanda, por aparência
 * (veja `ensureCharacterTexture`).
 */
import * as Phaser from "phaser";
import { ASSET_KEYS } from "../constants";
import { addRgbaTexture } from "./rgbaTexture";
import { renderTileset } from "./tileArt";

export function generatePlaceholderTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists(ASSET_KEYS.tileset)) addRgbaTexture(scene, ASSET_KEYS.tileset, renderTileset());
}
