"use client";

import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import type { Session } from "@/session/Session";

/**
 * Monta o Phaser no navegador. O módulo do jogo é importado dinamicamente
 * (Phaser acessa `window`), e a instância é destruída no unmount.
 * Em Strict Mode o efeito roda duas vezes: a flag `cancelled` e o cleanup
 * garantem que apenas uma instância fique viva.
 */
export function GameCanvas({ session }: { session: Session }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let game: Phaser.Game | undefined;
    let cancelled = false;

    import("@/game").then(({ createGame }) => {
      if (cancelled) return;
      game = createGame(container, session);
    });

    return () => {
      cancelled = true;
      game?.destroy(true);
      game = undefined;
    };
  }, [session]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Área do jogo" />;
}
