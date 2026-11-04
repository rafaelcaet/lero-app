"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LIMITS, type DirectMessage } from "@/shared/protocol";
import type { DmConversation, Session, SessionState } from "@/session/Session";
import { ArrowLeftIcon, CheckCheckIcon, CloseIcon, MessageIcon, SendIcon } from "@/components/icons";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { useEscape } from "@/components/players/PlayerModal";
import logo from "../../../public/lero-logo.png";
import icon from "../../../public/lero-icon.png";
import pattern from "../../../public/lero-pattern.png";

interface PhoneChatProps {
  session: Session;
  state: SessionState;
  /** Conversa aberta ao ligar o celular (null = lista de conversas). */
  initialPeerId: string | null;
  onClose: () => void;
}

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Paleta do "app" de mensagens: base escura do Lero com acento esmeralda. */
const C = {
  screen: "bg-[#0b141a]",
  bar: "bg-[#111b21]",
  incoming: "bg-[#1f2c33]",
  outgoing: "bg-[#0d5c45]",
  field: "bg-[#2a3942]",
};

/** Mockup de celular com um chat no estilo WhatsApp, com a identidade do Lero. */
export function PhoneChat({ session, state, initialPeerId, onClose }: PhoneChatProps) {
  const [peerId, setPeerId] = useState<string | null>(initialPeerId);
  const conversation = peerId ? state.dms[peerId] : undefined;
  useEscape(onClose);

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-3 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-phone-pop relative h-[min(740px,100%)] w-full max-w-[360px]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar celular"
          className="absolute -right-2 -top-2 z-10 rounded-full bg-neutral-800 p-1.5 text-neutral-300 shadow-lg ring-1 ring-neutral-700 hover:bg-neutral-700 sm:-right-12 sm:top-0"
        >
          <CloseIcon size={18} />
        </button>

        {/* Aparelho */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mensagens do Lero"
          className="flex h-full flex-col rounded-[46px] border-[3px] border-neutral-600 bg-neutral-950 p-2.5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
        >
          <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[36px] ${C.screen} text-neutral-100`}>
            <StatusBar />
            {conversation ? (
              <ConversationScreen
                session={session}
                state={state}
                conversation={conversation}
                onBack={() => setPeerId(null)}
              />
            ) : (
              <ChatListScreen state={state} onOpen={setPeerId} />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar celular"
              className={`flex h-6 shrink-0 items-center justify-center ${C.bar}`}
            >
              <span className="h-1 w-28 rounded-full bg-white/50" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- barra de status -------------------------------------------------------

function subscribeMinute(callback: () => void) {
  const id = setInterval(callback, 15_000);
  return () => clearInterval(id);
}

function StatusBar() {
  const time = useSyncExternalStore(subscribeMinute, () => timeFormat.format(Date.now()), () => "");
  return (
    <div className={`relative flex h-10 shrink-0 items-center justify-between px-7 text-[13px] font-semibold ${C.bar}`}>
      <span className="tabular-nums">{time}</span>
      {/* Dynamic island */}
      <span className="absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
      <span className="flex items-center gap-1.5" aria-hidden>
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="4.5" y="5" width="3" height="6" rx="1" />
          <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="13.5" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor">
          <path d="M7.5 2.2c2.1 0 4 .8 5.5 2.1l1.1-1.2A9.6 9.6 0 0 0 7.5.5 9.6 9.6 0 0 0 .9 3.1L2 4.3a7.9 7.9 0 0 1 5.5-2.1Zm0 3.3c1.2 0 2.3.4 3.2 1.2l1.1-1.2A6.4 6.4 0 0 0 7.5 3.9c-1.6 0-3.1.6-4.3 1.6l1.1 1.2c.9-.8 2-1.2 3.2-1.2Zm0 3.3c-.5 0-.9.2-1.2.5l1.2 1.3 1.2-1.3c-.3-.3-.7-.5-1.2-.5Z" />
        </svg>
        <span className="flex items-center">
          <span className="flex h-[11px] w-[22px] items-center rounded-[3px] border border-current p-[1.5px]">
            <span className="h-full w-[70%] rounded-[1px] bg-current" />
          </span>
          <span className="ml-[1px] h-1 w-[1.5px] rounded-r bg-current" />
        </span>
      </span>
    </div>
  );
}

// --- lista de conversas ----------------------------------------------------

function ChatListScreen({ state, onOpen }: { state: SessionState; onOpen: (peerId: string) => void }) {
  const conversations = Object.values(state.dms).sort(
    (a, b) => (b.messages.at(-1)?.ts ?? 0) - (a.messages.at(-1)?.ts ?? 0),
  );

  return (
    <>
      <header className={`shrink-0 px-5 pb-3 pt-2 ${C.bar}`}>
        <Image src={logo} alt="Lero" className="h-7 w-auto" />
        <p className="mt-1 text-xs text-neutral-400">Conversas</p>
      </header>

      {conversations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <Image src={icon} alt="" width={64} height={64} className="rounded-2xl opacity-80" />
          <p className="font-display text-lg font-semibold">Nenhuma conversa</p>
          <p className="text-sm text-neutral-400">
            Clique num nome na lista de quem está online e escolha <MessageIcon size={14} className="inline" /> para
            mandar uma DM.
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {conversations.map((c) => {
            const last = c.messages.at(-1);
            const online = !!state.players[c.peerId];
            const fromSelf = last?.fromId === state.selfId;
            return (
              <li key={c.peerId}>
                <button
                  type="button"
                  onClick={() => onOpen(c.peerId)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
                >
                  <span className="relative">
                    <PlayerAvatar name={c.peerName} appearance={c.appearance} size="lg" />
                    {online && (
                      <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[#0b141a]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 border-b border-white/5 pb-3">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-display text-base font-semibold">{c.peerName}</span>
                      {last && (
                        <span className={`shrink-0 text-[11px] ${c.unread ? "text-emerald-400" : "text-neutral-500"}`}>
                          {timeFormat.format(last.ts)}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1 truncate text-sm text-neutral-400">
                        {fromSelf && <CheckCheckIcon size={14} className="shrink-0 text-sky-400" />}
                        <span className="truncate">{last?.text}</span>
                      </span>
                      {c.unread > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-neutral-950">
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// --- conversa --------------------------------------------------------------

function ConversationScreen({
  session,
  state,
  conversation,
  onBack,
}: {
  session: Session;
  state: SessionState;
  conversation: DmConversation;
  onBack: () => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const peer = state.players[conversation.peerId];
  const online = !!peer;
  const { peerId, messages } = conversation;

  // Conversa aberta: tudo lido, inclusive o que chegar enquanto estiver aberta.
  useEffect(() => {
    session.markDmRead(peerId);
  }, [session, peerId, messages.length]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const send = () => {
    if (!text.trim() || !online) return;
    session.sendDm(peerId, text);
    setText("");
    inputRef.current?.focus();
  };

  return (
    <>
      <header className={`flex shrink-0 items-center gap-2 px-2 pb-2.5 pt-1 ${C.bar}`}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar para as conversas"
          className="rounded-full p-1.5 text-neutral-300 hover:bg-white/10"
        >
          <ArrowLeftIcon size={20} />
        </button>
        <PlayerAvatar name={conversation.peerName} appearance={conversation.appearance} />
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold leading-tight">{conversation.peerName}</p>
          <p className={`text-xs ${online ? "text-emerald-400" : "text-neutral-500"}`}>
            {online ? "online" : "saiu do escritório"}
          </p>
        </div>
        <Image src={icon} alt="" width={26} height={26} className="ml-auto mr-2 rounded-md opacity-90" />
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
        aria-live="polite"
        // Papel de parede: mosaico com o "e" do Lero bem apagado (rola junto).
        style={{ backgroundImage: `url(${pattern.src})`, backgroundAttachment: "local" }}
      >
        <div className="space-y-1">
          <div className="mb-3 flex justify-center">
            <span className="rounded-md bg-[#1f2c33] px-2.5 py-1 text-[11px] text-neutral-300">Hoje</span>
          </div>
          <div className="mx-auto mb-3 max-w-[85%] rounded-md bg-[#1f2c33]/90 px-3 py-1.5 text-center text-[11px] leading-snug text-amber-200/90">
            🔒 Mensagens só entre vocês dois. Somem quando você sai do Lero.
          </div>
          {messages.map((m, i) => (
            <Bubble key={m.id} message={m} mine={m.fromId === state.selfId} first={messages[i - 1]?.fromId !== m.fromId} />
          ))}
        </div>
      </div>

      <form
        className={`flex shrink-0 items-center gap-2 px-2 py-2 ${C.bar}`}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          ref={inputRef}
          autoFocus
          value={text}
          disabled={!online}
          maxLength={LIMITS.dmLength}
          onChange={(e) => setText(e.target.value)}
          placeholder={online ? "Mensagem" : `${conversation.peerName} saiu do escritório`}
          aria-label={`Mensagem para ${conversation.peerName}`}
          className={`min-w-0 flex-1 rounded-full ${C.field} px-4 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 disabled:opacity-60`}
        />
        <button
          type="submit"
          disabled={!online || !text.trim()}
          aria-label="Enviar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-neutral-950 transition-opacity hover:bg-emerald-400 disabled:opacity-40"
        >
          <SendIcon size={18} />
        </button>
      </form>
    </>
  );
}

function Bubble({ message, mine, first }: { message: DirectMessage; mine: boolean; first: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${first ? "pt-1.5" : ""}`}>
      <div
        className={`relative max-w-[80%] rounded-lg px-2.5 pb-1.5 pt-1.5 text-sm shadow-sm ${
          mine ? C.outgoing : C.incoming
        } ${first ? (mine ? "rounded-tr-none" : "rounded-tl-none") : ""}`}
      >
        {first && <BubbleTail mine={mine} />}
        <p className="whitespace-pre-wrap break-words pr-14 leading-snug">{message.text}</p>
        <span className="absolute bottom-1 right-2 flex items-center gap-0.5 text-[10px] text-neutral-300/70">
          {timeFormat.format(message.ts)}
          {mine && <CheckCheckIcon size={13} className="text-sky-400" />}
        </span>
      </div>
    </div>
  );
}

/** "Rabinho" do balão, como no WhatsApp. */
function BubbleTail({ mine }: { mine: boolean }) {
  return (
    <svg
      viewBox="0 0 8 13"
      width="8"
      height="13"
      aria-hidden
      className={`absolute top-0 ${mine ? "-right-2 text-[#0d5c45]" : "-left-2 -scale-x-100 text-[#1f2c33]"}`}
    >
      <path fill="currentColor" d="M0 0h8L1.5 8.5A2 2 0 0 1 0 9.2Z" />
    </svg>
  );
}
