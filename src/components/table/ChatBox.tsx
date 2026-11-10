"use client";

import { useEffect, useRef, useState } from "react";
import { LIMITS, type ChatMessage } from "@/shared/protocol";

interface ChatBoxProps {
  messages: readonly ChatMessage[];
  selfId: string | null;
  onSend: (text: string) => void;
}

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function ChatBox({ messages, selfId, onSend }: ChatBoxProps) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <ol ref={listRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 text-sm" aria-live="polite">
        {messages.length === 0 && (
          <li className="text-xs text-grape-500">Nenhuma mensagem ainda. Diga oi! 👋</li>
        )}
        {messages.map((m) => (
          <li key={m.id} className="break-words">
            <span className={`font-medium ${m.fromId === selfId ? "text-aqua-400" : "text-sky-300"}`}>
              {m.fromId === selfId ? "Você" : m.fromName}
            </span>{" "}
            <span className="text-[10px] text-grape-500">{timeFormat.format(m.ts)}</span>
            <p className="text-grape-200">{m.text}</p>
          </li>
        ))}
      </ol>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onSend(text);
          setText("");
        }}
      >
        <input
          ref={inputRef}
          value={text}
          maxLength={LIMITS.chatLength}
          onChange={(e) => setText(e.target.value)}
          // Esc devolve o foco ao jogo.
          onKeyDown={(e) => e.key === "Escape" && inputRef.current?.blur()}
          placeholder="Mensagem para a mesa…"
          aria-label="Mensagem para a mesa"
          className="min-w-0 flex-1 rounded border border-grape-700 bg-grape-950 px-2 py-1.5 text-sm text-grape-100 outline-none focus:border-aqua-500"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded bg-aqua-400 px-3 text-sm font-medium text-grape-950 hover:bg-aqua-300 disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
