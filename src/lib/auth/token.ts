/**
 * Tokens assinados (HMAC-SHA256) usados no login. Puro node:crypto, sem Next:
 * é importado pelo site (cookie de sessão) e pelo servidor do jogo (ingresso do WebSocket).
 *
 * Formato: base64url(JSON do payload) + "." + base64url(assinatura).
 *
 * - "session": vai no cookie httpOnly do site. Prova que o navegador está logado.
 * - "game": ingresso de curta duração entregue à página e enviado no "join" do
 *   WebSocket. O servidor do jogo pode estar em outro domínio (ex.: Fly.io), onde
 *   o cookie não chega; por isso ele confere este ingresso com o mesmo AUTH_SECRET.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type TokenKind = "session" | "game";

export interface TokenPayload {
  kind: TokenKind;
  /** Id do usuário. */
  sub: string;
  /** Chave do jogador (carteira, perfil e histórico no banco). */
  key: string;
  /** Nome exibido no escritório. */
  name: string;
  /** Expiração em segundos desde a época (Unix). */
  exp: number;
}

export const SESSION_TTL_S = 60 * 60 * 24 * 30; // 30 dias
export const GAME_TICKET_TTL_S = 60 * 60 * 24; // 1 dia

const DEV_SECRET = "lero-dev-secret-nao-use-em-producao-0123456789";
let warnedDevSecret = false;

/**
 * Segredo das assinaturas. Em produção AUTH_SECRET é obrigatória (e precisa ser
 * a mesma no site e no servidor do jogo); em desenvolvimento cai num valor fixo.
 */
export function authSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.AUTH_SECRET?.trim();
  if (secret) {
    if (secret.length < 32) throw new Error("[auth] AUTH_SECRET precisa ter pelo menos 32 caracteres.");
    return secret;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("[auth] defina AUTH_SECRET (ex.: `openssl rand -base64 32`) — o mesmo valor no site e no servidor do jogo.");
  }
  if (!warnedDevSecret) {
    warnedDevSecret = true;
    console.warn("[auth] AUTH_SECRET não definida: usando segredo de desenvolvimento.");
  }
  return DEV_SECRET;
}

const sign = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("base64url");

export function signToken(payload: Omit<TokenPayload, "exp">, ttlSeconds: number, secret = authSecret()): string {
  const full: TokenPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const data = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

/** Payload do token se a assinatura confere, o tipo bate e não expirou; senão null. */
export function verifyToken(token: unknown, kind: TokenKind, secret = authSecret()): TokenPayload | null {
  if (typeof token !== "string" || token.length > 2048) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = Buffer.from(sign(data, secret), "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as TokenPayload;
    if (payload.kind !== kind || typeof payload.sub !== "string" || typeof payload.key !== "string") return null;
    if (typeof payload.name !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
