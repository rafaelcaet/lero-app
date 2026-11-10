"use client";

import { useEffect } from "react";
import type { PlayerState } from "@/shared/protocol";
import { CloseIcon, MessageIcon, WalkIcon } from "@/components/icons";
import { PlayerAvatar } from "./PlayerAvatar";
import { statusLabel } from "./PlayerList";

interface PlayerModalProps {
  player: PlayerState;
  following: boolean;
  onFollow: () => void;
  onStopFollow: () => void;
  onMessage: () => void;
  onClose: () => void;
}

/** Ações sobre um jogador: seguir e mandar DM. Fecha com Esc ou clicando fora. */
export function PlayerModal({ player, following, onFollow, onStopFollow, onMessage, onClose }: PlayerModalProps) {
  useEscape(onClose);

  return (
    <Backdrop onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-modal-name"
        className="relative w-full max-w-xs rounded-2xl border border-grape-800 bg-grape-900 p-5 text-grape-200 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded-full p-1 text-grape-500 hover:bg-grape-800 hover:text-grape-200"
        >
          <CloseIcon size={18} />
        </button>

        <div className="flex items-center gap-4 pr-6">
          <PlayerAvatar name={player.name} appearance={player.appearance} costume={player.costume} size="lg" />
          <div className="min-w-0">
            <h2 id="player-modal-name" className="truncate font-display text-xl font-semibold text-grape-50">
              {player.name}
            </h2>
            <p className="flex items-center gap-1.5 text-sm text-grape-400">
              <span className="h-2 w-2 rounded-full bg-aqua-500" />
              Online · {statusLabel(player)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <ActionButton
            autoFocus
            icon={<WalkIcon size={22} />}
            label={following ? "Parar" : "Seguir"}
            hint={following ? "Parar de seguir" : "Caminhar até a pessoa"}
            active={following}
            onClick={following ? onStopFollow : onFollow}
          />
          <ActionButton
            icon={<MessageIcon size={22} />}
            label="Mensagem"
            hint="Enviar uma DM"
            onClick={onMessage}
          />
        </div>
      </div>
    </Backdrop>
  );
}

function ActionButton(props: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  active?: boolean;
  autoFocus?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      autoFocus={props.autoFocus}
      onClick={props.onClick}
      title={props.hint}
      className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 transition-colors ${
        props.active
          ? "border-aqua-500/40 bg-aqua-500/15 text-aqua-300 hover:bg-aqua-500/25"
          : "border-grape-800 bg-grape-800/60 text-grape-100 hover:border-aqua-500/40 hover:bg-grape-800"
      }`}
    >
      <span className={props.active ? "" : "text-aqua-400"}>{props.icon}</span>
      <span className="font-display text-sm font-semibold">{props.label}</span>
    </button>
  );
}

/** Fundo escurecido de modal: fecha ao clicar fora do conteúdo. */
export function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}

export function useEscape(onEscape: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape]);
}
