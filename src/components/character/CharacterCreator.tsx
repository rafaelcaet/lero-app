"use client";

import { useEffect, useRef, useState } from "react";
import type { Direction } from "@/game/characters/characterArt";
import {
  BODY_TYPES,
  cssColor,
  EYE_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFIT_COLORS,
  OUTFITS,
  randomAppearance,
  SHOE_COLORS,
  SHOE_STYLES,
  SKIN_TONES,
  type Appearance,
  type NamedColor,
} from "@/shared/appearance";
import { paintCharacter } from "./characterImage";

/** Colunas do sheet usadas na prévia: anda no lugar (3–6). */
const WALK_COLUMNS = [3, 4, 5, 6];
const FRAME_MS = 160;
/** Ordem ao girar o personagem (sentido horário visto de cima). */
const ROTATION: Direction[] = ["down", "left", "up", "right"];

/** Editor do visual do personagem: sexo, cabelo, pele, olhos, roupa e sapato. */
export function CharacterCreator({
  value,
  onChange,
}: {
  value: Appearance;
  onChange: (appearance: Appearance) => void;
}) {
  const set = <K extends keyof Appearance>(key: K, v: Appearance[K]) => onChange({ ...value, [key]: v });

  return (
    <fieldset className="grid gap-5 md:grid-cols-[220px_1fr]">
      <legend className="mb-3 font-display text-lg font-semibold text-grape-100">Seu personagem</legend>

      <Preview appearance={value} onRandom={() => onChange(randomAppearance())} />

      <div className="flex min-w-0 flex-col gap-4">
        <Field label="Sexo">
          <div role="radiogroup" aria-label="Sexo" className="grid grid-cols-2 gap-1 rounded-md bg-grape-950 p-1">
            {BODY_TYPES.map((b) => (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={value.body === b.id}
                onClick={() => set("body", b.id)}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  value.body === b.id ? "bg-aqua-400 text-grape-950" : "text-grape-400 hover:text-grape-100"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Cabelo">
          <Stepper label="Estilo do cabelo" options={HAIR_STYLES} value={value.hairStyle} onChange={(v) => set("hairStyle", v)} />
          <Swatches label="Cor do cabelo" colors={HAIR_COLORS} value={value.hairColor} onChange={(v) => set("hairColor", v)} />
        </Field>

        <Field label="Tom de pele">
          <Swatches label="Tom de pele" colors={SKIN_TONES} value={value.skin} onChange={(v) => set("skin", v)} />
        </Field>

        <Field label="Olhos">
          <Stepper label="Estilo dos olhos" options={EYE_STYLES} value={value.eyes} onChange={(v) => set("eyes", v)} />
        </Field>

        <Field label="Roupa">
          <Stepper label="Roupa" options={OUTFITS} value={value.outfit} onChange={(v) => set("outfit", v)} />
          <Swatches label="Cor da roupa" colors={OUTFIT_COLORS} value={value.outfitColor} onChange={(v) => set("outfitColor", v)} />
        </Field>

        <Field label="Sapato">
          <Stepper label="Sapato" options={SHOE_STYLES} value={value.shoes} onChange={(v) => set("shoes", v)} />
          <Swatches label="Cor do sapato" colors={SHOE_COLORS} value={value.shoeColor} onChange={(v) => set("shoeColor", v)} />
        </Field>
      </div>
    </fieldset>
  );
}

function Preview({ appearance, onRandom }: { appearance: Appearance; onRandom: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dir, setDir] = useState<Direction>("down");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), FRAME_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      paintCharacter(canvasRef.current, appearance, dir, WALK_COLUMNS[tick % WALK_COLUMNS.length], 8);
    }
  }, [appearance, dir, tick]);

  const rotate = (step: number) =>
    setDir((d) => ROTATION[(ROTATION.indexOf(d) + step + ROTATION.length) % ROTATION.length]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex aspect-square w-full max-w-[220px] items-center justify-center rounded-lg border-4 border-[#5a6080] bg-[#dcae72] bg-[repeating-linear-gradient(0deg,#ecc690_0_2px,#dcae72_2px_14px,#b07c46_14px_16px)] shadow-inner">
        <canvas
          ref={canvasRef}
          width={128}
          height={128}
          role="img"
          aria-label={`Prévia do personagem olhando para ${DIRECTION_LABEL[dir]}`}
          className="h-40 w-40 [image-rendering:pixelated]"
        />
      </div>
      <div className="flex w-full max-w-[220px] gap-2">
        <IconButton label="Girar para a esquerda" onClick={() => rotate(-1)}>
          ⟲
        </IconButton>
        <button
          type="button"
          onClick={onRandom}
          className="flex-1 rounded border border-grape-700 px-3 py-1.5 text-sm font-medium text-grape-200 hover:border-aqua-500 hover:text-white"
        >
          🎲 Aleatório
        </button>
        <IconButton label="Girar para a direita" onClick={() => rotate(1)}>
          ⟳
        </IconButton>
      </div>
    </div>
  );
}

const DIRECTION_LABEL: Record<Direction, string> = {
  down: "baixo",
  up: "cima",
  left: "a esquerda",
  right: "a direita",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-grape-400">{label}</span>
      {children}
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-grape-700 text-lg text-grape-200 hover:border-aqua-500 hover:text-white"
    >
      {children}
    </button>
  );
}

/** Seletor "‹ opção ›" que dá a volta nas pontas. */
function Stepper({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: number;
  onChange: (value: number) => void;
}) {
  const step = (d: number) => onChange((value + d + options.length) % options.length);
  return (
    <div className="flex items-center gap-2">
      <IconButton label={`${label}: anterior`} onClick={() => step(-1)}>
        ‹
      </IconButton>
      <output aria-live="polite" aria-label={label} className="flex-1 rounded bg-grape-950 px-3 py-1.5 text-center text-sm text-grape-100">
        {options[value]}
        <span className="ml-2 text-xs text-grape-500">
          {value + 1}/{options.length}
        </span>
      </output>
      <IconButton label={`${label}: próximo`} onClick={() => step(1)}>
        ›
      </IconButton>
    </div>
  );
}

function Swatches({
  label,
  colors,
  value,
  onChange,
}: {
  label: string;
  colors: readonly NamedColor[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {colors.map((c, i) => (
        <button
          key={c.label}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={c.label}
          title={c.label}
          onClick={() => onChange(i)}
          className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
            value === i ? "border-white ring-2 ring-aqua-500" : "border-black/40"
          }`}
          style={{ backgroundColor: cssColor(c.color) }}
        />
      ))}
    </div>
  );
}
