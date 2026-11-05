"use client";

import { useCallback, useEffect, useState } from "react";
import { resolveServerUrl, Session, unreadConversations } from "@/session/Session";
import { useSessionState } from "@/session/useSession";
import type { Appearance } from "@/shared/appearance";
import { DmComposeModal } from "@/components/dm/DmComposeModal";
import { MiniPhone } from "@/components/dm/MiniPhone";
import { PhoneChat } from "@/components/dm/PhoneChat";
import { UsersIcon } from "@/components/icons";
import { PlayerList } from "@/components/players/PlayerList";
import { PlayerModal } from "@/components/players/PlayerModal";
import { CoinCounter } from "@/components/shop/CoinCounter";
import { ShopModal } from "@/components/shop/ShopModal";
import { TablePanel } from "@/components/table/TablePanel";
import { loadWalletKey } from "@/session/walletKey";
import { GameCanvas } from "./GameCanvas";

const SIDEBAR_KEY = "lero:sidebar-collapsed";

/** Qual janela está aberta por cima do jogo. */
type Overlay =
  | { kind: "player"; playerId: string }
  | { kind: "compose"; playerId: string }
  | { kind: "phone"; peerId: string | null }
  | { kind: "shop" }
  | null;

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

/** O escritório: jogo, barra lateral, chamada da mesa e mensagens diretas. */
export function Office({ name, appearance }: { name: string; appearance: Appearance }) {
  // Construir a sessão não conecta; a conexão abre/fecha no efeito (seguro em Strict Mode).
  const [session] = useState(() => new Session(name, appearance, resolveServerUrl(), loadWalletKey()));
  const state = useSessionState(session);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [listOpen, setListOpen] = useState(false);
  // O escritório só é montado no navegador (depois do nome), então pode ler o localStorage aqui.
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    session.start();
    return () => session.stop();
  }, [session]);

  const closeOverlay = useCallback(() => setOverlay(null), []);
  const toggleCollapsed = () =>
    setCollapsed((value) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, value ? "0" : "1");
      } catch {
        // sem armazenamento: vale só nesta sessão
      }
      return !value;
    });

  const followed = state.followTargetId ? state.players[state.followTargetId] : undefined;
  const onlineCount = Object.keys(state.players).length;
  const unread = unreadConversations(state);

  const openPhone = () => {
    // Uma única conversa não lida: abre direto nela.
    const pending = Object.values(state.dms).filter((c) => c.unread > 0);
    setOverlay({ kind: "phone", peerId: pending.length === 1 ? pending[0].peerId : null });
  };

  const overlayPlayer =
    overlay && (overlay.kind === "player" || overlay.kind === "compose") ? state.players[overlay.playerId] : undefined;

  return (
    <div className="relative flex h-full w-full">
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <GameCanvas session={session} />

        {/* Topo: celular de mensagens e aviso de conexão. */}
        <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-2">
          {/* Sempre visível; vibra quando há conversa não lida. */}
          <div className="pointer-events-auto">
            <MiniPhone unread={unread} onOpen={openPhone} />
          </div>
          {state.status !== "open" && (
            <div className="rounded bg-amber-600/90 px-3 py-1 text-xs text-white">
              {state.status === "connecting" ? "Conectando ao servidor…" : "Sem conexão com o servidor. Tentando novamente…"}
            </div>
          )}
        </div>

        {/* Canto superior esquerdo: Lerocoins e loja. */}
        {state.wallet && (
          <div className="absolute left-3 top-3">
            <CoinCounter coins={state.wallet.coins} onOpenShop={() => setOverlay({ kind: "shop" })} />
          </div>
        )}

        {followed && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-emerald-500/30 bg-neutral-900/95 py-1 pl-4 pr-1 text-xs text-neutral-200 shadow-lg">
            <span>
              Seguindo <strong className="font-semibold text-emerald-400">{followed.name}</strong>
            </span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => session.stopFollow()}
              className="rounded-full bg-neutral-700 px-3 py-1 font-medium hover:bg-neutral-600"
            >
              Parar
            </button>
          </div>
        )}
        <TablePanel session={session} state={state} />

        {/* No celular a lista abre por cima do jogo. */}
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900/95 px-3 py-1.5 text-xs font-medium text-neutral-200 shadow-lg md:hidden"
          aria-label={`Ver jogadores online (${onlineCount})`}
        >
          <UsersIcon size={14} /> {onlineCount}
        </button>
      </div>

      <PlayerList
        session={session}
        state={state}
        collapsed={collapsed && !listOpen}
        onToggleCollapsed={toggleCollapsed}
        onSelect={(playerId) => {
          setOverlay({ kind: "player", playerId });
          setListOpen(false);
        }}
        className={`w-72 shrink-0 border-l border-neutral-800 ${
          listOpen ? "absolute inset-y-0 right-0 z-20 flex shadow-2xl" : "hidden"
        } md:static md:flex md:shadow-none`}
      />
      {listOpen && (
        <div className="absolute inset-0 z-10 bg-black/40 md:hidden" onClick={() => setListOpen(false)} aria-hidden />
      )}

      {overlay?.kind === "player" && overlayPlayer && (
        <PlayerModal
          player={overlayPlayer}
          following={state.followTargetId === overlayPlayer.id}
          onFollow={() => {
            session.follow(overlayPlayer.id);
            closeOverlay();
          }}
          onStopFollow={() => {
            session.stopFollow();
            closeOverlay();
          }}
          onMessage={() => setOverlay({ kind: "compose", playerId: overlayPlayer.id })}
          onClose={closeOverlay}
        />
      )}

      {overlay?.kind === "compose" && overlayPlayer && (
        <DmComposeModal
          player={overlayPlayer}
          onSend={(text) => session.sendDm(overlayPlayer.id, text)}
          onClose={closeOverlay}
        />
      )}

      {overlay?.kind === "shop" && <ShopModal session={session} state={state} onClose={closeOverlay} />}

      {overlay?.kind === "phone" && (
        <PhoneChat session={session} state={state} initialPeerId={overlay.peerId} onClose={closeOverlay} />
      )}
    </div>
  );
}
