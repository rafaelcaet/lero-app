"use client";

import { useState, useSyncExternalStore } from "react";
import {
  DEFAULT_APPEARANCE,
  sanitizeAppearance,
  type Appearance,
} from "@/shared/appearance";
import { CharacterCreator } from "@/components/character/CharacterCreator";
import { Office } from "./Office";

const APPEARANCE_STORAGE_KEY = "lero:appearance";

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // armazenamento indisponível: segue sem lembrar
  }
}

const noopSubscribe = () => () => {};

/**
 * Valor salvo no navegador. No servidor (e durante a hidratação) vale "",
 * para o HTML inicial ser igual nos dois lados; depois o React troca pelo valor real.
 */
function useStored(key: string): string {
  return useSyncExternalStore(noopSubscribe, () => readStorage(key), () => "");
}

function parseAppearance(raw: string): Appearance {
  if (!raw) return DEFAULT_APPEARANCE;
  try {
    return sanitizeAppearance(JSON.parse(raw));
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Escolhe a aparência antes de entrar no escritório. O nome vem da conta (login). */
export function GameRoot({ name, ticket }: { name: string; ticket: string }) {
  const [appearance, setAppearance] = useState<Appearance | null>(null);
  if (!appearance) return <JoinForm name={name} onSubmit={setAppearance} />;
  return <Office name={name} appearance={appearance} ticket={ticket} />;
}

function JoinForm({ name, onSubmit }: { name: string; onSubmit: (appearance: Appearance) => void }) {
  const storedAppearance = useStored(APPEARANCE_STORAGE_KEY);
  // null = usuário ainda não mexeu; mostra o que estava salvo.
  const [draftAppearance, setDraftAppearance] = useState<Appearance | null>(null);
  const appearance = draftAppearance ?? parseAppearance(storedAppearance);

  return (
    <div className="flex h-full w-full overflow-y-auto p-4">
      <form
        className="m-auto flex w-full max-w-3xl flex-col gap-6 rounded-[22px] border border-white/10 bg-grape-800/60 p-5 shadow-xl sm:p-7"
        onSubmit={(e) => {
          e.preventDefault();
          writeStorage(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
          onSubmit(appearance);
        }}
      >
        <div>
          <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-white">
            Olá, <span className="text-pearl">{name}</span>!
          </h2>
          <p className="mt-1 text-sm text-grape-300">Monte seu personagem antes de entrar.</p>
        </div>

        <CharacterCreator value={appearance} onChange={setDraftAppearance} />

        <button
          type="submit"
          className="btn-block h-12 rounded-xl border-aqua-700 bg-aqua-400 font-display text-base font-semibold uppercase tracking-wider text-carbon outline-none focus-visible:ring-4 focus-visible:ring-aqua-400/40"
        >
          Entrar no escritório
        </button>
      </form>
    </div>
  );
}
