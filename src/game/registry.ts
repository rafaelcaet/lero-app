import type * as Phaser from "phaser";
import type { Session } from "@/session/Session";

const SESSION_KEY = "session";

/** A sessão multiplayer fica no registry global do Phaser, acessível às cenas. */
export function setSession(game: Phaser.Game, session: Session) {
  game.registry.set(SESSION_KEY, session);
}

export function getSession(scene: Phaser.Scene): Session {
  const session = scene.registry.get(SESSION_KEY) as Session | undefined;
  if (!session) throw new Error("Sessão não registrada no jogo");
  return session;
}
