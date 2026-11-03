import * as Phaser from "phaser";
import {
  animKey,
  createCharacterAnimations,
  frameIndex,
  type AnimState,
  type Direction,
} from "../characters/characterSprites";
import type { Seat } from "../maps/seats";

export interface CharacterOptions {
  x: number;
  y: number;
  textureKey: string;
  speed: number;
  facing?: Direction;
  name?: string;
}

/** Deslocamento vertical do sprite em relação ao centro da cadeira ao sentar. */
const SEAT_OFFSET_Y = -8;
/** Deslocamento do centro do sprite para a hitbox (nos pés) ficar no centro do tile. */
export const FEET_OFFSET_Y = -9;

/**
 * Personagem genérico com física Arcade, animações e etiqueta de nome.
 * Não sabe de onde vem o comando de movimento: o Player usa teclado e o
 * RemotePlayer aplica o estado recebido do servidor.
 */
export class Character extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  protected readonly speed: number;
  private skinKey: string;
  private _facing: Direction;
  private _state: AnimState = "idle";
  private _seat: Seat | null = null;
  private readonly velocity = new Phaser.Math.Vector2();
  private nameTag: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, options: CharacterOptions) {
    const facing = options.facing ?? "down";
    super(scene, options.x, options.y, options.textureKey, frameIndex(facing, 0));
    this.skinKey = options.textureKey;
    this.speed = options.speed;
    this._facing = facing;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Hitbox reduzida nos pés: sensação top-down e passagem por portas de 2 tiles.
    this.body.setSize(16, 10).setOffset(8, 20);
    this.setCollideWorldBounds(true);

    createCharacterAnimations(scene, this.skinKey);
    if (options.name) this.setDisplayName(options.name);
    this.playState("idle");
  }

  get facing(): Direction {
    return this._facing;
  }

  get animState(): AnimState {
    return this._state;
  }

  get seat(): Seat | null {
    return this._seat;
  }

  /** Troca a paleta de cores (textura) mantendo a pose atual. */
  setSkin(textureKey: string) {
    if (textureKey === this.skinKey) return;
    this.skinKey = textureKey;
    createCharacterAnimations(this.scene, textureKey);
    this.playState(this._state, true);
  }

  setDisplayName(name: string) {
    if (!this.nameTag) {
      this.nameTag = this.scene.add
        .text(this.x, this.y, name, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#ffffff",
          backgroundColor: "#00000088",
          padding: { x: 2, y: 1 },
          resolution: 4,
        })
        .setOrigin(0.5, 1);
    } else {
      this.nameTag.setText(name);
    }
  }

  /**
   * Move na direção (dx, dy) ∈ {-1, 0, 1}. A velocidade é normalizada na diagonal.
   * Se o personagem estiver empurrando uma parede, toca idle em vez de walk.
   */
  move(dx: number, dy: number) {
    if (this._seat) return;
    this.velocity.set(dx, dy).normalize().scale(this.speed);
    this.body.setVelocity(this.velocity.x, this.velocity.y);

    if (dx === 0 && dy === 0) {
      this.playState("idle");
      return;
    }

    const { blocked } = this.body;
    const freeX = (dx < 0 && blocked.left) || (dx > 0 && blocked.right) ? 0 : dx;
    const freeY = (dy < 0 && blocked.up) || (dy > 0 && blocked.down) ? 0 : dy;

    // Usa o eixo que de fato está se movendo (deslizando na parede, por exemplo).
    const [fx, fy] = freeX !== 0 || freeY !== 0 ? [freeX, freeY] : [dx, dy];
    this._facing = Character.directionFrom(fx, fy);
    this.playState(freeX === 0 && freeY === 0 ? "idle" : "walk");
  }

  /** Aplica uma pose vinda de fora (ex.: estado de outro jogador). */
  setPose(facing: Direction, state: AnimState) {
    this._facing = facing;
    this.playState(state);
  }

  sitAt(seat: Seat) {
    this._seat = seat;
    this.body.stop();
    this.body.reset(seat.x, seat.y + SEAT_OFFSET_Y);
    this._facing = seat.facing;
    this.playState("sit");
  }

  /** Levanta e fica de pé sobre a cadeira (cadeiras são atravessáveis). */
  standUp() {
    if (!this._seat) return;
    const seat = this._seat;
    this._seat = null;
    this.body.reset(seat.x, seat.y + FEET_OFFSET_Y);
    this.playState("idle");
  }

  override preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    // Ordenação por profundidade (quem está mais abaixo aparece na frente).
    this.setDepth(10 + this.y / 1000);
    this.nameTag?.setPosition(Math.round(this.x), Math.round(this.y - 15)).setDepth(this.depth + 1);
  }

  override destroy(fromScene?: boolean) {
    this.nameTag?.destroy();
    this.nameTag = null;
    super.destroy(fromScene);
  }

  /** Prioriza a direção horizontal na diagonal. */
  private static directionFrom(dx: number, dy: number): Direction {
    if (dx !== 0) return dx < 0 ? "left" : "right";
    return dy < 0 ? "up" : "down";
  }

  private playState(state: AnimState, force = false) {
    this._state = state;
    this.play(animKey(this.skinKey, state, this._facing), !force);
  }
}
