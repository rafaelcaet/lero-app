/**
 * Persistência do servidor do jogo. Duas implementações com a mesma interface:
 *
 * - MongoStore: grava no MongoDB (quando MONGODB_URI está definida).
 * - MemoryStore: só em memória, para desenvolver sem banco (perde tudo ao reiniciar).
 *
 * O jogo em si continua rodando em memória (veja server/realtime.mts); o store só
 * recebe o que precisa sobreviver a reinícios e devolve o que precisa ser recarregado.
 */
import { randomUUID } from "node:crypto";
import { MongoClient, type AnyBulkWriteOperation } from "mongodb";
import type { Appearance } from "../../src/shared/appearance.ts";
import type { ChatMessage } from "../../src/shared/protocol.ts";
import type { PetKind, Rental, ShopItemId, Wallet } from "../../src/shared/shop.ts";
import { collections, ensureSchema, type Collections, type WalletDoc } from "./schema.mts";

export interface PlayerProfile {
  name: string;
  appearance: Appearance;
}

export interface Purchase {
  playerKey: string;
  item: ShopItemId;
  pet: PetKind | null;
  price: number;
  kind: "new" | "extend" | "buy";
  /** null na compra definitiva (não expira). */
  expiresAt: number | null;
  coinsAfter: number;
}

/** Mensagem de mesa com a chave de quem enviou (só no servidor). */
export interface StoredChatMessage extends ChatMessage {
  playerKey: string;
}

export interface StoredDirectMessage {
  id: string;
  fromKey: string;
  toKey: string;
  fromName: string;
  toName: string;
  text: string;
  ts: number;
}

export interface Store {
  readonly kind: "mongo" | "memory";
  /** Carteira salva, ou null se a chave nunca foi vista. */
  loadWallet(playerKey: string): Promise<Wallet | null>;
  saveWallets(entries: ReadonlyArray<readonly [string, Wallet]>): Promise<void>;
  /** Atualiza o perfil e abre uma sessão. Devolve o id da sessão. */
  playerJoined(playerKey: string, connectionId: string, profile: PlayerProfile, at: number): Promise<string>;
  /** Fecha a sessão e guarda onde o jogador estava. */
  playerLeft(
    playerKey: string,
    sessionId: string,
    position: { x: number; y: number },
    connectedAt: number,
    at: number,
  ): Promise<void>;
  recordPurchase(purchase: Purchase): Promise<void>;
  saveChatMessage(message: StoredChatMessage): Promise<void>;
  /** Últimas mensagens da mesa, da mais antiga para a mais nova. */
  recentChat(tableId: string, limit: number): Promise<StoredChatMessage[]>;
  saveDirectMessage(message: StoredDirectMessage): Promise<void>;
  close(): Promise<void>;
}

// --- MongoDB ---------------------------------------------------------------

const toWalletDoc = (playerKey: string, wallet: Wallet, now: Date): WalletDoc => ({
  _id: playerKey,
  coins: wallet.coins,
  rentals: wallet.rentals.map((r) => ({
    item: r.item,
    expiresAt: new Date(r.expiresAt),
    ...(r.pet ? { pet: r.pet } : {}),
  })),
  owned: wallet.owned.map((o) => ({ item: o.item, ...(o.pet ? { pet: o.pet } : {}) })),
  ride: wallet.ride,
  costume: wallet.costume,
  updatedAt: now,
});

const fromWalletDoc = (doc: WalletDoc): Wallet => ({
  coins: doc.coins,
  rentals: doc.rentals.map((r): Rental => ({
    item: r.item,
    expiresAt: r.expiresAt.getTime(),
    ...(r.pet ? { pet: r.pet } : {}),
  })),
  owned: (doc.owned ?? []).map((o) => ({ item: o.item, ...(o.pet ? { pet: o.pet } : {}) })),
  ride: doc.ride,
  costume: doc.costume ?? null,
});

export class MongoStore implements Store {
  readonly kind = "mongo";
  private readonly client: MongoClient;
  private readonly c: Collections;

  private constructor(client: MongoClient, c: Collections) {
    this.client = client;
    this.c = c;
  }

  /** Conecta, garante collections/índices e devolve o store pronto. */
  static async connect(uri: string, dbName: string): Promise<MongoStore> {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000, appName: "lero-realtime" });
    await client.connect();
    const db = client.db(dbName);
    await ensureSchema(db);
    return new MongoStore(client, collections(db));
  }

  async loadWallet(playerKey: string): Promise<Wallet | null> {
    const doc = await this.c.wallets.findOne({ _id: playerKey });
    return doc ? fromWalletDoc(doc) : null;
  }

  async saveWallets(entries: ReadonlyArray<readonly [string, Wallet]>): Promise<void> {
    if (entries.length === 0) return;
    const now = new Date();
    const ops: AnyBulkWriteOperation<WalletDoc>[] = entries.map(([key, wallet]) => ({
      replaceOne: { filter: { _id: key }, replacement: toWalletDoc(key, wallet, now), upsert: true },
    }));
    await this.c.wallets.bulkWrite(ops, { ordered: false });
  }

  async playerJoined(playerKey: string, connectionId: string, profile: PlayerProfile, at: number): Promise<string> {
    const now = new Date(at);
    const sessionId = randomUUID();
    await Promise.all([
      this.c.players.updateOne(
        { _id: playerKey },
        {
          $set: { name: profile.name, appearance: profile.appearance, lastSeenAt: now },
          $setOnInsert: { lastPosition: null, totalOnlineMs: 0, createdAt: now },
        },
        { upsert: true },
      ),
      this.c.sessions.insertOne({
        _id: sessionId,
        playerKey,
        connectionId,
        name: profile.name,
        connectedAt: now,
        disconnectedAt: null,
        durationMs: null,
      }),
    ]);
    return sessionId;
  }

  async playerLeft(
    playerKey: string,
    sessionId: string,
    position: { x: number; y: number },
    connectedAt: number,
    at: number,
  ): Promise<void> {
    const now = new Date(at);
    const durationMs = Math.max(0, at - connectedAt);
    await Promise.all([
      this.c.players.updateOne(
        { _id: playerKey },
        { $set: { lastSeenAt: now, lastPosition: { x: position.x, y: position.y } }, $inc: { totalOnlineMs: durationMs } },
      ),
      this.c.sessions.updateOne({ _id: sessionId }, { $set: { disconnectedAt: now, durationMs } }),
    ]);
  }

  async recordPurchase(p: Purchase): Promise<void> {
    await this.c.purchases.insertOne({
      _id: randomUUID(),
      playerKey: p.playerKey,
      item: p.item,
      pet: p.pet,
      price: p.price,
      kind: p.kind,
      expiresAt: p.expiresAt === null ? null : new Date(p.expiresAt),
      coinsAfter: p.coinsAfter,
      createdAt: new Date(),
    });
  }

  async saveChatMessage(m: StoredChatMessage): Promise<void> {
    await this.c.chatMessages.insertOne({
      _id: m.id,
      tableId: m.tableId,
      playerKey: m.playerKey,
      fromId: m.fromId,
      fromName: m.fromName,
      text: m.text,
      createdAt: new Date(m.ts),
    });
  }

  async recentChat(tableId: string, limit: number): Promise<StoredChatMessage[]> {
    const docs = await this.c.chatMessages.find({ tableId }).sort({ createdAt: -1 }).limit(limit).toArray();
    return docs.reverse().map((d) => ({
      id: d._id,
      tableId: d.tableId,
      playerKey: d.playerKey,
      fromId: d.fromId,
      fromName: d.fromName,
      text: d.text,
      ts: d.createdAt.getTime(),
    }));
  }

  async saveDirectMessage(m: StoredDirectMessage): Promise<void> {
    await this.c.directMessages.insertOne({
      _id: m.id,
      fromKey: m.fromKey,
      toKey: m.toKey,
      fromName: m.fromName,
      toName: m.toName,
      text: m.text,
      createdAt: new Date(m.ts),
    });
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

// --- memória -----------------------------------------------------------------

/** Sem banco: guarda carteiras e o chat recente só enquanto o processo roda. */
export class MemoryStore implements Store {
  readonly kind = "memory";
  private readonly wallets = new Map<string, Wallet>();
  private readonly chat = new Map<string, StoredChatMessage[]>();

  async loadWallet(playerKey: string): Promise<Wallet | null> {
    const wallet = this.wallets.get(playerKey);
    return wallet ? structuredClone(wallet) : null;
  }

  async saveWallets(entries: ReadonlyArray<readonly [string, Wallet]>): Promise<void> {
    for (const [key, wallet] of entries) this.wallets.set(key, structuredClone(wallet));
  }

  async playerJoined(): Promise<string> {
    return randomUUID();
  }

  async playerLeft(): Promise<void> {}

  async recordPurchase(): Promise<void> {}

  async saveChatMessage(message: StoredChatMessage): Promise<void> {
    const list = this.chat.get(message.tableId) ?? [];
    list.push(message);
    this.chat.set(message.tableId, list.slice(-MEMORY_CHAT_LIMIT));
  }

  async recentChat(tableId: string, limit: number): Promise<StoredChatMessage[]> {
    return (this.chat.get(tableId) ?? []).slice(-limit);
  }

  async saveDirectMessage(): Promise<void> {}

  async close(): Promise<void> {}
}

const MEMORY_CHAT_LIMIT = 100;

/**
 * Store a partir das variáveis de ambiente:
 *   MONGODB_URI  string de conexão (sem ela, usa memória)
 *   MONGODB_DB   nome do banco (padrão "lero")
 */
export async function createStore(env: NodeJS.ProcessEnv = process.env): Promise<Store> {
  const uri = env.MONGODB_URI?.trim();
  if (!uri) {
    console.warn("[db] MONGODB_URI não definida: dados só em memória (somem ao reiniciar).");
    return new MemoryStore();
  }
  const dbName = env.MONGODB_DB?.trim() || "lero";
  try {
    const store = await MongoStore.connect(uri, dbName);
    console.log(`[db] MongoDB conectado (banco "${dbName}").`);
    return store;
  } catch (err) {
    // Com banco configurado, não sobe sem ele: rodar só em memória perderia dados em silêncio.
    throw new Error(`[db] não foi possível conectar ao MongoDB: ${(err as Error).message}`, { cause: err });
  }
}
