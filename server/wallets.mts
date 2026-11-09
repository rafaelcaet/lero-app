/**
 * Carteiras de Lerocoins e aluguéis, por chave de carteira (gerada e guardada
 * no navegador). Ficam em cache na memória enquanto alguém as usa; o que muda
 * é gravado no store (MongoDB) de tempos em tempos e ao desligar o servidor.
 */
import {
  activeRental,
  hasItem,
  isCostumeId,
  isPetKind,
  isRideKind,
  isShopItemId,
  type CostumeId,
  type OwnedItem,
  type PetKind,
  type RideKind,
  type Rental,
  type Wallet,
} from "../src/shared/shop.ts";
import type { Store } from "./db/store.mts";

export interface StoredWallet extends Wallet {
  /** Chave da carteira (só no servidor). */
  key: string;
  /** Quando ganhou moeda pela última vez (ms). Só vale enquanto está online. */
  lastAwardAt: number;
}

const KEY_PATTERN = /^[A-Za-z0-9-]{16,64}$/;
const SAVE_INTERVAL_MS = 5_000;

export const isWalletKey = (v: unknown): v is string => typeof v === "string" && KEY_PATTERN.test(v);

export interface Gear {
  ride: RideKind | null;
  pet: PetKind | null;
  costume: CostumeId | null;
}

/** Veículo, mascote e fantasia ativos agora (o que os outros jogadores veem). Comprado vale mais que alugado. */
export function gearOf(wallet: Wallet, now: number): Gear {
  const ride = wallet.ride && hasItem(wallet, wallet.ride, now) ? wallet.ride : null;
  const costume = wallet.costume && hasItem(wallet, wallet.costume, now) ? wallet.costume : null;
  const ownedPet = wallet.owned.find((o) => o.item === "pet")?.pet;
  return { ride, pet: ownedPet ?? activeRental(wallet, "pet", now)?.pet ?? null, costume };
}

/** Versão enviada ao cliente e gravada no banco (sem campos internos). */
export function publicWallet(wallet: Wallet): Wallet {
  return {
    coins: wallet.coins,
    rentals: wallet.rentals.map((r) => ({ ...r })),
    owned: wallet.owned.map((o) => ({ ...o })),
    ride: wallet.ride,
    costume: wallet.costume,
  };
}

/** Aceita qualquer valor (vindo do banco ou de um arquivo antigo) e devolve uma carteira válida. */
export function sanitizeWallet(raw: unknown): Wallet {
  if (!raw || typeof raw !== "object") return { coins: 0, rentals: [], owned: [], ride: null, costume: null };
  const w = raw as Partial<Wallet>;
  const coins = Number.isFinite(w.coins) ? Math.max(0, Math.floor(w.coins!)) : 0;
  const rentals = Array.isArray(w.rentals)
    ? w.rentals.flatMap((r): Rental[] => {
        if (!r || !isShopItemId(r.item) || !Number.isFinite(r.expiresAt)) return [];
        const rental: Rental = { item: r.item, expiresAt: r.expiresAt };
        if (r.item === "pet") rental.pet = isPetKind(r.pet) ? r.pet : "pikachu";
        return [rental];
      })
    : [];
  // Carteiras antigas não têm `owned`. Um item só pode ser comprado uma vez.
  const owned: OwnedItem[] = [];
  for (const o of Array.isArray(w.owned) ? w.owned : []) {
    if (!o || !isShopItemId(o.item) || owned.some((x) => x.item === o.item)) continue;
    owned.push(o.item === "pet" ? { item: "pet", pet: isPetKind(o.pet) ? o.pet : "pikachu" } : { item: o.item });
  }
  return {
    coins,
    rentals,
    owned,
    ride: isRideKind(w.ride) ? w.ride : null,
    costume: isCostumeId(w.costume) ? w.costume : null,
  };
}

export class WalletStore {
  private readonly store: Store;
  private readonly wallets = new Map<string, StoredWallet>();
  private readonly loading = new Map<string, Promise<StoredWallet>>();
  /** Quantas conexões estão usando (ou carregando) cada carteira. */
  private readonly refs = new Map<string, number>();
  private readonly dirty = new Set<string>();
  private readonly timer: NodeJS.Timeout;
  private flushing: Promise<void> | null = null;

  constructor(store: Store) {
    this.store = store;
    this.timer = setInterval(() => void this.flush(), SAVE_INTERVAL_MS);
    this.timer.unref();
  }

  /**
   * Carrega a carteira (do cache ou do banco) e a mantém em memória até `release`.
   * Rejeita se o banco falhar — nesse caso não se deve criar uma carteira vazia,
   * senão ela sobrescreveria a salva.
   */
  async acquire(key: string): Promise<StoredWallet> {
    this.refs.set(key, (this.refs.get(key) ?? 0) + 1);
    try {
      return this.wallets.get(key) ?? (await this.load(key));
    } catch (err) {
      this.release(key);
      throw err;
    }
  }

  /** A conexão não usa mais a carteira; sem ninguém usando, ela sai do cache depois de salva. */
  release(key: string) {
    const count = (this.refs.get(key) ?? 0) - 1;
    if (count > 0) this.refs.set(key, count);
    else this.refs.delete(key);
  }

  markDirty(wallet: StoredWallet) {
    this.dirty.add(wallet.key);
  }

  /** Grava as carteiras alteradas e tira do cache as que ninguém está usando. */
  flush(): Promise<void> {
    this.flushing ??= this.doFlush().finally(() => (this.flushing = null));
    return this.flushing;
  }

  async close() {
    clearInterval(this.timer);
    await this.flushing;
    await this.flush();
  }

  private load(key: string): Promise<StoredWallet> {
    let promise = this.loading.get(key);
    if (!promise) {
      promise = this.store
        .loadWallet(key)
        .then((saved) => {
          // Pode já ter sido criada por outra conexão enquanto carregava.
          const existing = this.wallets.get(key);
          if (existing) return existing;
          const wallet: StoredWallet = { ...sanitizeWallet(saved), key, lastAwardAt: 0 };
          this.wallets.set(key, wallet);
          return wallet;
        })
        .finally(() => this.loading.delete(key));
      this.loading.set(key, promise);
    }
    return promise;
  }

  private async doFlush() {
    const keys = [...this.dirty];
    this.dirty.clear();
    const entries = keys.flatMap((key) => {
      const wallet = this.wallets.get(key);
      return wallet ? [[key, publicWallet(wallet)] as const] : [];
    });
    try {
      await this.store.saveWallets(entries);
    } catch (err) {
      for (const key of keys) this.dirty.add(key);
      console.warn(`[wallets] falha ao salvar ${keys.length} carteira(s); tento de novo em breve:`, err);
      return;
    }
    for (const key of this.wallets.keys()) {
      if (!this.refs.has(key) && !this.dirty.has(key)) this.wallets.delete(key);
    }
  }
}
