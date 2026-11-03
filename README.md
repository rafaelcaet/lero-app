# Gather Clone

Escritório 2D top-down (Next.js + Phaser 3) com cadeiras, chat de mesa e
chamada de voz/vídeo (WebRTC) entre quem senta na mesma mesa.

## Rodar localmente

```bash
pnpm install
pnpm dev                 # http://localhost:3000
pnpm build && pnpm start # produção
```

Um único processo (`server/main.mts`) serve o site **e** o WebSocket do jogo (`/ws`)
na mesma porta.

## Deixar outras pessoas entrarem

Câmera e microfone só funcionam em **HTTPS** (ou `localhost`). Acessar pelo IP da
rede (`http://192.168...`) funciona para andar e conversar por texto, mas o
navegador bloqueia câmera/microfone.

### Opção 1 — Link temporário (túnel, a partir do seu computador)

```bash
pnpm build && pnpm start   # terminal 1
pnpm share                 # terminal 2 → imprime https://xxxx.trycloudflare.com
```

Envie o link `https://...trycloudflare.com`. Funciona enquanto os dois comandos
estiverem rodando. Requer o [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

> Também funciona com `pnpm dev` (o domínio `*.trycloudflare.com` já é liberado).
> Para outro túnel (ex.: ngrok), libere o domínio: `ALLOWED_DEV_ORIGINS="*.ngrok-free.app" pnpm dev`.
> Sem isso, o Next bloqueia os scripts (403) e a página abre sem funcionar.

### Opção 2 — Hospedagem permanente (Docker)

Qualquer serviço que rode containers e suporte WebSocket (Railway, Render, Fly.io,
uma VPS…). **A Vercel não serve**: ela não mantém servidores WebSocket.

```bash
docker build -t gather-clone .
docker run -p 3000:3000 gather-clone
```

Coloque HTTPS na frente (a maioria dos serviços já faz isso automaticamente).

### TURN (recomendado para uso pela internet)

Sem TURN, a chamada se conecta direto entre os navegadores (STUN). Isso funciona na
maioria das redes, mas falha em algumas corporativas ou móveis. Configure um servidor
TURN (ex.: coturn próprio ou um serviço gerenciado) via variável de ambiente:

```bash
ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.exemplo.com:3478","username":"usuario","credential":"senha"}]' pnpm start
```

### Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `3000` | Porta HTTP/WebSocket |
| `HOST` | `0.0.0.0` | Interface de rede |
| `ICE_SERVERS` | STUN do Google | Servidores STUN/TURN (JSON) enviados aos clientes |
| `ALLOWED_ORIGINS` | qualquer | Origens aceitas no WebSocket, separadas por vírgula |
| `ALLOWED_DEV_ORIGINS` | — | Domínios externos liberados no `pnpm dev` |
| `NEXT_PUBLIC_WS_URL` | mesma origem `/ws` | WebSocket em outro endereço (build) |

## Limites conhecidos

- O estado (jogadores, cadeiras) fica na memória de **um** processo: rode uma única instância.
- A chamada é em malha (cada pessoa conecta com todas da mesa): ideal até ~4–5 pessoas por mesa.
# lero-app
