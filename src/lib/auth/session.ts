/**
 * Sessão do site (cookie httpOnly assinado). Só no servidor: Server Components,
 * Server Actions e o proxy (src/proxy.ts).
 */
import { cookies } from "next/headers";
import { GAME_TICKET_TTL_S, SESSION_TTL_S, signToken, verifyToken, type TokenPayload } from "./token";
import type { User } from "./users";

export const SESSION_COOKIE = "lero_session";

export interface Session {
  userId: string;
  name: string;
  /** Chave do jogador (carteira). Só no servidor: não vai para o navegador. */
  playerKey: string;
}

const toSession = (p: TokenPayload): Session => ({ userId: p.sub, name: p.name, playerKey: p.key });

export function readSessionToken(token: string | undefined): Session | null {
  const payload = verifyToken(token, "session");
  return payload ? toSession(payload) : null;
}

/** Sessão atual ou null. Lê o cookie: chame dentro de um <Suspense>. */
export async function getSession(): Promise<Session | null> {
  return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function startSession(user: Pick<User, "id" | "name" | "playerKey">): Promise<void> {
  const token = signToken({ kind: "session", sub: user.id, key: user.playerKey, name: user.name }, SESSION_TTL_S);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Ingresso de curta duração para o servidor do jogo, que pode estar em outro domínio. */
export function createGameTicket(session: Session): string {
  return signToken({ kind: "game", sub: session.userId, key: session.playerKey, name: session.name }, GAME_TICKET_TTL_S);
}
