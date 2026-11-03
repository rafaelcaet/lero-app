import * as Phaser from "phaser";
import type { Session } from "@/session/Session";
import { TILE_SIZE } from "../constants";
import { FEET_OFFSET_Y, type Character } from "../entities/Character";
import type { Player } from "../entities/Player";
import type { SeatInteraction } from "./SeatInteraction";

/** Para a esta distância (px, entre os pés) para não ficar em cima do outro. */
const STOP_DISTANCE = 36;
/** Recalcula o caminho periodicamente, mesmo que o alvo não mude de tile. */
const REPLAN_INTERVAL_MS = 600;
/** Sem sair do lugar por este tempo: considera preso e recalcula. */
const STUCK_TIMEOUT_MS = 700;

interface Tile {
  x: number;
  y: number;
}

/**
 * "Seguir" um jogador: caminha até ele desviando das paredes (busca em largura
 * na camada de colisão) e continua acompanhando enquanto ele se move.
 *
 * O alvo vem de `session.getState().followTargetId`, definido pela interface.
 * Cancela quando o jogador usa o teclado ou senta, ou quando o alvo sai.
 */
export class FollowPlayer {
  private targetId: string | null = null;
  private path: Tile[] = [];
  private goalKey = "";
  private plannedAt = 0;
  private lastProgress = { x: 0, y: 0, at: 0 };
  private elapsed = 0;

  constructor(
    private readonly player: Player,
    private readonly collisionLayer: Phaser.Tilemaps.TilemapLayer,
    private readonly session: Session,
    private readonly seats: SeatInteraction,
    private readonly findRemote: (id: string) => Character | undefined,
  ) {}

  /**
   * Roda antes do sistema de cadeiras: começa/cancela o seguir.
   * Ao começar, levanta se estiver sentado.
   */
  beforeUpdate() {
    const id = this.session.getState().followTargetId;
    if (!id) {
      if (this.targetId) this.reset(true);
      return;
    }

    if (this.player.wantsToMove()) {
      this.session.stopFollow();
      this.reset(false);
      return;
    }

    if (id !== this.targetId) {
      this.reset(true);
      this.targetId = id;
      if (this.player.seat) this.seats.stand();
      return;
    }

    // Sentou durante o caminho (ex.: apertou "E" perto de uma cadeira): para de seguir.
    if (this.player.seat) {
      this.session.stopFollow();
      this.reset(false);
    }
  }

  /** Move o jogador em direção ao alvo. Devolve true se controlou o movimento neste frame. */
  update(time: number, delta: number): boolean {
    if (!this.targetId) return false;
    this.elapsed = time;

    const remote = this.findRemote(this.targetId);
    if (!remote) {
      this.session.stopFollow();
      this.reset(true);
      return false;
    }

    const feet = this.player.body.center;
    const goalX = remote.x;
    const goalY = remote.y - FEET_OFFSET_Y;

    if (Phaser.Math.Distance.Between(feet.x, feet.y, goalX, goalY) <= STOP_DISTANCE) {
      this.path = [];
      this.player.move(0, 0);
      this.lastProgress = { x: feet.x, y: feet.y, at: time };
      return true;
    }

    const goal = this.toTile(goalX, goalY);
    const key = `${goal.x},${goal.y}`;
    const stuck = this.isStuck(feet.x, feet.y, time);
    if (key !== this.goalKey || this.path.length === 0 || stuck || time - this.plannedAt > REPLAN_INTERVAL_MS) {
      this.path = this.findPath(this.toTile(feet.x, feet.y), goal);
      this.goalKey = key;
      this.plannedAt = time;
    }

    const next = this.path[0];
    if (!next) {
      this.player.move(0, 0);
      return true;
    }

    const arrived = this.player.steerTo(
      next.x * TILE_SIZE + TILE_SIZE / 2,
      next.y * TILE_SIZE + TILE_SIZE / 2,
      delta,
    );
    if (arrived) this.path.shift();
    return true;
  }

  private reset(stopMoving: boolean) {
    if (stopMoving && this.targetId) this.player.move(0, 0);
    this.targetId = null;
    this.path = [];
    this.goalKey = "";
    this.lastProgress = { x: 0, y: 0, at: this.elapsed };
  }

  private isStuck(x: number, y: number, time: number): boolean {
    const last = this.lastProgress;
    if (Phaser.Math.Distance.Between(x, y, last.x, last.y) > 2) {
      this.lastProgress = { x, y, at: time };
      return false;
    }
    if (time - last.at > STUCK_TIMEOUT_MS) {
      this.lastProgress = { x, y, at: time };
      return true;
    }
    return false;
  }

  private toTile(x: number, y: number): Tile {
    const { width, height } = this.collisionLayer.layer;
    return {
      x: Phaser.Math.Clamp(Math.floor(x / TILE_SIZE), 0, width - 1),
      y: Phaser.Math.Clamp(Math.floor(y / TILE_SIZE), 0, height - 1),
    };
  }

  private isFree(x: number, y: number): boolean {
    const tile = this.collisionLayer.getTileAt(x, y);
    return !tile || !tile.collides;
  }

  /**
   * Busca em largura (4 direções) do tile atual até o alvo.
   * Se o alvo for inalcançável, vai até o tile alcançável mais próximo dele.
   * O tile de partida não entra no caminho.
   */
  private findPath(start: Tile, goal: Tile): Tile[] {
    const { width, height } = this.collisionLayer.layer;
    const index = (t: Tile) => t.y * width + t.x;
    const cameFrom = new Map<number, number>([[index(start), -1]]);
    const queue: Tile[] = [start];
    let best = start;
    let bestDistance = Math.abs(start.x - goal.x) + Math.abs(start.y - goal.y);

    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      const distance = Math.abs(current.x - goal.x) + Math.abs(current.y - goal.y);
      if (distance < bestDistance) {
        best = current;
        bestDistance = distance;
      }
      if (distance === 0) break;

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { x: current.x + dx, y: current.y + dy };
        if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height) continue;
        const id = index(next);
        if (cameFrom.has(id) || !this.isFree(next.x, next.y)) continue;
        cameFrom.set(id, index(current));
        queue.push(next);
      }
    }

    const path: Tile[] = [];
    for (let id = index(best); id !== index(start); id = cameFrom.get(id)!) {
      path.push({ x: id % width, y: Math.floor(id / width) });
    }
    return path.reverse();
  }
}
