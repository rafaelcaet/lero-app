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

## Banco de dados (MongoDB)

O servidor do jogo guarda no MongoDB tudo que precisa sobreviver a reinícios.
Configure a conexão num `.env.local` (veja `.env.example`) ou em variáveis de ambiente:

```bash
cp .env.example .env.local   # preencha MONGODB_URI (e MONGODB_DB, padrão "lero")
pnpm db:setup                # cria collections, validadores e índices (o servidor também faz ao subir)
pnpm db:import-wallets       # opcional: importa as carteiras do antigo .data/wallets.json
```

Sem `MONGODB_URI` o jogo funciona, mas os dados ficam só em memória.

| Collection | O que guarda |
|---|---|
| `players` | Perfil de cada jogador: nome, aparência, última posição, tempo total online |
| `wallets` | Lerocoins, aluguéis ativos e veículo em uso |
| `purchases` | Histórico de compras na loja (aluguel novo ou renovação, preço, saldo depois) |
| `chat_messages` | Chat de cada mesa — as últimas 50 mensagens aparecem para quem senta |
| `direct_messages` | Mensagens diretas (DMs) entre jogadores |
| `sessions` | Cada entrada no escritório: quando conectou, quando saiu, duração |

Todas usam como identificador do jogador a chave gerada no navegador (`lero:wallet-key`
no localStorage). Ela nunca é enviada a outros jogadores.

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

### Opção 3 — Site na Vercel + servidor do jogo separado

A Vercel não mantém WebSocket, então o servidor do jogo roda em outro serviço
(Railway, Render, Fly.io…) e o site na Vercel se conecta a ele.

**Servidor do jogo** (no Render: novo *Web Service* apontando para este repositório):

| Campo | Valor |
|---|---|
| Build Command | `pnpm install` |
| Start Command | `pnpm start:realtime` |
| Health Check Path | `/health` |
| Variável `ALLOWED_ORIGINS` | `https://SEU-APP.vercel.app` |
| Variável `ICE_SERVERS` | (opcional) servidores TURN |
| Variável `MONGODB_URI` | string de conexão do MongoDB (veja "Banco de dados") |

**Vercel** → *Settings → Environment Variables*:

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_WS_URL` | `wss://SEU-SERVIDOR.onrender.com/ws` |

Depois faça **Redeploy** na Vercel: variáveis `NEXT_PUBLIC_*` entram no build.
As configurações de *Build and Deployment* podem ficar no padrão.

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
| `WALLETS_FILE` | `.data/wallets.json` | Onde o servidor salva as Lerocoins (vazio = só memória) |
| `ALLOWED_DEV_ORIGINS` | — | Domínios externos liberados no `pnpm dev` |
| `NEXT_PUBLIC_WS_URL` | mesma origem `/ws` | WebSocket em outro endereço, ex.: site na Vercel (build) |

## Lerocoins e loja

- Cada jogador ganha **1 Lerocoin a cada 10 s online** (contado no servidor; várias abas da
  mesma carteira não somam em dobro).
- Na **Loja** (canto superior esquerdo do jogo) dá para alugar por 1 hora: **bicicleta**
  (60, 1,6× mais rápido), **carro** (150, 2× mais rápido) e **mascote** (100: Pikachu,
  Squirtle, Charmander ou Bulbasaur, sorteado, que segue o dono). Alugar de novo soma
  mais 1 hora (até 24 h). Veículos podem ser usados/guardados enquanto estiverem alugados.
- A carteira é identificada por uma chave gerada e guardada no navegador
  (`localStorage`, `lero:wallet-key`): trocar de navegador ou limpar os dados começa do zero.
- O servidor salva as carteiras em `WALLETS_FILE` a cada 30 s e ao desligar. No Fly.io o
  disco da máquina é apagado a cada deploy: para manter as moedas, monte um volume e aponte
  `WALLETS_FILE` para ele (ex.: `/data/wallets.json`).

## Limites conhecidos

- O estado (jogadores, cadeiras) fica na memória de **um** processo: rode uma única instância.
- A chamada é em malha (cada pessoa conecta com todas da mesa): ideal até ~4–5 pessoas por mesa.
# lero-app
