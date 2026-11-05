"use client";

import { useState } from "react";
import { LerocoinIcon, ShopIcon } from "@/components/icons";

/** Saldo de Lerocoins no canto do jogo; abre a loja. Mostra "+1" quando ganha moedas. */
export function CoinCounter({ coins, onOpenShop }: { coins: number; onOpenShop: () => void }) {
  // Ajuste de estado durante o render (padrão do React para reagir a mudança de prop).
  const [prev, setPrev] = useState(coins);
  const [gain, setGain] = useState<{ amount: number; id: number } | null>(null);
  if (coins !== prev) {
    setPrev(coins);
    if (coins > prev) setGain({ amount: coins - prev, id: (gain?.id ?? 0) + 1 });
  }

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onOpenShop}
      title="Lerocoins: você ganha 1 a cada 10 segundos online. Clique para abrir a loja."
      className="relative flex items-center gap-2 rounded-full border border-amber-400/30 bg-neutral-900/95 py-1 pl-1.5 pr-1 text-sm text-neutral-100 shadow-lg hover:border-amber-400/60"
    >
      <LerocoinIcon size={20} />
      <span className="min-w-[2ch] font-display font-semibold tabular-nums text-amber-300">{coins}</span>
      <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-200">
        <ShopIcon size={13} /> Loja
      </span>
      {gain && (
        <span
          key={gain.id}
          aria-hidden
          className="animate-coin-gain pointer-events-none absolute left-6 top-0 font-display text-xs font-bold text-amber-300"
        >
          +{gain.amount}
        </span>
      )}
    </button>
  );
}
