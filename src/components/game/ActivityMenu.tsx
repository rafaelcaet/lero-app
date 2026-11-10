"use client";

import { useState } from "react";
import { ChevronIcon, SparklesIcon } from "@/components/icons";
import { ACTIVITIES, type Activity } from "@/shared/activities";
import { HudButton } from "./HudButton";

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
          className="flex min-w-44 flex-col gap-1 rounded-xl border border-grape-700 bg-grape-900/95 p-1.5 shadow-xl"
        >
          {ACTIVITIES.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitemradio"
              aria-checked={a.id === current}
              onMouseDown={keepFocus}
              onClick={() => pick(a.id === current ? null : a.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-grape-700 ${
                a.id === current ? "bg-aqua-600/30 text-aqua-200" : "text-grape-100"
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
        <HudButton
          onClick={() => pick(null)}
          title={`Parar: ${active.label}`}
          active
          icon={
            <span aria-hidden className="text-base leading-none">
              {active.emoji}
            </span>
          }
          label={active.label}
          trailing={
            <span className="-mr-2 ml-1 rounded-full bg-grape-800 px-3 py-1 font-sans text-xs font-medium text-grape-200 group-hover:bg-grape-700">
              Parar
            </span>
          }
        />
      ) : (
        <HudButton
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
          title="Ações: almoçar, fumar, dormir…"
          active={open}
          icon={<SparklesIcon size={18} />}
          label="Ações"
          trailing={
            <ChevronIcon
              direction="up"
              size={14}
              className={`-mr-1 text-grape-500 transition-transform ${open ? "rotate-180" : ""}`}
            />
          }
        />
      )}
    </div>
  );
}
