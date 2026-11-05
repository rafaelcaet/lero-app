import * as Phaser from "phaser";
import { PLAYER_SPEED } from "../constants";
import { consumeInteract, getTouchDirection } from "../input/touchInput";
import { Character } from "./Character";

export interface PlayerOptions {
  x: number;
  y: number;
  textureKey: string;
  name?: string;
  speed?: number;
}

type MovementKeys = Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key[]>;

const NON_TEXT_INPUTS = new Set(["range", "checkbox", "radio", "button", "submit", "reset", "color", "file"]);

/** Foco num campo de texto (ex.: chat): o teclado não deve controlar o jogo. */
export function isTypingInForm(): boolean {
  const el = document.activeElement;
  return (
    // Sliders, checkboxes etc. não recebem texto: o jogo continua respondendo.
    (el instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(el.type)) ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

/** Personagem controlado pelo jogador via WASD/setas. */
export class Player extends Character {
  private readonly keys: MovementKeys;
  private readonly interactKey: Phaser.Input.Keyboard.Key;
  private readonly allKeys: Phaser.Input.Keyboard.Key[];

  constructor(scene: Phaser.Scene, { x, y, textureKey, name, speed = PLAYER_SPEED }: PlayerOptions) {
    super(scene, { x, y, speed, textureKey, name });

    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error("Keyboard plugin indisponível");
    const K = Phaser.Input.Keyboard.KeyCodes;
    const add = (code: number) => keyboard.addKey(code, true, false);
    this.keys = {
      up: [add(K.W), add(K.UP)],
      down: [add(K.S), add(K.DOWN)],
      left: [add(K.A), add(K.LEFT)],
      right: [add(K.D), add(K.RIGHT)],
    };
    this.interactKey = add(K.E);
    this.allKeys = [...Object.values(this.keys).flat(), this.interactKey];
  }

  /** Direção pedida pelo teclado (ou, sem teclado, pelo joystick de toque) neste frame. */
  readDirection(): { dx: number; dy: number } {
    if (isTypingInForm()) return { dx: 0, dy: 0 };
    const down = (keys: Phaser.Input.Keyboard.Key[]) => Number(keys.some((k) => k.isDown));
    const dx = down(this.keys.right) - down(this.keys.left);
    const dy = down(this.keys.down) - down(this.keys.up);
    if (dx !== 0 || dy !== 0) return { dx, dy };
    return getTouchDirection();
  }

  /** Teclas de movimento pressionadas neste frame. */
  wantsToMove(): boolean {
    const { dx, dy } = this.readDirection();
    return dx !== 0 || dy !== 0;
  }

  /**
   * Anda em direção a um ponto (coordenadas dos pés, o centro da hitbox).
   * Reduz a velocidade no último passo para não passar do ponto.
   * Devolve true quando chegou.
   */
  steerTo(x: number, y: number, deltaMs: number): boolean {
    const { center } = this.body;
    const vx = x - center.x;
    const vy = y - center.y;
    const sx = Math.abs(vx) < 1 ? 0 : Math.sign(vx);
    const sy = Math.abs(vy) < 1 ? 0 : Math.sign(vy);
    if (sx === 0 && sy === 0) return true;

    this.move(sx, sy);
    const dt = Math.max(deltaMs, 1) / 1000;
    const velocity = this.body.velocity;
    if (sx !== 0 && Math.abs(velocity.x * dt) > Math.abs(vx)) velocity.x = vx / dt;
    if (sy !== 0 && Math.abs(velocity.y * dt) > Math.abs(vy)) velocity.y = vy / dt;
    return false;
  }

  /** "E" (ou o botão de ação na tela) pressionado neste frame. */
  interactPressed(): boolean {
    const touched = consumeInteract();
    const pressed = Phaser.Input.Keyboard.JustDown(this.interactKey);
    return touched || (pressed && !isTypingInForm());
  }

  override destroy(fromScene?: boolean) {
    const keyboard = this.scene?.input.keyboard;
    if (keyboard) {
      for (const key of this.allKeys) keyboard.removeKey(key, true);
    }
    super.destroy(fromScene);
  }
}
