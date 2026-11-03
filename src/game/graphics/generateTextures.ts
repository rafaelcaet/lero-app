/**
 * Gera texturas provisórias (tileset e spritesheet do personagem) com
 * Phaser Graphics, para rodar o MVP sem nenhum arquivo de imagem externo.
 */
import * as Phaser from "phaser";
import { ASSET_KEYS, TILE_SIZE } from "../constants";
import { Tile, TILESET_TILE_COUNT } from "../maps/tiles";
import {
  CHARACTER_PALETTES,
  characterTextureKey,
  generateCharacterSheet,
} from "../characters/characterSprites";

const T = TILE_SIZE;

type Painter = (g: Phaser.GameObjects.Graphics, x: number) => void;

const tilePainters: Record<number, Painter> = {
  [Tile.FLOOR_WOOD]: (g, x) => {
    g.fillStyle(0xc89f6e).fillRect(x, 0, T, T);
    g.fillStyle(0xb88d5c);
    for (let i = 0; i < 4; i++) g.fillRect(x, i * 8 + 7, T, 1);
    g.fillRect(x + 10, 0, 1, 8).fillRect(x + 24, 8, 1, 8);
    g.fillRect(x + 6, 16, 1, 8).fillRect(x + 20, 24, 1, 8);
  },
  [Tile.FLOOR_CARPET]: (g, x) => {
    g.fillStyle(0x5b6c8f).fillRect(x, 0, T, T);
    g.fillStyle(0x66789c);
    for (let i = 0; i < T; i += 4) g.fillRect(x + ((i / 4) % 2) * 2, i, T, 1);
  },
  [Tile.WALL_TOP]: (g, x) => {
    g.fillStyle(0x3b3f52).fillRect(x, 0, T, T);
    g.fillStyle(0x4a4f66).fillRect(x + 2, 2, T - 4, T - 4);
  },
  [Tile.WALL_FACE]: (g, x) => {
    g.fillStyle(0xe6dccb).fillRect(x, 0, T, T);
    g.fillStyle(0xcfc3ae).fillRect(x, T - 6, T, 6);
    g.fillStyle(0x9c8f7a).fillRect(x, T - 2, T, 2);
  },
  [Tile.DESK]: (g, x) => {
    g.fillStyle(0x6b4a2f).fillRect(x, 4, T, T - 6);
    g.fillStyle(0x8a6240).fillRect(x, 4, T, T - 12);
    g.fillStyle(0x2d2f3a).fillRect(x + 8, 6, 16, 10); // monitor
    g.fillStyle(0x6fd3ff).fillRect(x + 10, 8, 12, 6);
  },
  [Tile.CHAIR]: (g, x) => {
    g.fillStyle(0x2c2c34).fillRect(x + 9, 6, 14, 6);
    g.fillStyle(0x3d63c9).fillRect(x + 8, 12, 16, 12);
    g.fillStyle(0x2c2c34).fillRect(x + 15, 24, 2, 4);
  },
  [Tile.PLANT]: (g, x) => {
    g.fillStyle(0x9a5b34).fillRect(x + 10, 20, 12, 10);
    g.fillStyle(0x2f8f46).fillCircle(x + 16, 13, 9);
    g.fillStyle(0x45b35f).fillCircle(x + 12, 10, 5).fillCircle(x + 20, 12, 5);
  },
  [Tile.BOOKSHELF]: (g, x) => {
    g.fillStyle(0x5a3b24).fillRect(x, 2, T, T - 2);
    const colors = [0xd94f4f, 0x4f8fd9, 0xe0c14a, 0x5fb36a];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 6; i++) {
        g.fillStyle(colors[(i + row) % colors.length]);
        g.fillRect(x + 3 + i * 4.5, 5 + row * 13, 3, 10);
      }
    }
  },
  [Tile.RUG]: (g, x) => {
    g.fillStyle(0xa8433f).fillRect(x, 0, T, T);
    g.fillStyle(0xc65a52).fillRect(x + 4, 4, T - 8, T - 8);
    g.fillStyle(0xa8433f).fillRect(x + 12, 12, 8, 8);
  },
  [Tile.COLLISION]: (g, x) => {
    g.fillStyle(0xff0044, 0.4).fillRect(x, 0, T, T);
  },
};

function generateTileset(scene: Phaser.Scene) {
  const g = scene.make.graphics({}, false);
  for (let gid = 1; gid <= TILESET_TILE_COUNT; gid++) {
    tilePainters[gid]?.(g, (gid - 1) * T);
  }
  g.generateTexture(ASSET_KEYS.tileset, T * TILESET_TILE_COUNT, T);
  g.destroy();
}

export function generatePlaceholderTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists(ASSET_KEYS.tileset)) generateTileset(scene);
  CHARACTER_PALETTES.forEach((palette, i) =>
    generateCharacterSheet(scene, characterTextureKey(i), palette),
  );
}
