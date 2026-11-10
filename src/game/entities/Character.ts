import * as Phaser from "phaser";
import {
  animKey,
  createCharacterAnimations,
  frameIndex,
  type AnimState,
  type Direction,
} from "../characters/characterSprites";
import { ensureRideTexture, gearFrame, rideSpec } from "../graphics/gearSprites";
import type { Seat } from "../maps/seats";
import type { Activity } from "@/shared/activities";
import type { Bubble } from "@/shared/bubbles";
import { RIDE_SPEED, type PetKind, type RideKind } from "@/shared/shop";
import { ActivityEffects } from "./ActivityEffects";
import { Pet } from "./Pet";
import { SpeechBubble, type BubbleSide } from "./SpeechBubble";

/** Pose de cada atividade (de frente). */
const ACTIVITY_STATE = { eating: "eat", smoking: "smoke", sleeping: "sleep" } as const satisfies Record<Activity, AnimState>;

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
/** Dos pés (base do frame) ao centro do sprite. */
const FEET_BELOW_CENTER = 14;
const BODY_OFFSET = { x: 8, y: 20 } as const;
/** Boca em relação ao centro do sprite (x para o lado em que o balão aparece). */
const MOUTH = { x: 6, y: -5 } as const;

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
  private _ride: RideKind | null = null;
  private rideSprite: Phaser.GameObjects.Sprite | null = null;
  private rideKey = "";
  /** Quanto o desenho do personagem sobe no veículo (px). */
  private lift = 0;
  private pet: Pet | null = null;
  private _activity: Activity | null = null;
  private effects: ActivityEffects | null = null;
  private bubble: SpeechBubble | null = null;

  constructor(scene: Phaser.Scene, options: CharacterOptions) {
    const facing = options.facing ?? "down";
    super(scene, options.x, options.y, options.textureKey, frameIndex(facing, 0));
    this.skinKey = options.textureKey;
    this.speed = options.speed;
    this._facing = facing;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Hitbox reduzida nos pés: sensação top-down e passagem por portas de 2 tiles.
    this.body.setSize(16, 10).setOffset(BODY_OFFSET.x, BODY_OFFSET.y);
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

  get ride(): RideKind | null {
    return this._ride;
  }

  get activity(): Activity | null {
    return this._activity;
  }

  /** Começa (ou, com null, encerra) uma atividade: para e fica de frente fazendo algo. */
  setActivity(activity: Activity | null) {
    if (activity === this._activity) return;
    this._activity = activity;
    this.effects?.destroy();
    this.effects = activity ? new ActivityEffects(this.scene, activity) : null;
    if (activity) {
      this._facing = "down";
      this.body.setVelocity(0, 0);
    }
    this.playState(this._state, true);
  }

  /** Mostra um balão de fala (texto curto ou emote) ao lado da boca; substitui o anterior. */
  showBubble(bubble: Bubble) {
    this.bubble?.destroy();
    const created: SpeechBubble = new SpeechBubble(this.scene, bubble, this.bubbleSide(), () => {
      if (this.bubble === created) this.bubble = null;
    });
    this.bubble = created;
    this.updateBubble();
  }

  /** Olhando para a esquerda, o balão sai pela esquerda; nos outros casos, pela direita. */
  private bubbleSide(): BubbleSide {
    return this._facing === "left" ? -1 : 1;
  }

  private updateBubble() {
    const bubble = this.bubble;
    if (!bubble) return;
    const side = this.bubbleSide();
    bubble.setSide(side);
    bubble
      .setPosition(Math.round(this.x + side * MOUTH.x), Math.round(this.y + MOUTH.y - this.lift))
      .setDepth(this.depth + 3);
  }

  /** Velocidade atual (mais rápida de bicicleta/carro). */
  get currentSpeed(): number {
    return this.speed * (this._ride ? RIDE_SPEED[this._ride] : 1);
  }

  /** Veículo e mascote alugados na loja (null = nenhum). */
  setGear(ride: RideKind | null, pet: PetKind | null) {
    if (ride !== this._ride) {
      this._ride = ride;
      this.rideSprite?.destroy();
      this.rideSprite = null;
      if (ride) {
        this.rideKey = ensureRideTexture(this.scene, ride);
        this.rideSprite = this.scene.add.sprite(this.x, this.y, this.rideKey, gearFrame(this._facing)).setOrigin(0.5, 1);
      }
      this.playState(this._state, true);
    }
    if (pet !== (this.pet?.kind ?? null)) {
      this.pet?.destroy();
      this.pet = pet ? new Pet(this.scene, pet, this.x, this.y + FEET_BELOW_CENTER + 2) : null;
    }
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
          fontStyle: "bold",
          color: "#f8f8f8",
          backgroundColor: "#4b4e6de0",
          padding: { x: 3, y: 1 },
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
    if (this._activity && (dx !== 0 || dy !== 0)) this.setActivity(null);
    this.velocity.set(dx, dy).normalize().scale(this.currentSpeed);
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
    if (this._activity && state !== "walk") return; // parado fazendo algo: continua de frente
    if (state === "walk") this.setActivity(null);
    this._facing = facing;
    this.playState(state);
  }

  sitAt(seat: Seat) {
    this._seat = seat;
    this.setActivity(null);
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
    this.updateRide();
    // Ordenação por profundidade (quem está mais abaixo aparece na frente).
    this.setDepth(10 + this.y / 1000);
    this.nameTag?.setPosition(Math.round(this.x), Math.round(this.y - 17 - this.lift)).setDepth(this.depth + 1);
    this.effects?.update(delta, this.x, this.y - this.lift, this.depth + 2);
    this.updateBubble();
    if (this.rideSprite) this.rideSprite.setDepth(this.depth + 0.0005);

    const feetY = this.y + FEET_BELOW_CENTER;
    const gap = this._ride === "car" && !this._seat ? 36 : 22;
    this.pet?.follow(this.x, feetY, delta, gap);
  }

  /** Posiciona o veículo nos pés, sobe o desenho do personagem e gira as rodas. */
  private updateRide() {
    const sprite = this.rideSprite;
    const riding = Boolean(sprite && this._ride && !this._seat);
    const lift = riding ? (rideSpec(this._ride!).lift ?? 0) * 2 : 0;
    if (lift !== this.lift) {
      // Sobe só o desenho: a origem muda junto com o offset da hitbox, que fica no lugar.
      this.lift = lift;
      this.setOrigin(0.5, (this.height / 2 + lift) / this.height);
      this.body.setOffset(BODY_OFFSET.x, BODY_OFFSET.y + lift);
    }
    if (!sprite || !this._ride) return;
    sprite.setVisible(riding);
    if (!riding) return;
    const spec = rideSpec(this._ride);
    sprite.setPosition(Math.round(this.x), Math.round(this.y + FEET_BELOW_CENTER + 2 + spec.belowFeet * 2));
    if (this._state === "walk") {
      sprite.play(`${this.rideKey}-${this._facing}`, true);
    } else {
      sprite.stop();
      sprite.setFrame(gearFrame(this._facing));
    }
  }

  override destroy(fromScene?: boolean) {
    this.nameTag?.destroy();
    this.nameTag = null;
    this.effects?.destroy();
    this.effects = null;
    this.bubble?.destroy();
    this.bubble = null;
    this.rideSprite?.destroy();
    this.rideSprite = null;
    this.pet?.destroy();
    this.pet = null;
    super.destroy(fromScene);
  }

  /** Prioriza a direção horizontal na diagonal. */
  private static directionFrom(dx: number, dy: number): Direction {
    if (dx !== 0) return dx < 0 ? "left" : "right";
    return dy < 0 ? "up" : "down";
  }

  private playState(state: AnimState, force = false) {
    this._state = state;
    // No veículo o personagem não mexe as pernas: quem anda são as rodas.
    let shown: AnimState = state === "walk" && this._ride ? "idle" : state;
    if (this._activity && shown === "idle") shown = ACTIVITY_STATE[this._activity];
    this.play(animKey(this.skinKey, shown, this._facing), !force);
  }
}
