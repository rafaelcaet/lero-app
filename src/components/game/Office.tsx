"use client";

import { useCallback, useEffect, useState } from "react";
import { logout } from "@/app/(auth)/actions";
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
import { ActivityMenu } from "./ActivityMenu";
import { BubbleMenu } from "./BubbleMenu";
import { GameCanvas } from "./GameCanvas";
import { TouchControls, useIsTouch } from "./TouchControls";

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
export function Office({ name, appearance, ticket }: { name: string; appearance: Appearance; ticket: string }) {
  // Construir a sessão não conecta; a conexão abre/fecha no efeito (seguro em Strict Mode).
  const [session] = useState(() => new Session(name, appearance, resolveServerUrl(), ticket));
  const state = useSessionState(session);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [listOpen, setListOpen] = useState(false);
  // O escritório só é montado no navegador (depois do nome), então pode ler o localStorage aqui.
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const isTouch = useIsTouch();

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
  const self = state.selfId ? state.players[state.selfId] : undefined;
  const seated = Boolean(self?.seatId);

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
          {(state.status === "connecting" || state.status === "closed") && (
            <div className="rounded-full bg-amber-600/90 px-3 py-1 text-xs font-semibold text-white">
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
          <div
            className={`absolute left-1/2 flex -translate-x-1/2 ${isTouch ? "top-16" : "bottom-3"} items-center gap-3 rounded-full border border-aqua-500/30 bg-grape-900/95 py-1 pl-4 pr-1 text-xs text-grape-200 shadow-lg`}
          >
            <span>
              Seguindo <strong className="font-semibold text-aqua-400">{followed.name}</strong>
            </span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => session.stopFollow()}
              className="rounded-full bg-grape-700 px-3 py-1 font-medium hover:bg-grape-600"
            >
              Parar
            </button>
          </div>
        )}
        <TablePanel session={session} state={state} />

        {/* Celular/tablet: joystick e botão de ação na tela. Some com janelas abertas. */}
        {isTouch && !overlay && !listOpen && <TouchControls seated={seated} />}

        {/* Balão de fala e atividades: só em pé; no celular ficam acima do botão de ação. */}
        {self && !seated && (
          <div className={`absolute z-10 flex items-end gap-2 ${isTouch ? "bottom-32 right-5" : "bottom-4 right-4"}`}>
            <BubbleMenu
              onSay={(text) => session.sayBubble(text)}
              onEmote={(emote) => session.sendEmote(emote)}
              shortcutEnabled={!overlay && !listOpen}
            />
            <ActivityMenu current={self.activity} onChange={(activity) => session.setActivity(activity)} />
          </div>
        )}

        {/* No celular a lista abre por cima do jogo. */}
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full border border-grape-700 bg-grape-900/95 px-3 py-1.5 text-xs font-medium text-grape-200 shadow-lg md:hidden"
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
        className={`w-72 shrink-0 border-l border-grape-800 ${
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

      {state.status === "unauthorized" && <SessionExpired />}

      {overlay?.kind === "shop" && <ShopModal session={session} state={state} onClose={closeOverlay} />}

      {overlay?.kind === "phone" && (
        <PhoneChat session={session} state={state} initialPeerId={overlay.peerId} onClose={closeOverlay} />
      )}
    </div>
  );
}

/** O servidor do jogo recusou o ingresso (venceu ou é inválido): precisa entrar de novo. */
function SessionExpired() {
  return (
    <div role="alertdialog" aria-labelledby="session-expired-title" className="absolute inset-0 z-40 flex items-center justify-center bg-carbon/80 p-4 backdrop-blur-sm">
      <form action={logout} className="flex max-w-sm flex-col gap-4 rounded-[22px] border border-white/10 bg-grape-900 p-6 text-center shadow-2xl">
        <h2 id="session-expired-title" className="font-display text-xl font-semibold uppercase tracking-wide text-white">
          Sua sessão expirou
        </h2>
        <p className="text-sm text-grape-300">Entre de novo para voltar ao escritório. Suas Lerocoins continuam guardadas.</p>
        <button
          type="submit"
          className="btn-block h-11 rounded-xl border-aqua-700 bg-aqua-400 font-display font-semibold uppercase tracking-wider text-carbon"
        >
          Entrar de novo
        </button>
      </form>
    </div>
  );
}
