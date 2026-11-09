import type { ButtonHTMLAttributes, ReactNode } from "react";

interface HudButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
  label: ReactNode;
  /** Menu aberto ou modo ligado: borda e fundo em esmeralda. */
  active?: boolean;
  /** Conteúdo à direita do rótulo (atalho de teclado, seta, etc.). */
  trailing?: ReactNode;
}

/**
 * Botão em pílula do HUD do jogo (Falar, Ações…), na identidade do Lero:
 * rótulo em Fredoka, ícone em traço esmeralda e fundo escuro translúcido.
 */
export function HudButton({ icon, label, active = false, trailing, className = "", ...props }: HudButtonProps) {
  return (
    <button
      type="button"
      // Não rouba o foco do teclado do jogo/campo ao clicar.
      onMouseDown={(e) => e.preventDefault()}
      {...props}
      className={`group flex h-11 select-none items-center gap-2 rounded-full border pl-3.5 pr-4 font-display text-sm font-semibold shadow-lg outline-none transition-[color,background-color,border-color,transform] active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
        active
          ? "border-emerald-500/60 bg-emerald-950/90 text-emerald-200"
          : "border-neutral-700 bg-neutral-900/95 text-neutral-100 hover:border-emerald-500/40 hover:bg-neutral-800/95"
      } ${className}`}
    >
      <span className={`shrink-0 ${active ? "text-emerald-300" : "text-emerald-400"}`}>{icon}</span>
      {label}
      {trailing}
    </button>
  );
}
