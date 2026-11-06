/** Atividades que o jogador pode acionar (o personagem para e faz algo). */
export const ACTIVITIES = [
  { id: "eating", label: "Almoçando", emoji: "🍔" },
  { id: "smoking", label: "Fumando", emoji: "🚬" },
  { id: "sleeping", label: "Dormindo", emoji: "😴" },
] as const;

export type Activity = (typeof ACTIVITIES)[number]["id"];

const IDS: ReadonlySet<unknown> = new Set(ACTIVITIES.map((a) => a.id));

export function isActivity(value: unknown): value is Activity {
  return IDS.has(value);
}
