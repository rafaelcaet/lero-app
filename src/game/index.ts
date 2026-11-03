import * as Phaser from "phaser";
import type { Session } from "@/session/Session";
import { createGameConfig } from "./config";
import { isTypingInForm } from "./entities/Player";
import { setSession } from "./registry";

/**
 * O Phaser escuta o teclado na janela inteira e chama preventDefault nas teclas
 * do jogo (WASD, setas, E), o que impediria digitar essas letras no chat e na DM.
 * Enquanto o foco está num campo de texto, a tecla não chega ao Phaser.
 */
function shieldTextFields(): () => void {
  const stop = (event: KeyboardEvent) => {
    if (isTypingInForm()) event.stopPropagation();
  };
  document.addEventListener("keydown", stop);
  document.addEventListener("keyup", stop);
  return () => {
    document.removeEventListener("keydown", stop);
    document.removeEventListener("keyup", stop);
  };
}

/** Ponto de entrada do jogo. Deve ser importado apenas no navegador. */
export function createGame(parent: HTMLElement, session: Session): Phaser.Game {
  const game = new Phaser.Game(createGameConfig(parent));
  setSession(game, session);
  const unshield = shieldTextFields();
  game.events.once(Phaser.Core.Events.DESTROY, unshield);
  return game;
}
