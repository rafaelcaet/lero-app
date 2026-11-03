import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Em desenvolvimento o Next bloqueia scripts pedidos de outros domínios (ex.: túnel),
  // e a página fica sem JavaScript. Libera os túneis usados em `pnpm share` e outros
  // domínios listados em ALLOWED_DEV_ORIGINS (separados por vírgula). Só vale no `pnpm dev`.
  allowedDevOrigins: [
    "*.trycloudflare.com",
    ...(process.env.ALLOWED_DEV_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
