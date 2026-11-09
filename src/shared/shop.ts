/**
 * Lerocoins e loja: catálogo e regras compartilhadas entre cliente e servidor.
 * Só tipos e constantes puras (importável pelo Node e pelo Next).
 */
import { COSTUME_IDS, isCostumeId, type CostumeId } from "./costumes.ts";

export { COSTUME_IDS, isCostumeId, type CostumeId };

/** A cada quanto tempo online o jogador ganha moedas. */
export const COIN_INTERVAL_MS = 10_000;
/** Moedas ganhas a cada intervalo. */
export const COINS_PER_INTERVAL = 1;
/** Duração de um aluguel. Alugar de novo um item ativo soma mais esse tempo. */
export const RENTAL_DURATION_MS = 60 * 60 * 1000;
/** Tempo máximo acumulado de um aluguel (evita gastar tudo sem querer). */
export const RENTAL_MAX_MS = 24 * RENTAL_DURATION_MS;

export type ShopItemId = "bike" | "car" | "pet" | CostumeId;
export type ShopCategory = "ride" | "pet" | "costume";
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
  category: ShopCategory;
  name: string;
  description: string;
  /** Preço de 1 hora de aluguel. */
  price: number;
  /** Preço para comprar e ficar com o item para sempre (bem mais caro que alugar). */
  buyPrice: number;
  /** Descrição na aba de compra, quando difere da do aluguel. */
  buyDescription?: string;
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  {
    id: "bike",
    category: "ride",
    name: "Bicicleta",
    description: "Anda 60% mais rápido pelo escritório.",
    price: 60,
    buyPrice: 6_000,
  },
  {
    id: "car",
    category: "ride",
    name: "Carro",
    description: "Um conversível que anda o dobro da velocidade.",
    price: 150,
    buyPrice: 15_000,
  },
  {
    id: "pet",
    category: "pet",
    name: "Mascote",
    description: "Um Pikachu, Squirtle, Charmander ou Bulbasaur (sorteado) que segue você.",
    price: 100,
    buyPrice: 10_000,
    buyDescription: "Escolha um Pikachu, Squirtle, Charmander ou Bulbasaur para seguir você.",
  },
  // Fantasias: substituem a roupa do personagem (uma de cada vez). Compra = 100× a hora.
  costume("flash", "Flash", "Uniforme vermelho com raio no peito e asinhas na máscara.", 80),
  costume("batman", "Batman", "Capuz com orelhas, capa preta e cinto de utilidades.", 120),
  costume("majinboo", "Majin Boo", "Pele rosa, antena na cabeça, colete preto e calça bufante.", 100),
  costume("shrek", "Shrek", "Pele verde, orelhas de corneta e colete de couro.", 100),
  costume("gandalf", "Gandalf", "Manto cinza, barba longa, chapéu pontudo e cajado.", 120),
  costume("bomberman", "Bomberman", "Capacete branco com pompom rosa e macacão azul.", 80),
  costume("spongebob", "Bob Esponja", "Cabeça quadrada amarela, camisa, gravata e calça marrom.", 100),
  costume("neymar", "Boneco do Neymar", "Camisa 10 da seleção e o cabelo descolorido.", 150),
  costume("ronaldinho", "Boneco do Ronaldinho", "Camisa 10 da seleção, cabelão com faixa e o sorriso.", 150),
];

function costume(id: CostumeId, name: string, description: string, price: number): ShopItem {
  return { id, category: "costume", name, description, price, buyPrice: price * 100 };
}

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

/** Item comprado: é do jogador para sempre. */
export interface OwnedItem {
  item: ShopItemId;
  /** Só para o mascote: qual foi escolhido na compra. */
  pet?: PetKind;
}

/** Carteira do próprio jogador (só ele recebe). */
export interface Wallet {
  coins: number;
  rentals: Rental[];
  /** Itens comprados (no máximo um de cada). */
  owned: OwnedItem[];
  /** Veículo em uso (precisa estar alugado ou comprado). null = a pé. */
  ride: RideKind | null;
  /** Fantasia vestida (precisa estar alugada ou comprada). null = roupa normal. */
  costume: CostumeId | null;
}

export const isRideKind = (v: unknown): v is RideKind => v === "bike" || v === "car";
export const isPetKind = (v: unknown): v is PetKind => PET_KINDS.includes(v as PetKind);
export const isShopItemId = (v: unknown): v is ShopItemId => SHOP_ITEM_BY_ID.has(v as ShopItemId);

/** O jogador comprou este item? */
export const ownsItem = (wallet: Wallet, item: ShopItemId): boolean => wallet.owned.some((o) => o.item === item);

/** Aluguel ativo deste item agora, se houver. */
export const activeRental = (wallet: Wallet, item: ShopItemId, now: number): Rental | undefined =>
  wallet.rentals.find((r) => r.item === item && r.expiresAt > now);

/** Pode usar o item agora: comprado ou com aluguel ativo. */
export const hasItem = (wallet: Wallet, item: ShopItemId, now: number): boolean =>
  ownsItem(wallet, item) || activeRental(wallet, item, now) !== undefined;
