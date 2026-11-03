import * as Phaser from "phaser";
import type { Session } from "@/session/Session";
import { createGameConfig } from "./config";
import { setSession } from "./registry";

/** Ponto de entrada do jogo. Deve ser importado apenas no navegador. */
export function createGame(parent: HTMLElement, session: Session): Phaser.Game {
  const game = new Phaser.Game(createGameConfig(parent));
  setSession(game, session);
  return game;
}
