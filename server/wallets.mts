/**
 * Carteiras de Lerocoins e aluguéis, por chave de carteira (gerada e guardada
 * no navegador). Ficam em memória e são salvas num arquivo JSON de tempos em
 * tempos, para sobreviver a reinícios do servidor.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  isPetKind,
  isRideKind,
  isShopItemId,
  type PetKind,
  type RideKind,
  type Rental,
  type Wallet,
} from "../src/shared/shop.ts";

export interface StoredWallet extends Wallet {
  /** Quando ganhou moeda pela última vez (ms). Só vale enquanto está online. */
  lastAwardAt: number;
}

const KEY_PATTERN = /^[A-Za-z0-9-]{16,64}$/;
const SAVE_INTERVAL_MS = 30_000;

export const isWalletKey = (v: unknown): v is string => typeof v === "string" && KEY_PATTERN.test(v);

/** Veículo e mascote ativos agora (o que os outros jogadores veem). */
export function gearOf(wallet: Wallet, now: number): { ride: RideKind | null; pet: PetKind | null } {
  const active = (item: Rental["item"]) => wallet.rentals.find((r) => r.item === item && r.expiresAt > now);
  const ride = wallet.ride && active(wallet.ride) ? wallet.ride : null;
  return { ride, pet: active("pet")?.pet ?? null };
}

/** Versão enviada ao cliente (sem campos internos). */
export function publicWallet(wallet: StoredWallet): Wallet {
  return { coins: wallet.coins, rentals: wallet.rentals.map((r) => ({ ...r })), ride: wallet.ride };
}

function sanitize(raw: unknown): StoredWallet | null {
  if (!raw || typeof raw !== "object") return null;
  const w = raw as Partial<StoredWallet>;
  const coins = Number.isFinite(w.coins) ? Math.max(0, Math.floor(w.coins!)) : 0;
  const rentals = Array.isArray(w.rentals)
    ? w.rentals.flatMap((r): Rental[] => {
        if (!r || !isShopItemId(r.item) || !Number.isFinite(r.expiresAt)) return [];
        const rental: Rental = { item: r.item, expiresAt: r.expiresAt };
        if (r.item === "pet") rental.pet = isPetKind(r.pet) ? r.pet : "pikachu";
        return [rental];
      })
    : [];
  return { coins, rentals, ride: isRideKind(w.ride) ? w.ride : null, lastAwardAt: 0 };
}

export class WalletStore {
  private readonly wallets = new Map<string, StoredWallet>();
  private dirty = false;
  private readonly file: string;
  private readonly timer: NodeJS.Timeout | null = null;

  /** `file` vazio = só em memória. */
  constructor(file: string) {
    this.file = file;
    if (!file) return;
    try {
      const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
      for (const [key, raw] of Object.entries(data)) {
        const wallet = isWalletKey(key) ? sanitize(raw) : null;
        if (wallet) this.wallets.set(key, wallet);
      }
      console.log(`[wallets] ${this.wallets.size} carteira(s) carregada(s) de ${file}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(`[wallets] não foi possível ler ${file}:`, err);
      }
    }
    this.timer = setInterval(() => this.save(), SAVE_INTERVAL_MS);
    this.timer.unref();
  }

  get(key: string): StoredWallet {
    let wallet = this.wallets.get(key);
    if (!wallet) {
      wallet = { coins: 0, rentals: [], ride: null, lastAwardAt: 0 };
      this.wallets.set(key, wallet);
    }
    return wallet;
  }

  markDirty() {
    this.dirty = true;
  }

  save() {
    if (!this.file || !this.dirty) return;
    this.dirty = false;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const data = Object.fromEntries(
        [...this.wallets].map(([key, { coins, rentals, ride }]) => [key, { coins, rentals, ride }]),
      );
      // Escreve num temporário e renomeia: não corrompe o arquivo se o processo cair no meio.
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(data));
      renameSync(tmp, this.file);
    } catch (err) {
      this.dirty = true;
      console.warn(`[wallets] falha ao salvar ${this.file}:`, err);
    }
  }

  close() {
    if (this.timer) clearInterval(this.timer);
    this.save();
  }
}
