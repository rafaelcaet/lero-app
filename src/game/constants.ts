/** Constantes compartilhadas do jogo (sem dependência do Phaser). */

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const TILE_SIZE = 32;
export const MAP_WIDTH = 30;
export const MAP_HEIGHT = 20;

export const CAMERA_ZOOM = 2;

export const PLAYER_SPEED = 150;

/** Posição inicial padrão, em coordenadas de tile. */
export const DEFAULT_SPAWN = { tileX: 9, tileY: 15 } as const;

export const SCENE_KEYS = {
  boot: "BootScene",
  game: "GameScene",
} as const;

export const ASSET_KEYS = {
  tileset: "office-tiles",
  officeMap: "office-map",
} as const;

/** Nome do tileset dentro do JSON do Tiled. */
export const TILESET_NAME = "office-tiles";

export const LAYER_NAMES = {
  ground: "Ground",
  walls: "Walls",
  objects: "Objects",
  collisions: "Collisions",
} as const;
