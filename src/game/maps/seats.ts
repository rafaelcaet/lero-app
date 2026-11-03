/**
 * Extrai cadeiras e mesas do layout. Puro (sem Phaser): usado pelo cliente
 * para interação e pelo servidor para validar quem pode sentar onde.
 *
 * Mesa = conjunto conectado de tiles DESK. Cada cadeira pertence à mesa
 * vizinha (acima/abaixo/esquerda/direita) e fica virada para ela.
 */
import { TILE_SIZE } from "../constants.ts";
import type { OfficeLayout } from "./officeLayout.ts";
import { Tile } from "./tiles.ts";
import type { Facing } from "../../shared/protocol.ts";

export interface Seat {
  id: string;
  tableId: string;
  tileX: number;
  tileY: number;
  /** Centro da cadeira em pixels. */
  x: number;
  y: number;
  facing: Facing;
}

const NEIGHBORS: Array<{ dx: number; dy: number; facing: Facing }> = [
  { dx: 0, dy: -1, facing: "up" },
  { dx: 0, dy: 1, facing: "down" },
  { dx: -1, dy: 0, facing: "left" },
  { dx: 1, dy: 0, facing: "right" },
];

function labelTables(layout: OfficeLayout): number[][] {
  const { width, height, objects } = layout;
  const labels = objects.map((row) => row.map(() => -1));
  let next = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (objects[y][x] !== Tile.DESK || labels[y][x] !== -1) continue;
      const stack = [[x, y]];
      labels[y][x] = next;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        for (const { dx, dy } of NEIGHBORS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (objects[ny][nx] === Tile.DESK && labels[ny][nx] === -1) {
            labels[ny][nx] = next;
            stack.push([nx, ny]);
          }
        }
      }
      next++;
    }
  }
  return labels;
}

export function computeSeats(layout: OfficeLayout): Seat[] {
  const labels = labelTables(layout);
  const seats: Seat[] = [];
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      if (layout.objects[y][x] !== Tile.CHAIR) continue;
      const desk = NEIGHBORS.find(({ dx, dy }) => (labels[y + dy]?.[x + dx] ?? -1) >= 0);
      if (!desk) continue; // cadeira solta, sem mesa
      seats.push({
        id: `seat-${x}-${y}`,
        tableId: `table-${labels[y + desk.dy][x + desk.dx]}`,
        tileX: x,
        tileY: y,
        x: x * TILE_SIZE + TILE_SIZE / 2,
        y: y * TILE_SIZE + TILE_SIZE / 2,
        facing: desk.facing,
      });
    }
  }
  return seats;
}
