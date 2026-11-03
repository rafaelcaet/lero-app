/**
 * Layout do escritório (30 × 20) descrito em código puro, sem Phaser.
 * É a fonte do mapa provisório e também do JSON no formato Tiled
 * (veja `scripts/export-office-map.ts`).
 */
import { MAP_HEIGHT, MAP_WIDTH } from "../constants.ts";
import { Tile, type TileId } from "./tiles.ts";

export type Grid = TileId[][];

export interface OfficeLayout {
  width: number;
  height: number;
  ground: Grid;
  walls: Grid;
  objects: Grid;
  collisions: Grid;
}

/** Tiles de objetos que bloqueiam passagem (cadeiras são atravessáveis). */
const BLOCKING_OBJECTS: ReadonlySet<TileId> = new Set<TileId>([
  Tile.DESK,
  Tile.PLANT,
  Tile.BOOKSHELF,
]);

function grid(fill: TileId): Grid {
  return Array.from({ length: MAP_HEIGHT }, () =>
    Array.from({ length: MAP_WIDTH }, () => fill),
  );
}

function rect(g: Grid, x: number, y: number, w: number, h: number, t: TileId) {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      g[row][col] = t;
    }
  }
}

export function createOfficeLayout(): OfficeLayout {
  const ground = grid(Tile.FLOOR_WOOD);
  const walls = grid(Tile.EMPTY);
  const objects = grid(Tile.EMPTY);

  // --- Paredes externas -------------------------------------------------
  rect(walls, 0, 0, MAP_WIDTH, 1, Tile.WALL_TOP);
  rect(walls, 1, 1, MAP_WIDTH - 2, 1, Tile.WALL_FACE); // face frontal da parede de cima
  rect(walls, 0, MAP_HEIGHT - 1, MAP_WIDTH, 1, Tile.WALL_TOP);
  rect(walls, 0, 0, 1, MAP_HEIGHT, Tile.WALL_TOP);
  rect(walls, MAP_WIDTH - 1, 0, 1, MAP_HEIGHT, Tile.WALL_TOP);

  // --- Sala de reunião (canto superior direito) -------------------------
  rect(ground, 19, 2, 10, 11, Tile.FLOOR_CARPET);
  rect(walls, 18, 1, 1, 13, Tile.WALL_TOP); // parede vertical
  rect(walls, 18, 7, 1, 2, Tile.EMPTY); // porta lateral
  rect(walls, 18, 13, 11, 1, Tile.WALL_TOP); // parede horizontal
  rect(walls, 23, 13, 2, 1, Tile.EMPTY); // porta inferior

  rect(objects, 21, 6, 6, 2, Tile.DESK); // mesa de reunião
  for (let x = 21; x <= 26; x++) {
    objects[5][x] = Tile.CHAIR;
    objects[8][x] = Tile.CHAIR;
  }
  objects[2][19] = Tile.PLANT;
  objects[2][28] = Tile.PLANT;
  objects[12][19] = Tile.PLANT;
  objects[12][28] = Tile.PLANT;

  // --- Open office (esquerda) -------------------------------------------
  const deskColumns = [3, 8, 13];
  for (const x of deskColumns) {
    for (const y of [4, 9]) {
      rect(objects, x, y, 2, 1, Tile.DESK);
      objects[y + 1][x] = Tile.CHAIR;
      objects[y + 1][x + 1] = Tile.CHAIR;
    }
  }
  objects[2][1] = Tile.PLANT;
  objects[2][17] = Tile.PLANT;

  // --- Lounge (parte inferior) ------------------------------------------
  rect(ground, 3, 14, 8, 4, Tile.RUG);
  objects[17][1] = Tile.PLANT;
  rect(objects, 20, 17, 8, 1, Tile.BOOKSHELF);
  objects[17][28] = Tile.PLANT;
  objects[17][19] = Tile.PLANT;
  rect(objects, 13, 15, 2, 1, Tile.DESK); // mesa de café
  objects[16][13] = Tile.CHAIR;
  objects[16][14] = Tile.CHAIR;

  // --- Colisões: paredes + objetos bloqueantes ---------------------------
  const collisions = grid(Tile.EMPTY);
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (walls[y][x] !== Tile.EMPTY || BLOCKING_OBJECTS.has(objects[y][x])) {
        collisions[y][x] = Tile.COLLISION;
      }
    }
  }

  return { width: MAP_WIDTH, height: MAP_HEIGHT, ground, walls, objects, collisions };
}
