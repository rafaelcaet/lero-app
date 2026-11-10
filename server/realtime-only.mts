/**
 * Só o servidor de tempo real (sem Next.js), para quando o site está hospedado
 * em outro lugar (ex.: Vercel) que não suporta WebSocket.
 *
 * Uso: node server/realtime-only.mts
 *
 * Variáveis de ambiente:
 *   PORT              porta (padrão 3001; Railway/Render/Fly definem sozinhos)
 *   HOST              interface (padrão 0.0.0.0)
 *   ALLOWED_ORIGINS   domínios do site, separados por vírgula
 *                     ex.: https://lero-app-nu.vercel.app  (recomendado em produção)
 *   ICE_SERVERS       JSON com servidores STUN/TURN (veja server/main.mts)
 *   MONGODB_URI       string de conexão do MongoDB (sem ela, os dados ficam só em memória)
 *   MONGODB_DB        nome do banco (padrão "lero")
 *   AUTH_SECRET       segredo do login (obrigatório em produção; o mesmo do site)
 *
 * As variáveis também podem ficar num arquivo .env.local (carregado pelos scripts do package.json).
 */
import { createServer } from "node:http";
import { WS_PATH } from "../src/shared/protocol.ts";
import { createStore } from "./db/store.mts";
import { parseIceServers, parseList } from "./env.mts";
import { createRealtimeServer, SEAT_COUNT } from "./realtime.mts";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";
const iceServers = parseIceServers(process.env.ICE_SERVERS);
const allowedOrigins = parseList(process.env.ALLOWED_ORIGINS);

const realtime = createRealtimeServer({ iceServers, allowedOrigins, store: await createStore() });

// HTTP só para health check dos serviços de hospedagem.
const server = createServer((req, res) => {
  res.writeHead(req.url === "/health" || req.url === "/" ? 200 : 404, { "content-type": "text/plain" });
  res.end(req.url === "/health" || req.url === "/" ? "ok" : "not found");
});

server.on("upgrade", (req, socket, head) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (pathname === WS_PATH) realtime.handleUpgrade(req, socket, head);
  else socket.destroy();
});

server.listen(port, host, () => {
  console.log(`> Servidor do jogo em ws://localhost:${port}${WS_PATH} (${SEAT_COUNT} cadeiras)`);
  console.log(
    `> Origens permitidas: ${allowedOrigins.length ? allowedOrigins.join(", ") : "qualquer (defina ALLOWED_ORIGINS)"}`,
  );
});

const shutdown = async () => {
  await realtime.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
