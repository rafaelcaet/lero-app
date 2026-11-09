"use client";

import { selectTable, type Session, type SessionState } from "@/session/Session";
import { ChatBox } from "./ChatBox";
import { VideoTile } from "./VideoTile";

interface TablePanelProps {
  session: Session;
  state: SessionState;
}

/** Painel da mesa: aparece quando há outra pessoa sentada na mesma mesa. */
export function TablePanel({ session, state }: TablePanelProps) {
  const { tableId, members } = selectTable(state);
  const { call, selfId } = state;

  if (!tableId) return null;

  if (members.length < 2) {
    return (
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-neutral-900/90 px-3 py-1.5 text-xs text-neutral-300">
        Você está sentado{call.localStream ? " · câmera e microfone prontos" : ""}. Quando alguém
        sentar nesta mesa, a conversa começa.
      </div>
    );
  }

  const others = members.filter((m) => m.id !== selfId);
  const self = selfId ? state.players[selfId] : undefined;

  return (
    <aside
      className="absolute inset-x-2 bottom-2 flex max-h-[60%] flex-col gap-2 rounded-lg border border-neutral-700 bg-neutral-900/95 p-2 text-neutral-200 shadow-xl sm:inset-x-auto sm:inset-y-2 sm:right-2 sm:max-h-none sm:w-96 lg:w-[28rem]"
      aria-label="Conversa da mesa"
    >
      <header className="flex items-center justify-between text-xs text-neutral-400">
        <span>Mesa · {members.length} pessoas</span>
        <div className="flex gap-1">
          <MediaButton
            label={call.mic ? "Desligar microfone" : "Ligar microfone"}
            on={call.mic}
            disabled={!call.hasMic}
            onClick={() => session.toggleMic()}
            icon={call.mic ? "🎙️" : "🔇"}
          />
          <MediaButton
            label={call.cam ? "Desligar câmera" : "Ligar câmera"}
            on={call.cam}
            disabled={!call.hasCam}
            onClick={() => session.toggleCam()}
            icon={call.cam ? "📹" : "🚫"}
          />
        </div>
      </header>

      {call.error && <p className="rounded bg-amber-900/50 px-2 py-1 text-[11px] text-amber-200">{call.error}</p>}

      {/* Vídeos com teto de altura para o chat nunca sumir. Em telas largas e altas, com uma
          só pessoa na conversa, ficam empilhados em largura total; no celular deitado, lado a lado. */}
      <div
        className={`grid max-h-[30dvh] shrink-0 grid-cols-2 gap-1.5 overflow-y-auto sm:max-h-[50%] sm:tall:max-h-[65%] ${others.length === 1 ? "sm:tall:grid-cols-1" : ""}`}
      >
        {others.map((p) => (
          <VideoTile
            key={p.id}
            name={p.name}
            stream={call.remoteStreams[p.id] ?? null}
            mic={p.media.mic}
            cam={p.media.cam}
            status={call.peerStatus[p.id] ?? "connecting"}
            volume={call.outputVolume}
            sinkId={call.canPickSpeaker ? call.speakerDeviceId : undefined}
          />
        ))}
        <VideoTile
          name={self?.name ?? session.name}
          stream={call.localStream}
          mic={call.mic && call.hasMic}
          cam={call.cam && call.hasCam}
          self
        />
      </div>

      <ChatBox messages={state.chat} selfId={selfId} onSend={(text) => session.sendChat(text)} />
    </aside>
  );
}

function MediaButton(props: { label: string; on: boolean; disabled: boolean; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.on}
      disabled={props.disabled}
      // Evita que o botão "roube" o foco do teclado do jogo.
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
      className={`rounded px-2 py-1 text-sm ${props.on ? "bg-neutral-700" : "bg-red-700/80"} disabled:opacity-40`}
    >
      {props.icon}
    </button>
  );
}
