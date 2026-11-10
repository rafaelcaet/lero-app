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
      // Mesmo formato dos botões do HUD (Falar, Ações), com o dourado da moeda no lugar do verde.
      className="group relative flex h-10 select-none items-center gap-2 rounded-full border border-amber-400/30 bg-grape-900/95 pl-1.5 pr-1.5 text-grape-100 shadow-lg outline-none transition-[color,background-color,border-color,transform] hover:border-amber-400/60 hover:bg-grape-800/95 focus-visible:ring-2 focus-visible:ring-amber-400/60 active:scale-95"
    >
      <LerocoinIcon size={24} />
      <span className="min-w-[2ch] font-display text-base font-semibold tabular-nums text-amber-300">{coins.toLocaleString("pt-BR")}</span>
      <span className="flex h-7 items-center gap-1.5 rounded-full bg-amber-500/15 pl-2.5 pr-3 font-display text-sm font-semibold text-amber-200 transition-colors group-hover:bg-amber-500/25">
        <ShopIcon size={15} className="text-amber-300" /> Loja
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
