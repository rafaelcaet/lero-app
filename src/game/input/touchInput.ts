/**
 * Controles de toque (joystick e botão de ação na tela) → jogo.
 * Ponte simples entre a interface React e o Phaser: há um único jogo por página.
 */

let direction = { dx: 0, dy: 0 };
let interactQueued = false;
let actionLabel: string | null = null;
const listeners = new Set<() => void>();

/** Direção do joystick, já em 8 direções: dx, dy ∈ {-1, 0, 1}. */
export function setTouchDirection(dx: number, dy: number) {
  direction = { dx, dy };
}

export function getTouchDirection() {
  return direction;
}

/** Botão de ação tocado: o jogo trata no próximo quadro (como apertar "E"). */
export function queueInteract() {
  interactQueued = true;
}

export function consumeInteract(): boolean {
  const queued = interactQueued;
  interactQueued = false;
  return queued;
}

/** O jogo informa qual ação o botão faria agora ("Sentar", "Levantar"…); null = nenhuma. */
export function setActionLabel(label: string | null) {
  if (label === actionLabel) return;
  actionLabel = label;
  listeners.forEach((l) => l());
}

export function getActionLabel() {
  return actionLabel;
}

export function subscribeActionLabel(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tela de toque como entrada principal (celular/tablet). */
export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

export function resetTouchInput() {
  direction = { dx: 0, dy: 0 };
  interactQueued = false;
  setActionLabel(null);
}
