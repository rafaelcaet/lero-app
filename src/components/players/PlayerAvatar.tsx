import { cssColor, paletteOf } from "@/game/characters/characterPalettes";

/** Círculo com a cor da camisa do personagem e a inicial do nome. */
export function PlayerAvatar({ name, colorIndex, size = "md" }: { name: string; colorIndex: number; size?: "md" | "lg" }) {
  const palette = paletteOf(colorIndex);
  const dimensions = size === "lg" ? "h-14 w-14 text-xl" : "h-8 w-8 text-sm";
  return (
    <span
      aria-hidden
      className={`${dimensions} flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-black/20`}
      style={{ backgroundColor: cssColor(palette.shirt) }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
