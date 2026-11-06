/**
 * Servidor único: Next.js (páginas e assets) + WebSocket do jogo em /ws,
 * na mesma porta. Assim um único endereço HTTPS (proxy, túnel ou hospedagem)
 * atende tudo — requisito para câmera/microfone fora do localhost.
 *
 * Uso:
 *   node server/main.mts --dev     (desenvolvimento)
 *   node server/main.mts           (produção, depois de `next build`)
 *
 * Variáveis de ambiente:
 *   PORT              porta HTTP (padrão 3000)
 *   HOST              interface (padrão 0.0.0.0, aceita conexões da rede)
 *   ICE_SERVERS       JSON com servidores STUN/TURN, ex.:
 *                     [{"urls":"turn:turn.exemplo.com:3478","username":"u","credential":"s"}]
 *   ALLOWED_ORIGINS   origens aceitas no WebSocket, separadas por vírgula (opcional)
 *   MONGODB_URI       string de conexão do MongoDB (sem ela, os dados ficam só em memória)
 *   MONGODB_DB        nome do banco (padrão "lero")
 *
 * As variáveis também podem ficar num arquivo .env.local (carregado pelos scripts do package.json).
 */
import { EventEmitter } from "node:events";
import { createServer, type Server } from "node:http";
import next from "next";
import { WS_PATH } from "../src/shared/protocol.ts";
import { createStore } from "./db/store.mts";
import { parseIceServers, parseList } from "./env.mts";
import { createRealtimeServer, SEAT_COUNT } from "./realtime.mts";

const dev = process.argv.includes("--dev");
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const iceServers = parseIceServers(process.env.ICE_SERVERS);
const allowedOrigins = parseList(process.env.ALLOWED_ORIGINS);

// O Next se registra sozinho no evento "upgrade" do servidor que recebe. Damos a ele
// um emissor próprio para que só receba os upgrades que não são do jogo (ex.: HMR).
const nextUpgrades = new EventEmitter();
const app = next({ dev, hostname: host, port, httpServer: nextUpgrades as unknown as Server });
await app.prepare();

const handleRequest = app.getRequestHandler();
const realtime = createRealtimeServer({ iceServers, allowedOrigins, store: await createStore() });

const server = createServer((req, res) => {
  void handleRequest(req, res);
});

server.on("upgrade", (req, socket, head) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (pathname === WS_PATH) realtime.handleUpgrade(req, socket, head);
  else nextUpgrades.emit("upgrade", req, socket, head);
});

server.listen(port, host, () => {
  const hasTurn = iceServers.some((s) => [s.urls].flat().some((u) => u.startsWith("turn")));
  console.log(`> ${dev ? "Desenvolvimento" : "Produção"} em http://localhost:${port}`);
  console.log(`> WebSocket do jogo em ws://localhost:${port}${WS_PATH} (${SEAT_COUNT} cadeiras)`);
  console.log(`> TURN ${hasTurn ? "configurado" : "não configurado (só STUN)"}`);
});

const shutdown = async () => {
  await realtime.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
