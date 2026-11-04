/**
 * Mini motor de pixel art (puro, sem Phaser): desenha numa grade de "pixels
 * virtuais", aplica contorno no estilo GBA e converte para RGBA ampliado.
 * Usado para gerar o tileset e os personagens sem arquivos de imagem.
 */

const EMPTY = -1;

/** Cor escura usada como base dos contornos (azul-marinho quase preto). */
export const OUTLINE_BASE = 0x181828;

export function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
}

export const darken = (c: number, t: number) => mix(c, 0x000000, t);
export const lighten = (c: number, t: number) => mix(c, 0xffffff, t);

export type Palette = Record<string, number>;

export class PixelCanvas {
  /** Cor 0xRRGGBB por pixel, ou -1 se vazio. */
  readonly color: Int32Array;
  readonly alpha: Uint8Array;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.color = new Int32Array(width * height).fill(EMPTY);
    this.alpha = new Uint8Array(width * height);
  }

  private inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isSolid(x: number, y: number): boolean {
    if (!this.inside(x, y)) return false;
    const i = y * this.width + x;
    return this.color[i] !== EMPTY && this.alpha[i] === 255;
  }

  get(x: number, y: number): number {
    return this.inside(x, y) ? this.color[y * this.width + x] : EMPTY;
  }

  set(x: number, y: number, color: number, alpha = 255): this {
    if (!this.inside(x, y)) return this;
    const i = y * this.width + x;
    this.color[i] = color;
    this.alpha[i] = alpha;
    return this;
  }

  clear(x: number, y: number): this {
    if (this.inside(x, y)) this.color[y * this.width + x] = EMPTY;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, color: number): this {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) this.set(col, row, color);
    }
    return this;
  }

  /** Preenche cada pixel com a cor devolvida por `fn` (null = não mexe). */
  paint(fn: (x: number, y: number) => number | null): this {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const c = fn(x, y);
        if (c !== null) this.set(x, y, c);
      }
    }
    return this;
  }

  /**
   * Desenha arte em texto: cada caractere é uma chave da paleta.
   * `.` e espaço são transparentes. `mirror` espelha na horizontal.
   */
  ascii(ox: number, oy: number, rows: readonly string[], palette: Palette, mirror = false): this {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const key = row[x];
        if (key === "." || key === " ") continue;
        const color = palette[key];
        if (color === undefined) throw new Error(`Cor "${key}" ausente na paleta`);
        const px = mirror ? this.width - 1 - (ox + x) : ox + x;
        this.set(px, oy + y, color);
      }
    });
    return this;
  }

  /**
   * Contorno seletivo (estilo GBA): pixels vazios vizinhos (4 direções) de um
   * pixel sólido recebem uma versão bem escura da cor vizinha.
   */
  outline(strength = 0.72): this {
    const marks: Array<[number, number, number]> = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.get(x, y) !== EMPTY) continue;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          if (this.isSolid(x + dx, y + dy)) {
            marks.push([x, y, mix(this.get(x + dx, y + dy), OUTLINE_BASE, strength)]);
            break;
          }
        }
      }
    }
    for (const [x, y, c] of marks) this.set(x, y, c);
    return this;
  }

  /** Sombra suave no chão: só ocupa pixels ainda vazios. */
  shadow(cx: number, cy: number, rx: number, ry: number, alpha = 70): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1 && this.get(x, y) === EMPTY) this.set(x, y, 0x101018, alpha);
      }
    }
    return this;
  }

  /** Copia ampliada (`scale`×) para um buffer RGBA de largura `stride` px. */
  blit(out: Uint8ClampedArray, stride: number, ox: number, oy: number, scale: number): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = y * this.width + x;
        const c = this.color[i];
        if (c === EMPTY) continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const o = ((oy + y * scale + sy) * stride + ox + x * scale + sx) * 4;
            out[o] = (c >> 16) & 0xff;
            out[o + 1] = (c >> 8) & 0xff;
            out[o + 2] = c & 0xff;
            out[o + 3] = this.alpha[i];
          }
        }
      }
    }
  }
}

/** Imagem RGBA simples (independente do navegador). */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export function createImage(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}
