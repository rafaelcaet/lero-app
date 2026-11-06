import * as Phaser from "phaser";
import { BUBBLE_DURATION_MS, type Bubble, type Emote } from "@/shared/bubbles";
import { EMOTE_SCALE, EMOTE_SIZE, renderEmote } from "../graphics/emoteArt";
import { addRgbaTexture } from "../graphics/rgbaTexture";

/** Lado do personagem em que o balão aparece: 1 = direita, -1 = esquerda. */
export type BubbleSide = 1 | -1;

type Rect = readonly [x: number, y: number, w: number, h: number];

const FILL = 0xf8f8f8;
const OUTLINE = 0x283048;
/** Distância horizontal entre a ponta do rabinho (na boca) e o corpo do balão. */
const TAIL_LENGTH = 4;
const TEXT_PAD_X = 3;
const TEXT_PAD_Y = 1;
const POP_MS = 160;
const FADE_MS = 260;

function ensureEmoteTexture(scene: Phaser.Scene, emote: Emote): string {
  const key = `emote-${emote}`;
  if (!scene.textures.exists(key)) addRgbaTexture(scene, key, renderEmote(emote));
  return key;
}

/**
 * Balão de fala em pixel art ao lado da boca do personagem, com texto curto ou
 * emote. A origem do container é a ponta do rabinho: o personagem só precisa
 * posicioná-la na boca. Aparece com um "pop", some sozinho e avisa em `onDone`.
 */
export class SpeechBubble extends Phaser.GameObjects.Container {
  private readonly shape: Phaser.GameObjects.Graphics;
  private readonly content: Phaser.GameObjects.Text | Phaser.GameObjects.Image;
  /** Tamanho da área branca (sem contorno). */
  private readonly bodyW: number;
  private readonly bodyH: number;
  private side: BubbleSide;

  constructor(scene: Phaser.Scene, bubble: Bubble, side: BubbleSide, onDone: () => void) {
    super(scene, 0, 0);
    this.side = side;
    this.shape = scene.add.graphics();

    if (bubble.kind === "text") {
      this.content = scene.add
        .text(0, 0, bubble.text, {
          fontFamily: "monospace",
          fontSize: "8px",
          fontStyle: "bold",
          color: "#283048",
          resolution: 4,
        })
        .setOrigin(0.5);
      this.bodyW = Math.ceil(this.content.width) + TEXT_PAD_X * 2;
      this.bodyH = Math.ceil(this.content.height) + TEXT_PAD_Y * 2;
    } else {
      this.content = scene.add.image(0, 0, ensureEmoteTexture(scene, bubble.emote)).setOrigin(0.5);
      // O emote já tem 1 pixel virtual de margem transparente em volta.
      this.bodyW = this.bodyH = (EMOTE_SIZE - 1) * EMOTE_SCALE;
    }

    this.add([this.shape, this.content]);
    this.draw();
    scene.add.existing(this);

    this.setScale(0.4);
    scene.tweens.add({ targets: this, scale: 1, duration: POP_MS, ease: "Back.easeOut" });
    scene.tweens.add({
      targets: this,
      alpha: 0,
      delay: BUBBLE_DURATION_MS - FADE_MS,
      duration: FADE_MS,
      onComplete: () => {
        onDone();
        this.destroy();
      },
    });
  }

  /** Troca o lado (ex.: o personagem virou para a esquerda). */
  setSide(side: BubbleSide) {
    if (side === this.side) return;
    this.side = side;
    this.draw();
  }

  /**
   * Desenha o balão em retângulos (estilo pixel art): o contorno é a mesma forma
   * aumentada em 1 px, pintada antes do preenchimento.
   */
  private draw() {
    const { bodyW: w, bodyH: h } = this;
    const bx = TAIL_LENGTH;
    // Corpo com os cantos "chanfrados", centralizado na altura do rabinho
    // (assim não cresce para cima e não cobre o nome do jogador).
    const top = -2 - Math.floor((h - 1) / 2);
    const body: Rect[] = [
      [bx + 1, top, w - 2, h],
      [bx, top + 1, w, h - 2],
    ];
    // Rabinho em degraus apontando para a boca (ponta em (1, -1)).
    const tail: Rect[] = [
      [1, -1, bx, 1],
      [2, -2, bx, 1],
      [3, -3, bx, 1],
    ];
    const mirror = ([x, y, rw, rh]: Rect): Rect => (this.side === 1 ? [x, y, rw, rh] : [-(x + rw), y, rw, rh]);
    const shapes = [...body, ...tail].map(mirror);

    const g = this.shape.clear();
    g.fillStyle(OUTLINE, 1);
    for (const [x, y, rw, rh] of shapes) g.fillRect(x - 1, y - 1, rw + 2, rh + 2);
    g.fillStyle(FILL, 1);
    for (const [x, y, rw, rh] of shapes) g.fillRect(x, y, rw, rh);

    const cx = this.side * (bx + w / 2);
    this.content.setPosition(Math.round(cx), Math.round(top + h / 2));
  }

  override destroy(fromScene?: boolean) {
    this.scene?.tweens.killTweensOf(this);
    super.destroy(fromScene);
  }
}
