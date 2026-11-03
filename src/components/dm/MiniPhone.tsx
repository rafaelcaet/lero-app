"use client";

import Image from "next/image";
import icon from "../../../public/lero-icon.png";

interface MiniPhoneProps {
  /** Conversas com mensagens não lidas. */
  unread: number;
  onOpen: () => void;
}

/** Celularzinho no topo da tela: vibra e mostra quantas conversas não foram lidas. */
export function MiniPhone({ unread, onOpen }: MiniPhoneProps) {
  const label =
    unread === 0
      ? "Abrir mensagens"
      : `Abrir mensagens: ${unread} ${unread === 1 ? "conversa não lida" : "conversas não lidas"}`;

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseDown={(e) => e.preventDefault()}
      aria-label={label}
      title={label}
      className={`group relative block ${unread > 0 ? "animate-phone-buzz" : ""}`}
    >
      {/* Corpo do aparelho */}
      <span className="flex h-14 w-9 flex-col items-center rounded-[10px] border-2 border-neutral-400 bg-neutral-950 p-[3px] shadow-lg shadow-black/50 transition-transform group-hover:-translate-y-0.5">
        <span className="mb-0.5 h-[3px] w-3 rounded-full bg-neutral-700" />
        <span className="relative flex w-full flex-1 items-center justify-center overflow-hidden rounded-[5px] bg-[#0b141a]">
          <Image src={icon} alt="" width={20} height={20} className="rounded-[4px]" />
        </span>
        <span className="mt-0.5 h-[3px] w-2.5 rounded-full bg-neutral-600" />
      </span>
      {unread > 0 && (
        <span className="absolute -right-2.5 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-neutral-950">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
