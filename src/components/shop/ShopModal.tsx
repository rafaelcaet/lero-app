"use client";

import { useEffect, useState } from "react";
import type { Session, SessionState } from "@/session/Session";
import type { Appearance } from "@/shared/appearance";
import {
  activeRental,
  COIN_INTERVAL_MS,
  COINS_PER_INTERVAL,
  isCostumeId,
  isRideKind,
  PET_KINDS,
  PET_NAMES,
  SHOP_ITEMS,
  type OwnedItem,
  type PetKind,
  type Rental,
  type ShopItem,
  type Wallet,
} from "@/shared/shop";
import { CloseIcon, LerocoinIcon, ShopIcon } from "@/components/icons";
import { Backdrop, useEscape } from "@/components/players/PlayerModal";
import { costumeImageUrl } from "./costumeImage";
import { gearImageUrl } from "./gearImage";

/** Relógio que avança a cada segundo (para os contadores de aluguel). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

/** Quanto tempo online falta para juntar `missing` moedas. */
function formatWait(missing: number): string {
  const minutes = Math.ceil((missing / COINS_PER_INTERVAL) * (COIN_INTERVAL_MS / 60_000));
  return minutes >= 60 ? `≈ ${Math.floor(minutes / 60)} h ${minutes % 60} min` : `≈ ${minutes} min`;
}

const REJECTION_TEXT = {
  "no-coins": "Lerocoins insuficientes.",
  "max-time": "Limite de 24 h de aluguel atingido.",
  owned: "Você já comprou este item.",
} as const;

const coinFormat = new Intl.NumberFormat("pt-BR");

type Tab = "rent" | "buy";

const TABS: ReadonlyArray<{ id: Tab; label: string; subtitle: string }> = [
  { id: "rent", label: "Alugar", subtitle: "Aluguéis de 1 hora · +1 Lerocoin a cada 10 s online" },
  { id: "buy", label: "Comprar", subtitle: "Compra definitiva: o item é seu para sempre" },
];

interface ShopModalProps {
  session: Session;
  state: SessionState;
  onClose: () => void;
}

const SECTIONS: ReadonlyArray<{ title: string; items: readonly ShopItem[] }> = [
  { title: "Veículos e mascote", items: SHOP_ITEMS.filter((i) => i.category !== "costume") },
  { title: "Fantasias", items: SHOP_ITEMS.filter((i) => i.category === "costume") },
];

/** Usar/vestir um item: veículo (subir/descer) ou fantasia (vestir/tirar). O mascote não tem. */
interface WearControl {
  inUse: boolean;
  onLabel: string;
  offLabel: string;
  toggle: (on: boolean) => void;
}

/** Loja de Lerocoins: aluga por 1 hora ou compra para sempre veículos, mascote e fantasias. */
export function ShopModal({ session, state, onClose }: ShopModalProps) {
  useEscape(onClose);
  const [tab, setTab] = useState<Tab>("rent");
  const localNow = useNow();
  const now = localNow + state.serverClockOffset;
  const wallet = state.wallet;
  const rejection = state.rentRejection && localNow - state.rentRejection.at < 5000 ? state.rentRejection : null;
  const buyRejection = state.buyRejection && localNow - state.buyRejection.at < 5000 ? state.buyRejection : null;
  const selfId = state.selfId;
  const appearance = (selfId ? state.players[selfId]?.appearance : undefined) ?? session.appearance;
  const wearControl = (item: ShopItem, w: Wallet): WearControl | null => {
    if (isRideKind(item.id)) {
      const ride = item.id;
      return { inUse: w.ride === ride, onLabel: "Usar", offLabel: "Descer", toggle: (on) => session.equipRide(on ? ride : null) };
    }
    if (isCostumeId(item.id)) {
      const costume = item.id;
      return { inUse: w.costume === costume, onLabel: "Vestir", offLabel: "Tirar", toggle: (on) => session.wearCostume(on ? costume : null) };
    }
    return null;
  };

  return (
    <Backdrop onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-title"
        className="relative flex max-h-full w-full max-w-md flex-col rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-200 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded-full p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
        >
          <CloseIcon size={18} />
        </button>

        <header className="flex items-center gap-3 border-b border-neutral-800 px-5 pb-4 pt-5 pr-12">
          <span className="rounded-xl bg-amber-500/15 p-2 text-amber-300">
            <ShopIcon size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="shop-title" className="font-display text-xl font-semibold text-neutral-50">
              Loja
            </h2>
            <p className="text-xs text-neutral-400">{TABS.find((t) => t.id === tab)!.subtitle}</p>
          </div>
          {wallet && (
            <div className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1">
              <LerocoinIcon size={18} />
              <span className="font-display font-semibold tabular-nums text-amber-300">
                {coinFormat.format(wallet.coins)}
              </span>
            </div>
          )}
        </header>

        <div role="tablist" aria-label="Tipo de compra" className="mx-4 mt-4 grid grid-cols-2 gap-1 rounded-xl bg-neutral-950/60 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`shop-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="shop-panel"
              onClick={() => setTab(t.id)}
              className={`rounded-lg py-1.5 font-display text-sm font-semibold transition-colors ${
                tab === t.id ? "bg-neutral-800 text-amber-200 shadow" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!wallet ? (
          <p className="p-5 text-sm text-neutral-400">
            {state.status === "open"
              ? "Este servidor ainda não tem Lerocoins. Atualize o servidor do jogo para usar a loja."
              : "Conectando ao servidor…"}
          </p>
        ) : (
          <div id="shop-panel" role="tabpanel" aria-labelledby={`shop-tab-${tab}`} className="flex flex-col gap-5 overflow-y-auto p-4">
            {SECTIONS.map((section) => (
              <section key={section.title} aria-label={section.title}>
                <h3 className="mb-2 px-1 font-display text-sm font-semibold text-neutral-400">{section.title}</h3>
                <ul className="flex flex-col gap-3">
                  {section.items.map((item) =>
                    tab === "rent" ? (
                      <ShopRow
                        key={item.id}
                        item={item}
                        wallet={wallet}
                        now={now}
                        appearance={appearance}
                        wear={wearControl(item, wallet)}
                        rejection={rejection?.item === item.id ? REJECTION_TEXT[rejection.reason] : null}
                        onRent={() => session.rent(item.id)}
                      />
                    ) : (
                      <BuyRow
                        key={item.id}
                        item={item}
                        wallet={wallet}
                        now={now}
                        appearance={appearance}
                        wear={wearControl(item, wallet)}
                        rejection={buyRejection?.item === item.id ? REJECTION_TEXT[buyRejection.reason] : null}
                        onBuy={(pet) => session.buy(item.id, pet)}
                      />
                    ),
                  )}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </Backdrop>
  );
}

function ShopRow(props: {
  item: ShopItem;
  wallet: Wallet;
  now: number;
  appearance: Appearance;
  wear: WearControl | null;
  rejection: string | null;
  onRent: () => void;
}) {
  const { item, wallet, now } = props;
  const rental: Rental | undefined = activeRental(wallet, item.id, now);
  const owned = wallet.owned.find((o) => o.item === item.id);
  const missing = Math.max(0, item.price - wallet.coins);
  const { wear } = props;

  return (
    <li
      className={`flex gap-3 rounded-xl border p-3 ${
        rental ? "border-emerald-500/30 bg-emerald-500/5" : "border-neutral-800 bg-neutral-800/40"
      }`}
    >
      <ItemImage item={item} pet={owned?.pet ?? rental?.pet} appearance={props.appearance} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-neutral-50">
              {item.name}
              {rental?.pet && <span className="text-emerald-300"> · {PET_NAMES[rental.pet]}</span>}
            </h3>
            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-amber-300">
              <LerocoinIcon size={14} /> {item.price}
            </span>
          </div>
          <p className="text-xs text-neutral-400">{item.description}</p>
        </div>

        {rental && (
          <p className="text-xs text-emerald-300">
            Alugado · <span className="tabular-nums">{formatRemaining(rental.expiresAt - now)}</span> restantes
          </p>
        )}

        {owned ? (
          <div className="flex flex-wrap items-center gap-2">
            {wear && <WearToggle {...wear} />}
            <span className="text-xs text-emerald-300">Você já comprou: não precisa alugar.</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {wear && rental && <WearToggle {...wear} />}
            <button
              type="button"
              disabled={missing > 0}
              onClick={props.onRent}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                rental
                  ? "border border-neutral-700 text-neutral-200 hover:border-amber-400/50"
                  : "bg-amber-500 text-neutral-950 hover:bg-amber-400"
              }`}
            >
              {rental ? "+1 hora" : "Alugar por 1 hora"}
            </button>
            {missing > 0 && <MissingCoins missing={missing} />}
          </div>
        )}
        {props.rejection && <p className="text-xs text-red-400">{props.rejection}</p>}
      </div>
    </li>
  );
}

function BuyRow(props: {
  item: ShopItem;
  wallet: Wallet;
  now: number;
  appearance: Appearance;
  wear: WearControl | null;
  rejection: string | null;
  onBuy: (pet?: PetKind) => void;
}) {
  const { item, wallet, now } = props;
  const owned: OwnedItem | undefined = wallet.owned.find((o) => o.item === item.id);
  const rental = activeRental(wallet, item.id, now);
  const [pet, setPet] = useState<PetKind>(PET_KINDS[0]);
  // A compra é cara: pede um segundo clique para confirmar.
  const [confirming, setConfirming] = useState(false);
  const missing = Math.max(0, item.buyPrice - wallet.coins);
  const { wear } = props;
  const isPet = item.id === "pet";
  const shownPet = owned?.pet ?? (isPet ? pet : undefined);

  return (
    <li
      className={`flex gap-3 rounded-xl border p-3 ${
        owned ? "border-emerald-500/30 bg-emerald-500/5" : "border-neutral-800 bg-neutral-800/40"
      }`}
    >
      <ItemImage item={item} pet={shownPet} appearance={props.appearance} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-neutral-50">
              {item.name}
              {shownPet && <span className="text-emerald-300"> · {PET_NAMES[shownPet]}</span>}
            </h3>
            {!owned && (
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-amber-300">
                <LerocoinIcon size={14} /> {coinFormat.format(item.buyPrice)}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400">{item.buyDescription ?? item.description}</p>
          {!owned && (
            <p className="mt-0.5 text-[11px] text-neutral-500">
              Equivale a {Math.round(item.buyPrice / item.price)} h de aluguel
            </p>
          )}
        </div>

        {owned ? (
          <div className="flex flex-wrap items-center gap-2">
            {wear && <WearToggle {...wear} />}
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-display text-xs font-semibold text-emerald-300">
              Seu para sempre
            </span>
          </div>
        ) : (
          <>
            {isPet && (
              <div role="radiogroup" aria-label="Escolha o mascote" className="flex gap-1.5">
                {PET_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={pet === kind}
                    title={PET_NAMES[kind]}
                    aria-label={PET_NAMES[kind]}
                    onClick={() => {
                      setPet(kind);
                      setConfirming(false);
                    }}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                      pet === kind
                        ? "border-amber-400/70 bg-amber-500/15"
                        : "border-neutral-700 bg-neutral-950/60 hover:border-neutral-500"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no navegador */}
                    <img src={gearImageUrl(kind)} alt="" className="w-7" style={{ imageRendering: "pixelated" }} />
                  </button>
                ))}
              </div>
            )}

            {confirming ? (
              <div className="flex flex-col gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-2">
                <p className="text-xs text-amber-100">
                  Comprar {isPet ? PET_NAMES[pet] : item.category === "costume" ? `a fantasia ${item.name}` : item.name.toLowerCase()} por{" "}
                  <strong className="tabular-nums">{coinFormat.format(item.buyPrice)}</strong> Lerocoins?
                  {rental && " Seu aluguel ativo deste item acaba agora, sem devolução do tempo restante."}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    autoFocus
                    disabled={missing > 0}
                    onClick={() => {
                      props.onBuy(isPet ? pet : undefined);
                      setConfirming(false);
                    }}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Confirmar compra
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:border-neutral-500"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={missing > 0}
                  onClick={() => setConfirming(true)}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Comprar
                </button>
                {missing > 0 && <MissingCoins missing={missing} />}
              </div>
            )}
          </>
        )}
        {props.rejection && <p className="text-xs text-red-400">{props.rejection}</p>}
      </div>
    </li>
  );
}

function WearToggle({ inUse, onLabel, offLabel, toggle }: WearControl) {
  return (
    <button
      type="button"
      onClick={() => toggle(!inUse)}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
        inUse ? "bg-neutral-700 text-neutral-100 hover:bg-neutral-600" : "bg-emerald-600 text-white hover:bg-emerald-500"
      }`}
    >
      {inUse ? offLabel : onLabel}
    </button>
  );
}

function MissingCoins({ missing }: { missing: number }) {
  return (
    <span className="text-xs text-neutral-500">
      Faltam {coinFormat.format(missing)} ({formatWait(missing)})
    </span>
  );
}

/** Mascote já definido (alugado, comprado ou escolhido para comprar) aparece sozinho. */
function ItemImage({ item, pet, appearance }: { item: ShopItem; pet: PetKind | undefined; appearance: Appearance }) {
  const box = "flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-neutral-950/60";
  const pixel = { imageRendering: "pixelated" } as const;

  if (isCostumeId(item.id)) {
    // A fantasia aparece no seu próprio personagem.
    // eslint-disable-next-line @next/next/no-img-element -- data URL gerada no navegador
    return <div className={box}><img src={costumeImageUrl(appearance, item.id)} alt="" className="w-14" style={pixel} /></div>;
  }
  if (isRideKind(item.id)) {
    // eslint-disable-next-line @next/next/no-img-element -- data URL gerada no navegador
    return <div className={box}><img src={gearImageUrl(item.id, "right")} alt="" className="w-14" style={pixel} /></div>;
  }
  if (pet) {
    // eslint-disable-next-line @next/next/no-img-element -- idem
    return <div className={box}><img src={gearImageUrl(pet)} alt="" className="w-12" style={pixel} /></div>;
  }
  // Ainda não alugado: mostra os quatro possíveis, com "?" (é sorteado).
  return (
    <div className={`${box} relative grid grid-cols-2 place-items-center p-1`}>
      {PET_KINDS.map((pet) => (
        // eslint-disable-next-line @next/next/no-img-element -- idem
        <img key={pet} src={gearImageUrl(pet)} alt="" className="w-7 opacity-60" style={pixel} />
      ))}
      <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold text-amber-300 drop-shadow">
        ?
      </span>
    </div>
  );
}
