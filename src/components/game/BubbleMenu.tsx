"use client";

import { useEffect, useRef, useState } from "react";
import {
  BUBBLE_MAX_LENGTH,
  bubbleTextLength,
  EMOTES,
  limitBubbleText,
  sanitizeBubbleText,
  type Emote,
} from "@/shared/bubbles";
import { EMOTE_SCALE, EMOTE_SIZE } from "@/game/graphics/emoteArt";
import { SpeechIcon } from "@/components/icons";
import { emoteImageUrl } from "./emoteImage";
import { HudButton } from "./HudButton";

/** Tamanho do emote no menu (mesmo tamanho do jogo, sem distorcer os pixels). */
const EMOTE_PX = EMOTE_SIZE * EMOTE_SCALE;

/** Algum campo de texto está com o foco (aí o Enter é dele, não do atalho). */
function typingSomewhere(): boolean {
  const el = document.activeElement;
  return (
    (el instanceof HTMLInputElement && el.type !== "range" && el.type !== "checkbox") ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

/**
 * Balão de fala: mensagem curta (até 20 caracteres) ou emote, que aparece ao
 * lado da boca do personagem para todo mundo por perto. Enter abre o campo.
 */
export function BubbleMenu({
  onSay,
  onEmote,
  shortcutEnabled,
}: {
  onSay: (text: string) => void;
  onEmote: (emote: Emote) => void;
  /** Enter abre o balão (desligado quando há janela aberta por cima do jogo). */
  shortcutEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcutEnabled || open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat || e.isComposing || typingSomewhere()) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcutEnabled, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    // Devolve o teclado para o jogo.
    inputRef.current?.blur();
  };

  const say = () => {
    const clean = sanitizeBubbleText(text);
    if (clean) onSay(clean);
    setText("");
    close();
  };

  const emote = (id: Emote) => {
    onEmote(id);
    close();
  };

  // Não rouba o foco do jogo/campo ao clicar.
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();
  const length = bubbleTextLength(text);

  return (
    <div className="flex flex-col items-end gap-2">
      {open && (
        <div className="w-64 rounded-xl border border-neutral-700 bg-neutral-900/95 p-2 shadow-xl">
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              say();
            }}
          >
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(limitBubbleText(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
              }}
              placeholder="Diga algo rápido…"
              aria-label="Mensagem do balão"
              enterKeyHint="send"
              className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-emerald-500"
            />
            <button
              type="submit"
              onMouseDown={keepFocus}
              disabled={!text.trim()}
              className="rounded bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              Enviar
            </button>
          </form>
          <div className="mt-1 flex justify-between px-0.5 text-[11px] text-neutral-500">
            <span>Enter envia · Esc fecha</span>
            <span className={length >= BUBBLE_MAX_LENGTH ? "text-amber-400" : undefined}>
              {length}/{BUBBLE_MAX_LENGTH}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1 border-t border-neutral-800 pt-2">
            {EMOTES.map((e) => (
              <button
                key={e.id}
                type="button"
                onMouseDown={keepFocus}
                onClick={() => emote(e.id)}
                title={e.label}
                aria-label={e.label}
                className="flex items-center justify-center rounded-lg py-1.5 hover:bg-neutral-700 active:scale-95"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- pixel art gerada no navegador */}
                <img src={emoteImageUrl(e.id)} alt="" width={EMOTE_PX} height={EMOTE_PX} style={{ imageRendering: "pixelated" }} />
              </button>
            ))}
          </div>
        </div>
      )}
      <HudButton
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        title="Balão de fala (Enter)"
        active={open}
        icon={<SpeechIcon size={18} />}
        label="Falar"
        trailing={
          // Atalho só faz sentido com teclado: some em telas de toque.
          <kbd className="ml-0.5 rounded border border-neutral-700 bg-neutral-800 px-1.5 py-px font-sans text-[10px] font-medium text-neutral-400 pointer-coarse:hidden">
            Enter
          </kbd>
        }
      />
    </div>
  );
}
