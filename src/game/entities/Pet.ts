import * as Phaser from "phaser";
import type { PetKind } from "@/shared/shop";
import { ensurePetTexture, gearFrame, type GearDirection } from "../graphics/gearSprites";

/** Longe demais do dono (ex.: teleporte ou entrou agora): reaparece ao lado dele. */
const SNAP_DISTANCE = 220;
/** Distância mínima entre pontos do rastro do dono. */
const TRAIL_STEP = 4;
const MAX_TRAIL = 200;

/**
 * Mascote alugado: só segue o dono, andando pelo rastro dele (assim contorna
 * as paredes pelo mesmo caminho). Não tem física nem interação.
 */
export class Pet extends Phaser.GameObjects.Sprite {
  readonly kind: PetKind;
  private readonly textureKey: string;
  private readonly trail: Phaser.Math.Vector2[] = [];
  private dir: GearDirection = "down";
  private moving = false;

  constructor(scene: Phaser.Scene, kind: PetKind, x: number, y: number) {
    const key = ensurePetTexture(scene, kind);
    super(scene, x, y, key, gearFrame("down"));
    this.kind = kind;
    this.textureKey = key;
    this.setOrigin(0.5, 1);
    scene.add.existing(this);
    this.playAnim();
  }

  /**
   * Chamado pelo dono a cada frame com a posição dos pés dele.
   * `gap` = quão perto o mascote fica (maior quando o dono está de carro).
   */
  follow(ownerX: number, ownerY: number, deltaMs: number, gap: number) {
    if (Phaser.Math.Distance.Between(this.x, this.y, ownerX, ownerY) > SNAP_DISTANCE) {
      this.trail.length = 0;
      this.setPosition(ownerX, ownerY + 2);
    }

    const last = this.trail[this.trail.length - 1] ?? new Phaser.Math.Vector2(this.x, this.y);
    if (Phaser.Math.Distance.Between(last.x, last.y, ownerX, ownerY) >= TRAIL_STEP) {
      this.trail.push(new Phaser.Math.Vector2(ownerX, ownerY));
      if (this.trail.length > MAX_TRAIL) this.trail.shift();
    }

    const behind = Phaser.Math.Distance.Between(this.x, this.y, ownerX, ownerY);
    let moving = false;
    if (behind > gap && this.trail.length > 0) {
      // Quanto mais para trás, mais rápido (alcança até o carro).
      let budget = Phaser.Math.Clamp((behind - gap) * 7, 50, 420) * (deltaMs / 1000);
      let dx = 0;
      let dy = 0;
      while (budget > 0 && this.trail.length > 0) {
        const target = this.trail[0];
        const tx = target.x - this.x;
        const ty = target.y - this.y;
        const dist = Math.hypot(tx, ty);
        if (dist <= budget) {
          this.setPosition(target.x, target.y);
          this.trail.shift();
          budget -= dist;
        } else {
          this.setPosition(this.x + (tx / dist) * budget, this.y + (ty / dist) * budget);
          budget = 0;
        }
        dx += tx;
        dy += ty;
      }
      if (dx !== 0 || dy !== 0) {
        moving = true;
        this.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
      }
    } else if (behind <= gap / 2) {
      // Parado perto do dono: olha para ele.
      const dx = ownerX - this.x;
      const dy = ownerY - this.y;
      if (Math.hypot(dx, dy) > 4) {
        this.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
      }
    }
    this.moving = moving;
    this.playAnim();
    // Mesma regra de profundidade dos personagens (que usam o centro, ~15 px acima dos pés).
    this.setDepth(10 + (this.y - 15) / 1000);
  }

  private playAnim() {
    this.play(`${this.textureKey}-${this.dir}${this.moving ? "" : "-slow"}`, true);
  }
}
