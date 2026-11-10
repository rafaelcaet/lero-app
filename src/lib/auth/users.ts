/**
 * Contas de usuário do site. Usa a collection `users` do MongoDB quando
 * MONGODB_URI está definida; sem ela, guarda só em memória (desenvolvimento).
 * Só roda no servidor (Server Actions e Server Components).
 */
import { randomUUID } from "node:crypto";
import { MongoClient, MongoServerError, type Collection } from "mongodb";
import { COLLECTION_NAMES, USER_INDEXES, type UserDoc } from "../../../server/db/schema.mts";

export interface User {
  id: string;
  email: string;
  name: string;
  playerKey: string;
  passwordHash: string;
}

export class EmailTakenError extends Error {
  constructor() {
    super("E-mail já cadastrado");
  }
}

const KEY_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

const toUser = (doc: UserDoc): User => ({
  id: doc._id,
  email: doc.email,
  name: doc.name,
  playerKey: doc.playerKey,
  passwordHash: doc.passwordHash,
});

// Conexão reaproveitada entre requisições (e entre recargas do dev server).
const globalForUsers = globalThis as typeof globalThis & {
  __leroUsers?: Promise<Collection<UserDoc>>;
  __leroMemoryUsers?: Map<string, UserDoc>;
};

function mongoUri(): string | undefined {
  return process.env.MONGODB_URI?.trim() || undefined;
}

async function connect(uri: string): Promise<Collection<UserDoc>> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000, appName: "lero-web" });
  await client.connect();
  const users = client.db(process.env.MONGODB_DB?.trim() || "lero").collection<UserDoc>(COLLECTION_NAMES.users);
  await users.createIndexes(USER_INDEXES);
  return users;
}

function usersCollection(uri: string): Promise<Collection<UserDoc>> {
  globalForUsers.__leroUsers ??= connect(uri).catch((err) => {
    globalForUsers.__leroUsers = undefined; // tenta de novo na próxima requisição
    throw err;
  });
  return globalForUsers.__leroUsers;
}

function memoryUsers(): Map<string, UserDoc> {
  if (!globalForUsers.__leroMemoryUsers) {
    console.warn("[auth] MONGODB_URI não definida: contas só em memória (somem ao reiniciar).");
    globalForUsers.__leroMemoryUsers = new Map();
  }
  return globalForUsers.__leroMemoryUsers;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function findUserByEmail(email: string): Promise<User | null> {
  const normalized = normalizeEmail(email);
  const uri = mongoUri();
  if (!uri) {
    const doc = [...memoryUsers().values()].find((u) => u.email === normalized);
    return doc ? toUser(doc) : null;
  }
  const doc = await (await usersCollection(uri)).findOne({ email: normalized });
  return doc ? toUser(doc) : null;
}

export async function touchLogin(userId: string): Promise<void> {
  const uri = mongoUri();
  if (!uri) {
    const doc = memoryUsers().get(userId);
    if (doc) doc.lastLoginAt = new Date();
    return;
  }
  await (await usersCollection(uri)).updateOne({ _id: userId }, { $set: { lastLoginAt: new Date() } });
}

/**
 * Cria a conta. `legacyKey` é a chave de carteira que o navegador usava antes do
 * login: se for válida e nenhuma conta a usar ainda, a conta herda as Lerocoins dela.
 */
export async function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  legacyKey?: string | null;
}): Promise<User> {
  const now = new Date();
  const base = {
    _id: randomUUID(),
    email: normalizeEmail(input.email),
    name: input.name,
    passwordHash: input.passwordHash,
    createdAt: now,
    lastLoginAt: now,
  };
  const legacy = input.legacyKey && KEY_PATTERN.test(input.legacyKey) ? input.legacyKey : null;

  const uri = mongoUri();
  if (!uri) {
    const users = memoryUsers();
    const all = [...users.values()];
    if (all.some((u) => u.email === base.email)) throw new EmailTakenError();
    const playerKey = legacy && !all.some((u) => u.playerKey === legacy) ? legacy : randomUUID();
    const doc: UserDoc = { ...base, playerKey };
    users.set(doc._id, doc);
    return toUser(doc);
  }

  const users = await usersCollection(uri);
  for (const playerKey of legacy ? [legacy, randomUUID()] : [randomUUID()]) {
    const doc: UserDoc = { ...base, playerKey };
    try {
      await users.insertOne(doc);
      return toUser(doc);
    } catch (err) {
      if (!(err instanceof MongoServerError) || err.code !== 11000) throw err;
      if (err.keyPattern?.email) throw new EmailTakenError();
      // Chave antiga já pertence a outra conta: tenta de novo com uma nova.
    }
  }
  throw new Error("Não foi possível criar a conta.");
}
