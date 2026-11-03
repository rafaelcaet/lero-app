/**
 * IDs globais (GID) dos tiles, compatíveis com o Tiled (firstgid = 1).
 * O frame no tileset é sempre `gid - 1`. 0 significa "sem tile".
 */
export const Tile = {
  EMPTY: 0,
  FLOOR_WOOD: 1,
  FLOOR_CARPET: 2,
  WALL_TOP: 3,
  WALL_FACE: 4,
  DESK: 5,
  CHAIR: 6,
  PLANT: 7,
  BOOKSHELF: 8,
  RUG: 9,
  COLLISION: 10,
} as const;

export type TileId = (typeof Tile)[keyof typeof Tile];

/** Quantidade de frames do tileset gerado. */
export const TILESET_TILE_COUNT = 10;
