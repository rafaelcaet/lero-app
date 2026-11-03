/** Leitura das variáveis de ambiente compartilhadas pelos servidores. */

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export function parseIceServers(raw: string | undefined): RTCIceServer[] {
  if (!raw) return DEFAULT_ICE_SERVERS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    console.warn("[server] ICE_SERVERS inválido (esperado JSON); usando STUN padrão.");
  }
  return DEFAULT_ICE_SERVERS;
}

/** "a, b,c" → ["a", "b", "c"] */
export function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
