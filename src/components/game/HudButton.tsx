import type { ButtonHTMLAttributes, ReactNode } from "react";

interface HudButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
  label: ReactNode;
  /** Menu aberto ou modo ligado: borda e fundo em Pearl Aqua. */
  active?: boolean;
  /** Conteúdo à direita do rótulo (atalho de teclado, seta, etc.). */
  trailing?: ReactNode;
}

/**
 * Botão em pílula do HUD do jogo (Falar, Ações…), na identidade do Lero:
 * rótulo em fonte pixel, ícone em traço Pearl Aqua e fundo escuro translúcido.
 */
export function HudButton({ icon, label, active = false, trailing, className = "", ...props }: HudButtonProps) {
  return (
    <button
      type="button"
      // Não rouba o foco do teclado do jogo/campo ao clicar.
      onMouseDown={(e) => e.preventDefault()}
      {...props}
      className={`group flex h-11 select-none items-center gap-2 rounded-full border pl-3.5 pr-4 font-display text-sm font-semibold shadow-lg outline-none transition-[color,background-color,border-color,transform] active:scale-95 focus-visible:ring-2 focus-visible:ring-aqua-400/60 ${
        active
          ? "border-aqua-500/60 bg-aqua-950/90 text-aqua-200"
          : "border-grape-700 bg-grape-900/95 text-grape-100 hover:border-aqua-500/40 hover:bg-grape-800/95"
      } ${className}`}
    >
      <span className={`shrink-0 ${active ? "text-aqua-300" : "text-aqua-400"}`}>{icon}</span>
      {label}
      {trailing}
    </button>
  );
}
