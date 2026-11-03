import * as Phaser from "phaser";
import { LIMITS, type SitRejectReason } from "@/shared/protocol";
import type { Session } from "@/session/Session";
import type { Player } from "../entities/Player";
import { OFFICE_SEATS, SEAT_BY_ID } from "../maps/officeSeats";
import type { Seat } from "../maps/seats";

/** Um pouco menor que o limite do servidor, para o pedido nunca chegar "longe demais". */
const INTERACT_DISTANCE = LIMITS.sitDistance - 16;

const REJECT_TEXT: Record<SitRejectReason, string> = {
  occupied: "Cadeira ocupada",
  "too-far": "Chegue mais perto",
  "unknown-seat": "Cadeira inválida",
};

/**
 * Sentar/levantar com "E". O servidor é a autoridade: o jogador só senta
 * depois da confirmação, garantindo que duas pessoas não ocupem a mesma cadeira.
 */
export class SeatInteraction {
  private readonly prompt: Phaser.GameObjects.Text;
  private pendingSeatId: string | null = null;
  private readonly unsubscribers: Array<() => void>;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly session: Session,
  ) {
    this.prompt = scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#ffffff",
        backgroundColor: "#1b1d27dd",
        padding: { x: 3, y: 2 },
        resolution: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(1000)
      .setVisible(false);

    const offMessage = session.events.on("message", (msg) => {
      const selfId = session.getState().selfId;
      if (msg.type === "player-seated" && msg.id === selfId) {
        this.pendingSeatId = null;
        const seat = msg.seatId ? SEAT_BY_ID.get(msg.seatId) : undefined;
        if (seat) this.player.sitAt(seat);
        else this.player.standUp();
      } else if (msg.type === "sit-rejected") {
        this.pendingSeatId = null;
        this.flash(REJECT_TEXT[msg.reason]);
      } else if (msg.type === "welcome") {
        // Reconectou: o servidor não lembra a cadeira antiga.
        this.pendingSeatId = null;
        this.player.standUp();
      }
    });
    const offStatus = session.events.on("status", (status) => {
      if (status !== "open") this.pendingSeatId = null;
    });
    this.unsubscribers = [offMessage, offStatus];
  }

  /** Devolve true enquanto o jogador não pode andar (sentado ou aguardando o servidor). */
  update(): boolean {
    const { dx, dy } = this.player.readDirection();
    const interact = this.player.interactPressed();

    if (this.player.seat) {
      // Levanta com "E" ou ao tentar andar.
      if (interact || dx !== 0 || dy !== 0) this.stand();
      else this.showPrompt(this.player.x, this.player.y - 18, "[E] Levantar");
      return true;
    }

    if (this.pendingSeatId) {
      this.prompt.setVisible(false);
      return true;
    }

    const seat = this.nearestSeat();
    if (!seat) {
      this.prompt.setVisible(false);
      return false;
    }

    const occupied = this.session.occupiedSeats().has(seat.id);
    const online = this.session.getState().selfId !== null;
    const label = !online ? "Conectando…" : occupied ? "Ocupada" : "[E] Sentar";
    this.showPrompt(seat.x, seat.y - 14, label, occupied || !online);

    if (interact) {
      if (occupied) this.flash("Cadeira ocupada");
      else if (online) {
        this.pendingSeatId = seat.id;
        this.player.move(0, 0);
        this.session.requestSit(seat.id);
      }
    }
    return false;
  }

  destroy() {
    this.unsubscribers.forEach((off) => off());
    this.prompt.destroy();
  }

  private stand() {
    this.player.standUp();
    this.session.stand();
  }

  private nearestSeat(): Seat | null {
    let best: Seat | null = null;
    let bestDistance = INTERACT_DISTANCE;
    for (const seat of OFFICE_SEATS) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, seat.x, seat.y);
      if (d < bestDistance) {
        best = seat;
        bestDistance = d;
      }
    }
    return best;
  }

  private showPrompt(x: number, y: number, text: string, muted = false) {
    this.prompt
      .setText(text)
      .setColor(muted ? "#ff9b9b" : "#ffffff")
      .setPosition(Math.round(x), Math.round(y))
      .setVisible(true);
  }

  private flash(text: string) {
    const label = this.scene.add
      .text(Math.round(this.player.x), Math.round(this.player.y - 22), text, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#ff9b9b",
        backgroundColor: "#1b1d27dd",
        padding: { x: 3, y: 2 },
        resolution: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(1001);
    this.scene.tweens.add({
      targets: label,
      y: label.y - 10,
      alpha: 0,
      delay: 700,
      duration: 500,
      onComplete: () => label.destroy(),
    });
  }
}
