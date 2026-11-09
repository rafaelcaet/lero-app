"use client";

import type { PlayerState } from "@/shared/protocol";
import type { Session, SessionState } from "@/session/Session";
import { CamIcon, ChevronIcon, MicIcon, SlidersIcon } from "@/components/icons";
import { MediaSettings } from "@/components/media/MediaSettings";
import { PlayerAvatar } from "./PlayerAvatar";

interface PlayerListProps {
  session: Session;
  state: SessionState;
  onSelect: (playerId: string) => void;
  /** Recolhida: só avatares e atalhos de mídia (desktop). */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  className?: string;
}

/** Você primeiro; depois os outros em ordem alfabética. */
function sortPlayers(players: PlayerState[], selfId: string | null) {
  return [...players].sort((a, b) => {
    if (a.id === selfId) return -1;
    if (b.id === selfId) return 1;
    return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
  });
}

export function statusLabel(player: PlayerState) {
  return player.seatId ? "Numa mesa" : "Pelo escritório";
}

/** Barra lateral: quem está online (clique abre as ações) e configurações de mídia. */
export function PlayerList(props: PlayerListProps) {
  const { state, collapsed } = props;
  const players = sortPlayers(Object.values(state.players), state.selfId);
  return (
    <aside
      aria-label="Jogadores online"
      className={`flex min-h-0 flex-col overflow-hidden bg-neutral-900 text-neutral-200 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        collapsed ? "md:w-16" : "md:w-64"
      } ${props.className ?? ""}`}
    >
      {/*
        Conteúdo com largura fixa: não se espreme enquanto a barra anima,
        só é recortado. A troca entre os estados entra com um fade curto.
      */}
      <div
        key={collapsed ? "rail" : "list"}
        className={`animate-sidebar-fade flex h-full min-h-0 shrink-0 flex-col ${collapsed ? "w-16" : "w-72 md:w-64"}`}
      >
        {collapsed ? <CollapsedRail {...props} players={players} /> : <ExpandedList {...props} players={players} />}
      </div>
    </aside>
  );
}

type InnerProps = PlayerListProps & { players: PlayerState[] };

function ExpandedList({ session, state, players, onSelect, onToggleCollapsed }: InnerProps) {
  const { selfId, followTargetId, status } = state;
  return (
    <>
      <header className="flex items-center justify-between gap-2 border-b border-neutral-800 px-4 py-3">
        <h2 className="font-display text-base font-semibold">Online</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
            {players.length}
          </span>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Recolher barra lateral"
            title="Recolher"
            className="hidden rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 md:block"
          >
            <ChevronIcon direction="right" size={18} />
          </button>
        </div>
      </header>

      {status !== "open" || players.length === 0 ? (
        <p className="flex-1 px-4 py-3 text-xs text-neutral-500">
          {status === "open" ? "Ninguém por aqui ainda." : "Conectando ao servidor…"}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {players.map((player) => {
            const isSelf = player.id === selfId;
            const isFollowed = player.id === followTargetId;
            const unread = state.dms[player.id]?.unread ?? 0;
            const content = (
              <>
                <span className="relative">
                  <PlayerAvatar name={player.name} appearance={player.appearance} costume={player.costume} />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-neutral-900" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-100">
                    {player.name}
                    {isSelf && <span className="font-normal text-neutral-500"> (você)</span>}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    {isFollowed ? "Você está seguindo" : statusLabel(player)}
                  </span>
                </span>
                {unread > 0 && (
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-neutral-950"
                    aria-label={`${unread} mensagens não lidas`}
                  >
                    {unread}
                  </span>
                )}
                {isFollowed && !unread && <span aria-hidden className="text-xs text-emerald-400">●</span>}
              </>
            );

            return (
              <li key={player.id}>
                {isSelf ? (
                  <div className="flex items-center gap-3 rounded-md px-2 py-2">{content}</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(player.id)}
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-neutral-800 focus-visible:bg-neutral-800 focus-visible:outline-none ${
                      isFollowed ? "bg-emerald-500/10" : ""
                    }`}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <MediaSettings session={session} call={state.call} />
    </>
  );
}

/** Versão recolhida: avatares empilhados e atalhos de microfone/câmera. */
function CollapsedRail({ session, state, players, onSelect, onToggleCollapsed }: InnerProps) {
  const { call, selfId } = state;
  return (
    <>
      <div className="flex flex-col items-center gap-2 border-b border-neutral-800 py-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Expandir barra lateral"
          title="Expandir"
          className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
        >
          <ChevronIcon direction="left" size={18} />
        </button>
        <span
          className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400"
          title={`${players.length} online`}
        >
          {players.length}
        </span>
      </div>

      <ul className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto py-3">
        {players.map((player) => {
          const isSelf = player.id === selfId;
          const unread = state.dms[player.id]?.unread ?? 0;
          const avatar = (
            <span className="relative block">
              <PlayerAvatar name={player.name} appearance={player.appearance} costume={player.costume} />
              {unread > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-neutral-950 ring-2 ring-neutral-900">
                  {unread}
                </span>
              ) : (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-neutral-900" />
              )}
            </span>
          );
          const label = isSelf ? `${player.name} (você)` : player.name;
          return (
            <li key={player.id}>
              {isSelf ? (
                <span title={label}>{avatar}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(player.id)}
                  title={label}
                  aria-label={label}
                  className={`rounded-full transition-transform hover:scale-110 ${
                    state.followTargetId === player.id ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-neutral-900" : ""
                  }`}
                >
                  {avatar}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col items-center gap-2 border-t border-neutral-800 py-3">
        <RailButton
          label={call.mic ? "Desligar microfone" : "Ligar microfone"}
          off={!call.mic}
          onClick={() => session.toggleMic()}
        >
          <MicIcon off={!call.mic} size={18} />
        </RailButton>
        <RailButton
          label={call.cam ? "Desligar câmera" : "Ligar câmera"}
          off={!call.cam}
          onClick={() => session.toggleCam()}
        >
          <CamIcon off={!call.cam} size={18} />
        </RailButton>
        <RailButton label="Volumes e mais opções" onClick={onToggleCollapsed}>
          <SlidersIcon size={18} />
        </RailButton>
      </div>
    </>
  );
}

function RailButton(props: { label: string; off?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.off === undefined ? undefined : !props.off}
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
      className={`rounded-lg p-2 transition-colors ${
        props.off ? "bg-red-600/20 text-red-300 hover:bg-red-600/30" : "text-neutral-300 hover:bg-neutral-800"
      }`}
    >
      {props.children}
    </button>
  );
}
