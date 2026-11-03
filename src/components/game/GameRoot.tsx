"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LIMITS } from "@/shared/protocol";
import { resolveServerUrl, Session } from "@/session/Session";
import { useSessionState } from "@/session/useSession";
import { TablePanel } from "@/components/table/TablePanel";
import { GameCanvas } from "./GameCanvas";

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
      <label htmlFor="player-name" className="text-sm text-neutral-300">
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
        className="rounded bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
      >
        Entrar no escritório
      </button>
    </form>
  );
}

function Office({ name }: { name: string }) {
  // Construir a sessão não conecta; a conexão abre/fecha no efeito (seguro em Strict Mode).
  const [session] = useState(() => new Session(name, resolveServerUrl()));
  const state = useSessionState(session);

  useEffect(() => {
    session.start();
    return () => session.stop();
  }, [session]);

  return (
    <div className="relative h-full w-full">
      <GameCanvas session={session} />
      {state.status !== "open" && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded bg-amber-600/90 px-3 py-1 text-xs text-white">
          {state.status === "connecting" ? "Conectando ao servidor…" : "Sem conexão com o servidor. Tentando novamente…"}
        </div>
      )}
      <TablePanel session={session} state={state} />
    </div>
  );
}
