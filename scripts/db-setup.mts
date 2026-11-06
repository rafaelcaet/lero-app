/**
 * Cria (ou atualiza) as collections, validadores e índices do MongoDB.
 * O servidor já faz isso ao subir; este script serve para preparar o banco antes.
 *
 * Uso: pnpm db:setup   (lê MONGODB_URI e MONGODB_DB do ambiente ou do .env.local)
 */
import { MongoClient } from "mongodb";
import { COLLECTION_NAMES, ensureSchema } from "../server/db/schema.mts";

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error("Defina MONGODB_URI (no ambiente ou no .env.local).");
  process.exit(1);
}
const dbName = process.env.MONGODB_DB?.trim() || "lero";

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
try {
  await client.connect();
  const db = client.db(dbName);
  await ensureSchema(db);
  console.log(`Banco "${dbName}" pronto:`);
  for (const name of Object.values(COLLECTION_NAMES)) {
    const collection = db.collection(name);
    const [count, indexes] = await Promise.all([collection.estimatedDocumentCount(), collection.indexes()]);
    console.log(`  ${name.padEnd(16)} ${String(count).padStart(6)} doc(s)  índices: ${indexes.map((i) => i.name).join(", ")}`);
  }
} finally {
  await client.close();
}
