/**
 * Gera public/assets/maps/office.json (formato Tiled) a partir do layout em código.
 * Uso: pnpm map:export
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOfficeLayout } from "../src/game/maps/officeLayout.ts";
import { toTiledJson } from "../src/game/maps/tiledFormat.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "public/assets/maps/office.json");

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(toTiledJson(createOfficeLayout()), null, 2) + "\n");
console.log(`Mapa exportado para ${out}`);
