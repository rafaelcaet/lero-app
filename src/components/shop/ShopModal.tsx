"use client";

import { useEffect, useState } from "react";
import type { Session, SessionState } from "@/session/Session";
import {
  COIN_INTERVAL_MS,
  COINS_PER_INTERVAL,
  isRideKind,
  PET_KINDS,
  PET_NAMES,
  SHOP_ITEMS,
  type Rental,
  type ShopItem,
  type Wallet,
} from "@/shared/shop";
import { CloseIcon, LerocoinIcon, ShopIcon } from "@/components/icons";
import { Backdrop, useEscape } from "@/components/players/PlayerModal";
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
} as const;

interface ShopModalProps {
  session: Session;
  state: SessionState;
  onClose: () => void;
}

/** Loja de Lerocoins: aluga bicicleta, carro ou mascote por 1 hora. */
export function ShopModal({ session, state, onClose }: ShopModalProps) {
  useEscape(onClose);
  const localNow = useNow();
  const now = localNow + state.serverClockOffset;
  const wallet = state.wallet;
  const rejection = state.rentRejection && localNow - state.rentRejection.at < 5000 ? state.rentRejection : null;

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
            <p className="text-xs text-neutral-400">Aluguéis de 1 hora · +1 Lerocoin a cada 10 s online</p>
          </div>
          {wallet && (
            <div className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1">
              <LerocoinIcon size={18} />
              <span className="font-display font-semibold tabular-nums text-amber-300">{wallet.coins}</span>
            </div>
          )}
        </header>

        {!wallet ? (
          <p className="p-5 text-sm text-neutral-400">
            {state.status === "open"
              ? "Este servidor ainda não tem Lerocoins. Atualize o servidor do jogo para usar a loja."
              : "Conectando ao servidor…"}
          </p>
        ) : (
          <ul className="flex flex-col gap-3 overflow-y-auto p-4">
            {SHOP_ITEMS.map((item) => (
              <ShopRow
                key={item.id}
                item={item}
                wallet={wallet}
                now={now}
                rejection={rejection?.item === item.id ? REJECTION_TEXT[rejection.reason] : null}
                onRent={() => session.rent(item.id)}
                onToggleRide={(on) => session.equipRide(on && isRideKind(item.id) ? item.id : null)}
              />
            ))}
          </ul>
        )}
      </div>
    </Backdrop>
  );
}

function ShopRow(props: {
  item: ShopItem;
  wallet: Wallet;
  now: number;
  rejection: string | null;
  onRent: () => void;
  onToggleRide: (on: boolean) => void;
}) {
  const { item, wallet, now } = props;
  const rental: Rental | undefined = wallet.rentals.find((r) => r.item === item.id && r.expiresAt > now);
  const missing = Math.max(0, item.price - wallet.coins);
  const ride = isRideKind(item.id) ? item.id : null;
  const inUse = ride !== null && wallet.ride === ride;

  return (
    <li
      className={`flex gap-3 rounded-xl border p-3 ${
        rental ? "border-emerald-500/30 bg-emerald-500/5" : "border-neutral-800 bg-neutral-800/40"
      }`}
    >
      <ItemImage item={item} rental={rental} />

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

        <div className="flex flex-wrap items-center gap-2">
          {ride && rental && (
            <button
              type="button"
              onClick={() => props.onToggleRide(!inUse)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                inUse
                  ? "bg-neutral-700 text-neutral-100 hover:bg-neutral-600"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              }`}
            >
              {inUse ? "Descer" : "Usar"}
            </button>
          )}
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
          {missing > 0 && (
            <span className="text-xs text-neutral-500">
              Faltam {missing} ({formatWait(missing)})
            </span>
          )}
        </div>
        {props.rejection && <p className="text-xs text-red-400">{props.rejection}</p>}
      </div>
    </li>
  );
}

function ItemImage({ item, rental }: { item: ShopItem; rental: Rental | undefined }) {
  const box = "flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-neutral-950/60";
  const pixel = { imageRendering: "pixelated" } as const;

  if (item.id !== "pet") {
    // eslint-disable-next-line @next/next/no-img-element -- data URL gerada no navegador
    return <div className={box}><img src={gearImageUrl(item.id, "right")} alt="" className="w-14" style={pixel} /></div>;
  }
  if (rental?.pet) {
    // eslint-disable-next-line @next/next/no-img-element -- idem
    return <div className={box}><img src={gearImageUrl(rental.pet)} alt="" className="w-12" style={pixel} /></div>;
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
