import { CLOSE_UNAUTHORIZED, type ClientMessage, type ServerMessage } from "@/shared/protocol";
import { Emitter } from "./Emitter";

/** "unauthorized": o servidor recusou o login (ingresso vencido); não reconecta. */
export type ConnectionStatus = "connecting" | "open" | "closed" | "unauthorized";

type NetworkEvents = {
  status: ConnectionStatus;
  message: ServerMessage;
};

const RECONNECT_DELAY_MS = 2000;

/** WebSocket com reconexão automática e mensagens tipadas. */
export class NetworkClient extends Emitter<NetworkEvents> {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(private readonly url: string) {
    super();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.connect();
  }

  stop() {
    this.running = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onclose = ws.onmessage = ws.onerror = null;
      ws.close();
    }
    this.emit("status", "closed");
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private connect() {
    this.emit("status", "connecting");
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => this.emit("status", "open");
    ws.onmessage = (event) => {
      try {
        this.emit("message", JSON.parse(String(event.data)) as ServerMessage);
      } catch {
        // mensagem inválida: ignora
      }
    };
    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (event.code === CLOSE_UNAUTHORIZED) {
        // Tentar de novo com o mesmo ingresso daria no mesmo: precisa entrar de novo.
        this.running = false;
        this.emit("status", "unauthorized");
        return;
      }
      this.emit("status", "closed");
      if (this.running) {
        this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
      }
    };
  }
}
