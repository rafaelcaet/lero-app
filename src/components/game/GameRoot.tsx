"use client";

import { useState, useSyncExternalStore } from "react";
import {
  DEFAULT_APPEARANCE,
  sanitizeAppearance,
  type Appearance,
} from "@/shared/appearance";
import { LIMITS } from "@/shared/protocol";
import { CharacterCreator } from "@/components/character/CharacterCreator";
import { Office } from "./Office";

const NAME_STORAGE_KEY = "lero:name";
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

interface Profile {
  name: string;
  appearance: Appearance;
}

/** Pede nome e aparência antes de entrar no escritório. */
export function GameRoot() {
  const [profile, setProfile] = useState<Profile | null>(null);
  if (!profile) return <JoinForm onSubmit={setProfile} />;
  return <Office name={profile.name} appearance={profile.appearance} />;
}

function JoinForm({ onSubmit }: { onSubmit: (profile: Profile) => void }) {
  const storedName = useStored(NAME_STORAGE_KEY);
  const storedAppearance = useStored(APPEARANCE_STORAGE_KEY);
  // null = usuário ainda não mexeu; mostra o que estava salvo.
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftAppearance, setDraftAppearance] = useState<Appearance | null>(null);
  const name = draftName ?? storedName;
  const appearance = draftAppearance ?? parseAppearance(storedAppearance);

  return (
    <div className="flex h-full w-full overflow-y-auto p-4">
      <form
        className="m-auto flex w-full max-w-3xl flex-col gap-5 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim().slice(0, LIMITS.nameLength);
          if (!trimmed) return;
          writeStorage(NAME_STORAGE_KEY, trimmed);
          writeStorage(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
          onSubmit({ name: trimmed, appearance });
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="player-name" className="font-display text-lg font-semibold text-neutral-100">
            Como você quer ser chamado?
          </label>
          <input
            id="player-name"
            autoFocus
            maxLength={LIMITS.nameLength}
            value={name}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Seu nome"
            className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-emerald-500"
          />
        </div>

        <CharacterCreator value={appearance} onChange={setDraftAppearance} />

        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded bg-emerald-600 px-3 py-2 font-display text-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Entrar no escritório
        </button>
      </form>
    </div>
  );
}
