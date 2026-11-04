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

    // O Phaser só confere o tamanho da área a cada 500 ms; quando ela muda
    // (ex.: barra lateral animando), redimensiona a cada quadro da animação.
    // Redimensionar um canvas WebGL apaga o conteúdo (fica preto) até o próximo
    // quadro do jogo; por isso redesenha já, antes de o navegador pintar a tela.
    const observer = new ResizeObserver(() => {
      if (!game?.scale.getParentBounds()) return;
      game.scale.refresh();
      redrawNow(game);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      cancelled = true;
      game?.destroy(true);
      game = undefined;
    };
  }, [session]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden" aria-label="Área do jogo" />;
}

/** Só desenha (sem avançar a lógica do jogo), no tamanho novo do canvas. */
function redrawNow(game: Phaser.Game) {
  const renderer = game.renderer;
  if (!renderer || game.isPaused) return;
  renderer.preRender();
  game.scene.render(renderer);
  renderer.postRender();
}
