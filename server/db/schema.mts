/**
 * Collections do MongoDB: formato dos documentos, validação ($jsonSchema) e índices.
 *
 * `ensureSchema()` é idempotente: cria o que falta e atualiza validadores e índices
 * do que já existe. Roda sempre que o servidor sobe (e em `pnpm db:setup`).
 *
 * A "chave do jogador" (`playerKey`) é a chave gerada e guardada no navegador
 * (veja src/session/walletKey.ts). Ela funciona como senha da carteira: fica
 * só no servidor e no banco, nunca é enviada a outros jogadores.
 */
import type { Collection, Db, Document, IndexDescription } from "mongodb";
import type { Appearance } from "../../src/shared/appearance.ts";
import type { PetKind, RideKind, ShopItemId } from "../../src/shared/shop.ts";

// --- documentos -----------------------------------------------------------

/** `players`: perfil de cada jogador (um por chave de navegador). */
export interface PlayerDoc {
  _id: string; // playerKey
  name: string;
  appearance: Appearance;
  /** Onde estava ao sair do escritório. */
  lastPosition: { x: number; y: number } | null;
  /** Tempo total conectado (ms), somado a cada sessão encerrada. */
  totalOnlineMs: number;
  createdAt: Date;
  lastSeenAt: Date;
}

export interface RentalDoc {
  item: ShopItemId;
  expiresAt: Date;
  pet?: PetKind;
}

/** `wallets`: Lerocoins, aluguéis ativos e veículo em uso. */
export interface WalletDoc {
  _id: string; // playerKey
  coins: number;
  rentals: RentalDoc[];
  ride: RideKind | null;
  updatedAt: Date;
}

/** `purchases`: histórico de compras na loja (um documento por aluguel ou renovação). */
export interface PurchaseDoc {
  _id: string;
  playerKey: string;
  item: ShopItemId;
  pet: PetKind | null;
  price: number;
  /** "new" = aluguel novo; "extend" = mais uma hora num aluguel ativo. */
  kind: "new" | "extend";
  /** Fim do aluguel depois desta compra. */
  expiresAt: Date;
  /** Saldo depois da compra. */
  coinsAfter: number;
  createdAt: Date;
}

/** `chat_messages`: mensagens do chat de cada mesa. */
export interface ChatMessageDoc {
  _id: string;
  tableId: string;
  playerKey: string;
  /** Id da conexão de quem enviou (o que os clientes conhecem). */
  fromId: string;
  fromName: string;
  text: string;
  createdAt: Date;
}

/** `direct_messages`: mensagens diretas (DMs) entre dois jogadores. */
export interface DirectMessageDoc {
  _id: string;
  fromKey: string;
  toKey: string;
  fromName: string;
  toName: string;
  text: string;
  createdAt: Date;
}

/** `sessions`: cada entrada no escritório (da conexão até a saída). */
export interface SessionDoc {
  _id: string;
  playerKey: string;
  /** Id da conexão durante a sessão. */
  connectionId: string;
  name: string;
  connectedAt: Date;
  disconnectedAt: Date | null;
  durationMs: number | null;
}

export interface Collections {
  players: Collection<PlayerDoc>;
  wallets: Collection<WalletDoc>;
  purchases: Collection<PurchaseDoc>;
  chatMessages: Collection<ChatMessageDoc>;
  directMessages: Collection<DirectMessageDoc>;
  sessions: Collection<SessionDoc>;
}

export const COLLECTION_NAMES = {
  players: "players",
  wallets: "wallets",
  purchases: "purchases",
  chatMessages: "chat_messages",
  directMessages: "direct_messages",
  sessions: "sessions",
} as const satisfies Record<keyof Collections, string>;

export function collections(db: Db): Collections {
  return {
    players: db.collection<PlayerDoc>(COLLECTION_NAMES.players),
    wallets: db.collection<WalletDoc>(COLLECTION_NAMES.wallets),
    purchases: db.collection<PurchaseDoc>(COLLECTION_NAMES.purchases),
    chatMessages: db.collection<ChatMessageDoc>(COLLECTION_NAMES.chatMessages),
    directMessages: db.collection<DirectMessageDoc>(COLLECTION_NAMES.directMessages),
    sessions: db.collection<SessionDoc>(COLLECTION_NAMES.sessions),
  };
}

// --- validação e índices ---------------------------------------------------

const str = { bsonType: "string" };
const date = { bsonType: "date" };
// O driver grava inteiros fora da faixa de 32 bits como double: aceita os três.
const nonNegative = { bsonType: ["int", "long", "double"], minimum: 0 };
const shopItem = { enum: ["bike", "car", "pet"] };
const petKind = { enum: ["pikachu", "squirtle", "charmander", "bulbasaur"] };

interface CollectionSpec {
  validator: Document;
  indexes: IndexDescription[];
}

const SPECS: Record<keyof Collections, CollectionSpec> = {
  players: {
    validator: {
      bsonType: "object",
      required: ["_id", "name", "appearance", "totalOnlineMs", "createdAt", "lastSeenAt"],
      properties: {
        _id: str,
        name: { bsonType: "string", maxLength: 64 },
        appearance: { bsonType: "object" },
        lastPosition: {
          bsonType: ["object", "null"],
          required: ["x", "y"],
          properties: { x: { bsonType: "number" }, y: { bsonType: "number" } },
        },
        totalOnlineMs: nonNegative,
        createdAt: date,
        lastSeenAt: date,
      },
    },
    indexes: [{ key: { lastSeenAt: -1 }, name: "lastSeenAt" }],
  },
  wallets: {
    validator: {
      bsonType: "object",
      required: ["_id", "coins", "rentals", "ride", "updatedAt"],
      properties: {
        _id: str,
        coins: nonNegative,
        rentals: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["item", "expiresAt"],
            properties: { item: shopItem, expiresAt: date, pet: petKind },
          },
        },
        ride: { enum: ["bike", "car", null] },
        updatedAt: date,
      },
    },
    indexes: [{ key: { coins: -1 }, name: "coins" }],
  },
  purchases: {
    validator: {
      bsonType: "object",
      required: ["_id", "playerKey", "item", "price", "kind", "expiresAt", "coinsAfter", "createdAt"],
      properties: {
        _id: str,
        playerKey: str,
        item: shopItem,
        pet: { enum: [...petKind.enum, null] },
        price: nonNegative,
        kind: { enum: ["new", "extend"] },
        expiresAt: date,
        coinsAfter: nonNegative,
        createdAt: date,
      },
    },
    indexes: [
      { key: { playerKey: 1, createdAt: -1 }, name: "playerKey_createdAt" },
      { key: { item: 1, createdAt: -1 }, name: "item_createdAt" },
    ],
  },
  chatMessages: {
    validator: {
      bsonType: "object",
      required: ["_id", "tableId", "playerKey", "fromId", "fromName", "text", "createdAt"],
      properties: {
        _id: str,
        tableId: str,
        playerKey: str,
        fromId: str,
        fromName: str,
        text: { bsonType: "string", maxLength: 2000 },
        createdAt: date,
      },
    },
    indexes: [
      { key: { tableId: 1, createdAt: -1 }, name: "tableId_createdAt" },
      { key: { playerKey: 1, createdAt: -1 }, name: "playerKey_createdAt" },
    ],
  },
  directMessages: {
    validator: {
      bsonType: "object",
      required: ["_id", "fromKey", "toKey", "fromName", "toName", "text", "createdAt"],
      properties: {
        _id: str,
        fromKey: str,
        toKey: str,
        fromName: str,
        toName: str,
        text: { bsonType: "string", maxLength: 4000 },
        createdAt: date,
      },
    },
    indexes: [
      { key: { fromKey: 1, toKey: 1, createdAt: -1 }, name: "fromKey_toKey_createdAt" },
      { key: { toKey: 1, createdAt: -1 }, name: "toKey_createdAt" },
    ],
  },
  sessions: {
    validator: {
      bsonType: "object",
      required: ["_id", "playerKey", "connectionId", "name", "connectedAt"],
      properties: {
        _id: str,
        playerKey: str,
        connectionId: str,
        name: str,
        connectedAt: date,
        disconnectedAt: { bsonType: ["date", "null"] },
        durationMs: { bsonType: ["int", "long", "double", "null"], minimum: 0 },
      },
    },
    indexes: [
      { key: { playerKey: 1, connectedAt: -1 }, name: "playerKey_connectedAt" },
      { key: { connectedAt: -1 }, name: "connectedAt" },
    ],
  },
};

/** Cria (ou atualiza) as collections, os validadores e os índices. */
export async function ensureSchema(db: Db): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const [key, spec] of Object.entries(SPECS) as Array<[keyof Collections, CollectionSpec]>) {
    const name = COLLECTION_NAMES[key];
    const validation = {
      validator: { $jsonSchema: spec.validator },
      validationLevel: "moderate" as const,
      validationAction: "error" as const,
    };
    if (!existing.has(name)) await db.createCollection(name, validation);
    else {
      try {
        await db.command({ collMod: name, ...validation });
      } catch (err) {
        // Usuários só com permissão de leitura/escrita não podem rodar collMod: segue com o validador atual.
        console.warn(`[db] não foi possível atualizar o validador de "${name}": ${(err as Error).message}`);
      }
    }
    if (spec.indexes.length > 0) await db.collection(name).createIndexes(spec.indexes);
  }
}
