import { portraitUrl } from "@/components/character/characterImage";
import { cssColor, OUTFIT_COLORS, type Appearance } from "@/shared/appearance";
import type { CostumeId } from "@/shared/costumes";

/** Círculo com o rosto do personagem (pixel art) sobre a cor da roupa. */
export function PlayerAvatar({
  name,
  appearance,
  costume = null,
  size = "md",
}: {
  name: string;
  appearance: Appearance;
  /** Fantasia vestida (aparece no retrato). */
  costume?: CostumeId | null;
  size?: "md" | "lg";
}) {
  const dimensions = size === "lg" ? "h-14 w-14" : "h-8 w-8";
  return (
    <span
      aria-hidden
      title={name}
      className={`${dimensions} flex shrink-0 items-end justify-center overflow-hidden rounded-full ring-2 ring-black/20`}
      style={{ backgroundColor: `color-mix(in srgb, ${cssColor(OUTFIT_COLORS[appearance.outfitColor].color)} 45%, #f4f0e6)` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no cliente */}
      <img src={portraitUrl(appearance, costume)} alt="" className="h-[95%] w-[95%] [image-rendering:pixelated]" />
    </span>
  );
}
