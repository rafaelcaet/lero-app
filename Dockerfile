# Imagem de produção: Next.js + WebSocket do jogo numa única porta.
FROM node:24-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "server/main.mts"]
