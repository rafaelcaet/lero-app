import * as Phaser from "phaser";
import { PLAYER_SPEED } from "../constants";
import { Character } from "./Character";

export interface PlayerOptions {
  x: number;
  y: number;
  textureKey: string;
  name?: string;
  speed?: number;
}

type MovementKeys = Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key[]>;

/** Foco num campo de texto (ex.: chat): o teclado não deve controlar o jogo. */
export function isTypingInForm(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
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

  /** Direção pedida pelo teclado neste frame. */
  readDirection(): { dx: number; dy: number } {
    if (isTypingInForm()) return { dx: 0, dy: 0 };
    const down = (keys: Phaser.Input.Keyboard.Key[]) => Number(keys.some((k) => k.isDown));
    return {
      dx: down(this.keys.right) - down(this.keys.left),
      dy: down(this.keys.down) - down(this.keys.up),
    };
  }

  /** "E" pressionado neste frame. */
  interactPressed(): boolean {
    const pressed = Phaser.Input.Keyboard.JustDown(this.interactKey);
    return pressed && !isTypingInForm();
  }

  override destroy(fromScene?: boolean) {
    const keyboard = this.scene?.input.keyboard;
    if (keyboard) {
      for (const key of this.allKeys) keyboard.removeKey(key, true);
    }
    super.destroy(fromScene);
  }
}
