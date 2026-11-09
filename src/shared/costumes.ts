/**
 * Fantasias da loja: catálogo compartilhado entre cliente e servidor.
 * A arte fica em src/game/characters/costumeArt.ts.
 */

export const COSTUME_IDS = [
  "flash",
  "batman",
  "majinboo",
  "shrek",
  "gandalf",
  "bomberman",
  "spongebob",
  "neymar",
  "ronaldinho",
] as const;

export type CostumeId = (typeof COSTUME_IDS)[number];

export const isCostumeId = (v: unknown): v is CostumeId => COSTUME_IDS.includes(v as CostumeId);
