import * as Phaser from "phaser";
import type { PlayerState } from "@/shared/protocol";
import { ensureCharacterTexture } from "../characters/characterSprites";
import { SEAT_BY_ID } from "../maps/officeSeats";
import { Character } from "./Character";

/** Distância a partir da qual teleporta em vez de interpolar. */
const SNAP_DISTANCE = 160;

/** Outro jogador: segue o estado recebido do servidor com interpolação suave. */
export class RemotePlayer extends Character {
  private target = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, state: PlayerState) {
    super(scene, {
      x: state.x,
      y: state.y,
      speed: 0,
      textureKey: ensureCharacterTexture(scene, state.appearance, state.costume),
      facing: state.facing,
      name: state.name,
    });
    // Posição vem da rede: sem física própria.
    this.body.enable = false;
    this.target.set(state.x, state.y);
    this.applySeat(state.seatId);
    if (!state.seatId) {
      this.setPose(state.facing, state.anim);
      this.setActivity(state.activity);
    }
    this.setGear(state.ride, state.pet);
  }

  applyMove(x: number, y: number, facing: PlayerState["facing"], anim: PlayerState["anim"]) {
    if (this.seat) return;
    this.target.set(x, y);
    this.setPose(facing, anim);
  }

  applySeat(seatId: string | null) {
    const seat = seatId ? SEAT_BY_ID.get(seatId) : undefined;
    if (seat) {
      this.sitAt(seat);
      this.target.set(this.x, this.y);
    } else if (this.seat) {
      this.standUp();
      this.target.set(this.x, this.y);
    }
  }

  override preUpdate(time: number, delta: number) {
    if (!this.seat) {
      const distance = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
      if (distance > SNAP_DISTANCE) {
        this.setPosition(this.target.x, this.target.y);
      } else {
        const t = Math.min(1, (delta / 1000) * 12);
        this.setPosition(
          Phaser.Math.Linear(this.x, this.target.x, t),
          Phaser.Math.Linear(this.y, this.target.y, t),
        );
      }
    }
    super.preUpdate(time, delta);
  }
}
