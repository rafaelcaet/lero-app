import type { SVGProps } from "react";

/**
 * Ícones em SVG (traço no estilo Lucide, licença ISC; "andando" no estilo
 * Material Symbols, Apache 2.0). Herdam a cor do texto via currentColor.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Stroke({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

/** Pessoa andando (seguir). */
export function WalkIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />
    </svg>
  );
}

/** Balão de mensagem (DM). */
export function MessageIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </Stroke>
  );
}

export function MicIcon({ off = false, ...props }: IconProps & { off?: boolean }) {
  return (
    <Stroke {...props}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
      {off && <line x1="3" x2="21" y1="3" y2="21" />}
    </Stroke>
  );
}

export function CamIcon({ off = false, ...props }: IconProps & { off?: boolean }) {
  return (
    <Stroke {...props}>
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
      {off && <line x1="2" x2="22" y1="2" y2="22" />}
    </Stroke>
  );
}

export function VolumeIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
      <path d="M16 9a5 5 0 0 1 0 6" />
      <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
    </Stroke>
  );
}

export function ChevronIcon({ direction = "right", ...props }: IconProps & { direction?: "left" | "right" | "down" | "up" }) {
  const d = { right: "m9 18 6-6-6-6", left: "m15 18-6-6 6-6", down: "m6 9 6 6 6-6", up: "m18 15-6-6-6 6" }[direction];
  return (
    <Stroke {...props}>
      <path d={d} />
    </Stroke>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Stroke>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
    </Stroke>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </Stroke>
  );
}

/** Dois "vistos" (mensagem entregue). */
export function CheckCheckIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M18 6 7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </Stroke>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Stroke>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <line x1="21" x2="14" y1="4" y2="4" />
      <line x1="10" x2="3" y1="4" y2="4" />
      <line x1="21" x2="12" y1="12" y2="12" />
      <line x1="8" x2="3" y1="12" y2="12" />
      <line x1="21" x2="16" y1="20" y2="20" />
      <line x1="12" x2="3" y1="20" y2="20" />
      <line x1="14" x2="14" y1="2" y2="6" />
      <line x1="8" x2="8" y1="10" y2="14" />
      <line x1="16" x2="16" y1="18" y2="22" />
    </Stroke>
  );
}

/** Lerocoin: moeda dourada em pixel art com um "L". Cores próprias (não herda currentColor). */
const COIN_ART = [
  "...oooooo...",
  "..oyyyyyyo..",
  ".oywwyyyyyo.",
  "oywyyyyyyydo",
  "oyyykkyyyydo",
  "oyyykkyyyydo",
  "oyyykkyyyydo",
  "oyyykkkkkydo",
  "oyyykkkkkydo",
  ".oyyyyyyydo.",
  "..oddddddo..",
  "...oooooo...",
];
const COIN_COLORS: Record<string, string> = {
  o: "#6a3c08",
  y: "#f8c838",
  w: "#fff4b0",
  d: "#c08018",
  k: "#8a5410",
};

export function LerocoinIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden {...props}>
      {COIN_ART.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={COIN_COLORS[ch]} />,
        ),
      )}
    </svg>
  );
}

/** Loja (estilo Lucide "store"). */
export function ShopIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
      <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
    </Stroke>
  );
}
