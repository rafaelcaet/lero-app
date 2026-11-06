"use client";

import { useState } from "react";
import { ACTIVITIES, type Activity } from "@/shared/activities";

/**
 * Botão com as atividades do personagem (almoçar, fumar, dormir). Com uma
 * atividade em andamento, mostra o botão de parar. Andar também interrompe.
 */
export function ActivityMenu({
  current,
  onChange,
  className = "",
}: {
  current: Activity | null;
  onChange: (activity: Activity | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const active = ACTIVITIES.find((a) => a.id === current);

  const pick = (activity: Activity | null) => {
    onChange(activity);
    setOpen(false);
  };
  // Não rouba o foco do jogo/chat ao clicar.
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className={`flex flex-col items-end gap-2 ${className}`}>
      {open && (
        <div
          role="menu"
          className="flex min-w-44 flex-col gap-1 rounded-xl border border-neutral-700 bg-neutral-900/95 p-1.5 shadow-xl"
        >
          {ACTIVITIES.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitemradio"
              aria-checked={a.id === current}
              onMouseDown={keepFocus}
              onClick={() => pick(a.id === current ? null : a.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-neutral-700 ${
                a.id === current ? "bg-emerald-600/30 text-emerald-200" : "text-neutral-100"
              }`}
            >
              <span aria-hidden className="text-lg leading-none">
                {a.emoji}
              </span>
              {a.label}
            </button>
          ))}
        </div>
      )}
      {active && !open ? (
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={() => pick(null)}
          className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-neutral-900/95 py-1.5 pl-3 pr-1.5 text-xs text-neutral-200 shadow-lg"
        >
          <span aria-hidden>{active.emoji}</span>
          <strong className="font-semibold text-emerald-300">{active.label}</strong>
          <span className="rounded-full bg-neutral-700 px-2.5 py-0.5 font-medium hover:bg-neutral-600">Parar</span>
        </button>
      ) : (
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
          title="Ações: almoçar, fumar, dormir…"
          className="flex h-11 items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/95 px-4 text-sm font-medium text-neutral-100 shadow-lg hover:border-neutral-500"
        >
          <span aria-hidden>⏺️</span> Ações
        </button>
      )}
    </div>
  );
}
