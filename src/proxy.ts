/**
 * Porta de entrada: o escritório (/) exige login; quem já está logado não vê
 * as telas de login/cadastro. A página e as Server Actions conferem de novo
 * a sessão por conta própria (o proxy é só o primeiro filtro).
 */
import { NextResponse, type NextRequest } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

const AUTH_PAGES = new Set(["/login", "/cadastro"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (AUTH_PAGES.has(pathname)) {
    return session ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (!session) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    // Cookie vencido ou adulterado: limpa para não ficar reenviando.
    if (request.cookies.has(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE);
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/cadastro"],
};
