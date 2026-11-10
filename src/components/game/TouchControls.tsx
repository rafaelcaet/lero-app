"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getActionLabel,
  queueInteract,
  resetTouchInput,
  setTouchDirection,
  subscribeActionLabel,
} from "@/game/input/touchInput";

const COARSE_QUERY = "(pointer: coarse)";

function subscribeCoarse(listener: () => void) {
  const media = window.matchMedia(COARSE_QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/** true em celular/tablet (toque como entrada principal). No servidor, false. */
export function useIsTouch(): boolean {
  return useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(COARSE_QUERY).matches,
    () => false,
  );
}

/** Raio do curso do joystick (px). */
const RADIUS = 44;
/** Abaixo desta fração do raio, fica parado. */
const DEAD_ZONE = 0.28;

/** Ângulo → uma das 8 direções. */
function toDirection(x: number, y: number): { dx: number; dy: number } {
  if (Math.hypot(x, y) < RADIUS * DEAD_ZONE) return { dx: 0, dy: 0 };
  const angle = Math.round(Math.atan2(y, x) / (Math.PI / 4)) * (Math.PI / 4);
  return { dx: Math.round(Math.cos(angle)), dy: Math.round(Math.sin(angle)) };
}

/**
 * Controles na tela para celular: joystick (andar) no canto inferior esquerdo e
 * botão de ação (sentar/levantar) no inferior direito, que só aparece quando há
 * algo para fazer. Sentado, o joystick some e o botão sobe para não ficar
 * embaixo do painel da mesa.
 */
export function TouchControls({ seated }: { seated: boolean }) {
  const actionLabel = useSyncExternalStore(subscribeActionLabel, getActionLabel, () => null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointerId = useRef<number | null>(null);
  const center = useRef({ x: 0, y: 0 });

  useEffect(() => resetTouchInput, []);

  const release = () => {
    pointerId.current = null;
    setKnob({ x: 0, y: 0 });
    setTouchDirection(0, 0);
  };

  const moveTo = (clientX: number, clientY: number) => {
    let x = clientX - center.current.x;
    let y = clientY - center.current.y;
    const distance = Math.hypot(x, y);
    if (distance > RADIUS) {
      x = (x / distance) * RADIUS;
      y = (y / distance) * RADIUS;
    }
    setKnob({ x, y });
    const { dx, dy } = toDirection(x, y);
    setTouchDirection(dx, dy);
  };

  return (
    <>
      {!seated && (
        <div
          role="presentation"
          className="absolute bottom-5 left-5 z-10 flex h-32 w-32 touch-none select-none items-center justify-center rounded-full border-2 border-white/15 bg-grape-900/45 backdrop-blur-[1px]"
          onPointerDown={(e) => {
            if (pointerId.current !== null) return;
            e.preventDefault();
            // Sai do campo de texto (ex.: chat), senão o jogo ignora o movimento.
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            const rect = e.currentTarget.getBoundingClientRect();
            center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            pointerId.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            moveTo(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (e.pointerId === pointerId.current) moveTo(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (e.pointerId === pointerId.current) release();
          }}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div
            className="pointer-events-none h-14 w-14 rounded-full border-2 border-white/30 bg-white/25 shadow-lg"
            style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
          />
        </div>
      )}

      {actionLabel && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            queueInteract();
          }}
          onClick={(e) => {
            // Teclado/leitor de tela: o clique sem ponteiro também conta.
            if (e.detail === 0) queueInteract();
          }}
          onContextMenu={(e) => e.preventDefault()}
          className={`absolute z-10 flex touch-none select-none items-center justify-center rounded-full border-2 border-aqua-300/50 bg-aqua-400/90 font-display text-sm font-semibold text-grape-950 shadow-xl active:scale-95 active:bg-aqua-300 ${
            seated ? "left-3 top-14 h-11 px-5" : "bottom-8 right-5 h-20 w-20"
          }`}
        >
          {actionLabel}
        </button>
      )}
    </>
  );
}
