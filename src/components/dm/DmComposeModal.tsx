"use client";

import { useState } from "react";
import { LIMITS, type PlayerState } from "@/shared/protocol";
import { CloseIcon, SendIcon } from "@/components/icons";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { Backdrop, useEscape } from "@/components/players/PlayerModal";

interface DmComposeModalProps {
  player: PlayerState;
  onSend: (text: string) => void;
  onClose: () => void;
}

/** Escreve a primeira mensagem (ou mais uma) para alguém da lista. */
export function DmComposeModal({ player, onSend, onClose }: DmComposeModalProps) {
  const [text, setText] = useState("");
  useEscape(onClose);

  const submit = () => {
    if (!text.trim()) return;
    onSend(text);
    onClose();
  };

  return (
    <Backdrop onClose={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="dm-compose-title"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="relative w-full max-w-sm rounded-2xl border border-grape-800 bg-grape-900 p-5 text-grape-200 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded-full p-1 text-grape-500 hover:bg-grape-800 hover:text-grape-200"
        >
          <CloseIcon size={18} />
        </button>

        <div className="flex items-center gap-3 pr-6">
          <PlayerAvatar name={player.name} appearance={player.appearance} costume={player.costume} />
          <div className="min-w-0">
            <h2 id="dm-compose-title" className="truncate font-display text-lg font-semibold text-grape-50">
              Mensagem para {player.name}
            </h2>
            <p className="text-xs text-grape-500">Só vocês dois veem esta conversa.</p>
          </div>
        </div>

        <textarea
          autoFocus
          value={text}
          maxLength={LIMITS.dmLength}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter envia; Shift+Enter quebra a linha.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={4}
          placeholder="Escreva sua mensagem…"
          aria-label={`Mensagem para ${player.name}`}
          className="mt-4 w-full resize-none rounded-lg border border-grape-700 bg-grape-950 px-3 py-2 text-sm text-grape-100 outline-none placeholder:text-grape-600 focus:border-aqua-500"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-grape-500">Enter envia · Shift+Enter quebra linha</span>
          <button
            type="submit"
            disabled={!text.trim()}
            className="flex items-center gap-2 rounded-lg bg-aqua-400 px-4 py-2 font-display text-sm font-semibold text-grape-950 hover:bg-aqua-300 disabled:opacity-40"
          >
            Enviar
            <SendIcon size={16} />
          </button>
        </div>
      </form>
    </Backdrop>
  );
}
