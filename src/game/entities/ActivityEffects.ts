import * as Phaser from "phaser";
import type { Activity } from "@/shared/activities";

type Particle = Phaser.GameObjects.Text | Phaser.GameObjects.Arc;

const SLEEP_LETTERS = ["z", "Z", "z"] as const;
/** Intervalo entre "z" soltos (ms) e entre baforadas de fumaça. */
const SLEEP_INTERVAL_MS = 750;
const SMOKE_INTERVAL_MS = 520;

/**
 * Partículas que acompanham uma atividade: "zZz" subindo da cabeça de quem dorme
 * e fumaça saindo do cigarro. Os objetos ficam no mundo (não seguem o personagem,
 * que está parado), com tween próprio, e somem sozinhos.
 */
export class ActivityEffects {
  private readonly particles = new Set<Particle>();
  private elapsed = 0;
  private count = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly activity: Activity,
  ) {
    // Já solta a primeira partícula na hora, para o efeito aparecer sem espera.
    this.elapsed = Number.POSITIVE_INFINITY;
  }

  /** (x, y) = centro do sprite (já descontada a elevação do veículo). */
  update(delta: number, x: number, y: number, depth: number) {
    if (this.activity === "eating") return;
    const interval = this.activity === "sleeping" ? SLEEP_INTERVAL_MS : SMOKE_INTERVAL_MS;
    this.elapsed += delta;
    if (this.elapsed < interval) return;
    this.elapsed = 0;
    if (this.activity === "sleeping") this.spawnZ(x, y, depth);
    else this.spawnSmoke(x, y, depth);
  }

  private track<T extends Particle>(object: T, tween: Omit<Phaser.Types.Tweens.TweenBuilderConfig, "targets">): T {
    this.particles.add(object);
    this.scene.tweens.add({
      ...tween,
      targets: object,
      onComplete: () => {
        this.particles.delete(object);
        object.destroy();
      },
    });
    return object;
  }

  private spawnZ(x: number, y: number, depth: number) {
    const letter = SLEEP_LETTERS[this.count++ % SLEEP_LETTERS.length];
    const big = letter === "Z";
    const text = this.scene.add
      .text(Math.round(x + 7), Math.round(y - 24), letter, {
        fontFamily: "monospace",
        fontSize: big ? "11px" : "8px",
        fontStyle: "bold",
        color: "#dff0ff",
        stroke: "#283048",
        strokeThickness: 2,
        resolution: 4,
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.track(text, {
      x: text.x + Phaser.Math.Between(6, 11),
      y: text.y - 17,
      alpha: { from: 1, to: 0 },
      scale: { from: 0.8, to: 1.35 },
      duration: 1900,
      ease: "Sine.easeOut",
    });
  }

  private spawnSmoke(x: number, y: number, depth: number) {
    // Sai da brasa (ao lado do rosto) e sobe espalhando, ficando mais clara e transparente.
    const puff = this.scene.add
      .circle(Math.round(x + 6), Math.round(y - 11), 1.5, 0xe4e4ee, 0.85)
      .setDepth(depth);
    this.track(puff, {
      x: puff.x + Phaser.Math.Between(-3, 4),
      y: puff.y - Phaser.Math.Between(14, 20),
      alpha: 0,
      scale: { from: 1, to: 2.8 },
      duration: 1700,
      ease: "Sine.easeOut",
    });
  }

  destroy() {
    for (const particle of this.particles) {
      this.scene?.tweens.killTweensOf(particle);
      particle.destroy();
    }
    this.particles.clear();
  }
}
