/**
 * Lerocoins e loja: catálogo e regras compartilhadas entre cliente e servidor.
 * Só tipos e constantes puras (importável pelo Node e pelo Next).
 */

/** A cada quanto tempo online o jogador ganha moedas. */
export const COIN_INTERVAL_MS = 10_000;
/** Moedas ganhas a cada intervalo. */
export const COINS_PER_INTERVAL = 1;
/** Duração de um aluguel. Alugar de novo um item ativo soma mais esse tempo. */
export const RENTAL_DURATION_MS = 60 * 60 * 1000;
/** Tempo máximo acumulado de um aluguel (evita gastar tudo sem querer). */
export const RENTAL_MAX_MS = 24 * RENTAL_DURATION_MS;

export type ShopItemId = "bike" | "car" | "pet";
export type RideKind = "bike" | "car";
export type PetKind = "pikachu" | "squirtle" | "charmander" | "bulbasaur";

export const PET_KINDS: readonly PetKind[] = ["pikachu", "squirtle", "charmander", "bulbasaur"];

export const PET_NAMES: Record<PetKind, string> = {
  pikachu: "Pikachu",
  squirtle: "Squirtle",
  charmander: "Charmander",
  bulbasaur: "Bulbasaur",
};

export interface ShopItem {
  id: ShopItemId;
  name: string;
  description: string;
  price: number;
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  {
    id: "bike",
    name: "Bicicleta",
    description: "Anda 60% mais rápido pelo escritório.",
    price: 60,
  },
  {
    id: "car",
    name: "Carro",
    description: "Um conversível que anda o dobro da velocidade.",
    price: 150,
  },
  {
    id: "pet",
    name: "Mascote",
    description: "Um Pikachu, Squirtle, Charmander ou Bulbasaur (sorteado) que segue você.",
    price: 100,
  },
];

export const SHOP_ITEM_BY_ID = new Map(SHOP_ITEMS.map((item) => [item.id, item]));

/** Multiplicador de velocidade de cada veículo. */
export const RIDE_SPEED: Record<RideKind, number> = { bike: 1.6, car: 2 };

export interface Rental {
  item: ShopItemId;
  /** Fim do aluguel (ms, relógio do servidor). */
  expiresAt: number;
  /** Só para o mascote: qual foi sorteado. */
  pet?: PetKind;
}

/** Carteira do próprio jogador (só ele recebe). */
export interface Wallet {
  coins: number;
  rentals: Rental[];
  /** Veículo em uso (precisa estar alugado). null = a pé. */
  ride: RideKind | null;
}

export const isRideKind = (v: unknown): v is RideKind => v === "bike" || v === "car";
export const isPetKind = (v: unknown): v is PetKind => PET_KINDS.includes(v as PetKind);
export const isShopItemId = (v: unknown): v is ShopItemId => SHOP_ITEM_BY_ID.has(v as ShopItemId);
