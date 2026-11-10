"use client";

import { useEffect, useRef } from "react";
import { renderCharacterFrame, type Direction } from "@/game/characters/characterArt";
import { TILE_SIZE } from "@/game/constants";
import { renderTileset } from "@/game/graphics/tileArt";
import type { RgbaImage } from "@/game/graphics/pixelArt";
import { createOfficeLayout, type Grid } from "@/game/maps/officeLayout";
import { computeSeats } from "@/game/maps/seats";
import { randomAppearance, type Appearance } from "@/shared/appearance";

/** Colunas do sheet: andar (3–6) e sentado (7). */
const WALK_COLUMNS = [3, 4, 5, 6];
const SIT_COLUMN = 7;
const CHAR_SCALE = 2;
const CHAR_SIZE = 16 * CHAR_SCALE;
const WALK_SPEED = 38; // px/s
const FRAME_MS = 150;

/** Gerador pseudoaleatório com semente: a cena é sempre a mesma (e igual no SSR). */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toCanvas(image: RgbaImage): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  return canvas;
}

/** Mapa estático (chão, paredes e móveis) num canvas. */
function paintMap(): HTMLCanvasElement {
  const layout = createOfficeLayout();
  const tiles = toCanvas(renderTileset());
  const canvas = document.createElement("canvas");
  canvas.width = layout.width * TILE_SIZE;
  canvas.height = layout.height * TILE_SIZE;
  const ctx = canvas.getContext("2d")!;
  const drawLayer = (grid: Grid) =>
    grid.forEach((row, y) =>
      row.forEach((gid, x) => {
        if (gid === 0) return;
        ctx.drawImage(tiles, (gid - 1) * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }),
    );
  drawLayer(layout.ground);
  drawLayer(layout.walls);
  drawLayer(layout.objects);
  return canvas;
}

interface Sitter {
  kind: "sit";
  x: number;
  y: number;
  image: HTMLCanvasElement;
}

interface Walker {
  kind: "walk";
  x: number;
  y: number;
  minX: number;
  maxX: number;
  dir: 1 | -1;
  frames: Record<"left" | "right", HTMLCanvasElement[]>;
}

type Actor = Sitter | Walker;

/** Gente no escritório: alguns sentados nas mesas, outros andando pelos corredores. */
function populate(random: () => number): Actor[] {
  const layout = createOfficeLayout();
  const seats = computeSeats(layout);
  const frame = (a: Appearance, dir: Direction, col: number) => toCanvas(renderCharacterFrame(a, dir, col, CHAR_SCALE));
  const actors: Actor[] = [];

  // Senta uma pessoa em mais ou menos metade das cadeiras.
  for (const seat of seats) {
    if (random() > 0.55) continue;
    const a = randomAppearance(random);
    actors.push({
      kind: "sit",
      x: seat.x,
      y: seat.y - 4,
      image: frame(a, seat.facing, SIT_COLUMN),
    });
  }

  // Corredores livres (linhas sem colisão) por onde as pessoas andam.
  const corridors: Array<{ row: number; from: number; to: number }> = [
    { row: 7, from: 2, to: 16 },
    { row: 12, from: 2, to: 16 },
    { row: 15, from: 16, to: 27 },
    { row: 10, from: 20, to: 27 },
  ];
  for (const c of corridors) {
    const free = (x: number) => layout.collisions[c.row]?.[x] === 0;
    if (!free(c.from) || !free(c.to)) continue;
    const a = randomAppearance(random);
    const minX = c.from * TILE_SIZE + TILE_SIZE / 2;
    const maxX = c.to * TILE_SIZE + TILE_SIZE / 2;
    actors.push({
      kind: "walk",
      x: minX + random() * (maxX - minX),
      y: c.row * TILE_SIZE + TILE_SIZE / 2,
      minX,
      maxX,
      dir: random() < 0.5 ? 1 : -1,
      frames: {
        left: WALK_COLUMNS.map((col) => frame(a, "left", col)),
        right: WALK_COLUMNS.map((col) => frame(a, "right", col)),
      },
    });
  }
  return actors;
}

/**
 * O escritório do Lero em pixel art, desenhado com a mesma arte do jogo (sem Phaser).
 * Decorativo: usado como ilustração nas telas de login e cadastro.
 */
export function OfficeScene({ className = "", animated = true }: { className?: string; animated?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const map = paintMap();
    canvas.width = map.width;
    canvas.height = map.height;
    ctx.imageSmoothingEnabled = false;
    const actors = populate(seeded(20240611));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const moving = animated && !reduced;

    let raf = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      ctx.drawImage(map, 0, 0);
      // De cima para baixo, para quem está mais embaixo ficar na frente.
      const sorted = [...actors].sort((a, b) => a.y - b.y);
      for (const actor of sorted) {
        let image: HTMLCanvasElement;
        if (actor.kind === "sit") {
          image = actor.image;
        } else {
          if (moving) {
            actor.x += actor.dir * WALK_SPEED * dt;
            if (actor.x > actor.maxX || actor.x < actor.minX) {
              actor.x = Math.max(actor.minX, Math.min(actor.maxX, actor.x));
              actor.dir = actor.dir === 1 ? -1 : 1;
            }
          }
          const frames = actor.frames[actor.dir === 1 ? "right" : "left"];
          image = moving ? frames[Math.floor(now / FRAME_MS) % frames.length] : frames[1];
        }
        ctx.drawImage(image, Math.round(actor.x - CHAR_SIZE / 2), Math.round(actor.y - CHAR_SIZE / 2 - 6));
      }
      if (moving) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [animated]);

  return <canvas ref={ref} aria-hidden className={`[image-rendering:pixelated] ${className}`} />;
}
