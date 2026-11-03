"use client";

import { useState, useSyncExternalStore } from "react";
import { LIMITS } from "@/shared/protocol";
import { Office } from "./Office";

const NAME_STORAGE_KEY = "gather-clone:name";

function readStoredName(): string {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

const noopSubscribe = () => () => {};

/**
 * Nome salvo no navegador. No servidor (e durante a hidratação) vale "",
 * para o HTML inicial ser igual nos dois lados; depois o React troca pelo valor real.
 */
function useStoredName(): string {
  return useSyncExternalStore(noopSubscribe, readStoredName, () => "");
}

/** Pede o nome antes de entrar no escritório. */
export function GameRoot() {
  const [name, setName] = useState<string | null>(null);
  if (!name) return <NameForm onSubmit={setName} />;
  return <Office name={name} />;
}

function NameForm({ onSubmit }: { onSubmit: (name: string) => void }) {
  const storedName = useStoredName();
  // null = usuário ainda não digitou; mostra o nome salvo.
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? storedName;

  return (
    <form
      className="m-auto flex w-full max-w-xs flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim().slice(0, LIMITS.nameLength);
        if (!trimmed) return;
        try {
          localStorage.setItem(NAME_STORAGE_KEY, trimmed);
        } catch {
          // armazenamento indisponível: segue sem lembrar o nome
        }
        onSubmit(trimmed);
      }}
    >
      <label htmlFor="player-name" className="font-display text-lg font-semibold text-neutral-100">
        Como você quer ser chamado?
      </label>
      <input
        id="player-name"
        autoFocus
        maxLength={LIMITS.nameLength}
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Seu nome"
        className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-emerald-500"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="rounded bg-emerald-600 px-3 py-2 font-display text-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
      >
        Entrar no escritório
      </button>
    </form>
  );
}
