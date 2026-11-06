/**
 * Importa as carteiras do arquivo JSON antigo (.data/wallets.json) para o MongoDB.
 * Carteiras que já existem no banco não são alteradas.
 *
 * Uso: pnpm db:import-wallets [caminho]   (padrão .data/wallets.json)
 */
import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";
import { collections, ensureSchema } from "../server/db/schema.mts";
import { isWalletKey, sanitizeWallet } from "../server/wallets.mts";

const file = process.argv[2] ?? ".data/wallets.json";
const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error("Defina MONGODB_URI (no ambiente ou no .env.local).");
  process.exit(1);
}
const dbName = process.env.MONGODB_DB?.trim() || "lero";

const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
const entries = Object.entries(data).filter(([key]) => isWalletKey(key));
const now = new Date();

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
try {
  await client.connect();
  const db = client.db(dbName);
  await ensureSchema(db);
  const { wallets } = collections(db);
  if (entries.length === 0) {
    console.log(`Nenhuma carteira em ${file}.`);
  } else {
    const result = await wallets.bulkWrite(
      entries.map(([key, raw]) => {
        const wallet = sanitizeWallet(raw);
        return {
          updateOne: {
            filter: { _id: key },
            update: {
              $setOnInsert: {
                coins: wallet.coins,
                rentals: wallet.rentals.map((r) => ({ ...r, expiresAt: new Date(r.expiresAt) })),
                ride: wallet.ride,
                updatedAt: now,
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
    console.log(`${result.upsertedCount} carteira(s) importada(s); ${entries.length - result.upsertedCount} já existia(m).`);
  }
} finally {
  await client.close();
}
