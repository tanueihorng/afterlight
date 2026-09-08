// A QR encoder, written here rather than installed.
//
// The handoff card has to work in a consulting room with no signal, and the guard forbids a
// runtime dependency that could reach the network, so this is byte-mode QR (ISO/IEC 18004)
// implemented directly: versions 1–20 at error-correction levels L and M, which is the range
// between "a passphrase" and "a page of text held up to a camera".
//
// Nothing here is Afterlight-specific — it takes bytes and returns a matrix of booleans.

export type EccLevel = "L" | "M";

export const MAX_VERSION = 20;

/** Total codewords (data + error correction) in each version; a cross-check on the block table. */
export const TOTAL_CODEWORDS = [
  26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
];

/** [ecCodewordsPerBlock, blocksInGroup1, dataPerBlock1, blocksInGroup2, dataPerBlock2]. */
const BLOCKS: Record<EccLevel, number[][]> = {
  L: [
    [7, 1, 19, 0, 0],
    [10, 1, 34, 0, 0],
    [15, 1, 55, 0, 0],
    [20, 1, 80, 0, 0],
    [26, 1, 108, 0, 0],
    [18, 2, 68, 0, 0],
    [20, 2, 78, 0, 0],
    [24, 2, 97, 0, 0],
    [30, 2, 116, 0, 0],
    [18, 2, 68, 2, 69],
    [20, 4, 81, 0, 0],
    [24, 2, 92, 2, 93],
    [26, 4, 107, 0, 0],
    [30, 3, 115, 1, 116],
    [22, 5, 87, 1, 88],
    [24, 5, 98, 1, 99],
    [28, 1, 107, 5, 108],
    [30, 5, 120, 1, 121],
    [28, 3, 113, 4, 114],
    [28, 3, 107, 5, 108],
  ],
  M: [
    [10, 1, 16, 0, 0],
    [16, 1, 28, 0, 0],
    [26, 1, 44, 0, 0],
    [18, 2, 32, 0, 0],
    [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0],
    [18, 4, 31, 0, 0],
    [22, 2, 38, 2, 39],
    [22, 3, 36, 2, 37],
    [26, 4, 43, 1, 44],
    [30, 1, 50, 4, 51],
    [22, 6, 36, 2, 37],
    [22, 8, 37, 1, 38],
    [24, 4, 40, 5, 41],
    [24, 5, 41, 5, 42],
    [28, 7, 45, 3, 46],
    [28, 10, 46, 1, 47],
    [26, 9, 43, 4, 44],
    [26, 3, 44, 11, 45],
    [26, 3, 41, 13, 42],
  ],
};

/** Row/column centres of the alignment patterns, by version. */
const ALIGNMENT: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
];

function remainderBits(version: number): number {
  if (version === 1) return 0;
  if (version <= 6) return 7;
  if (version <= 13) return 0;
  return 3;
}

/** Data codewords available at a version and level. */
export function dataCapacity(version: number, ecc: EccLevel): number {
  const [, g1, d1, g2, d2] = BLOCKS[ecc][version - 1];
  return g1 * d1 + g2 * d2;
}

/** Data + error-correction codewords implied by the block table, for checking it against spec. */
export function totalCodewords(version: number, ecc: EccLevel): number {
  const [ecPerBlock, g1, , g2] = BLOCKS[ecc][version - 1];
  return dataCapacity(version, ecc) + (g1 + g2) * ecPerBlock;
}

/** Bytes that fit in byte mode, after the mode indicator and length header. */
export function byteCapacity(version: number, ecc: EccLevel): number {
  const headerBits = 4 + (version <= 9 ? 8 : 16);
  return Math.floor((dataCapacity(version, ecc) * 8 - headerBits) / 8);
}

export class TooMuchData extends Error {
  constructor(
    readonly bytes: number,
    readonly limit: number,
  ) {
    super(`That is ${bytes} bytes; a QR code at this size holds ${limit}.`);
    this.name = "TooMuchData";
  }
}

/* ------------------------------------------------------- Galois field 256 */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/** Generator polynomial of the given degree. */
function generatorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], 1);
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function eccFor(data: number[], count: number): number[] {
  const gen = generatorPoly(count);
  const remainder = new Array<number>(count).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < count; i++) remainder[i] ^= gfMul(gen[i + 1], factor);
  }
  return remainder;
}

/* ------------------------------------------------------------ bit stream */

class Bits {
  readonly bits: number[] = [];
  push(value: number, length: number) {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
  }
  get length() {
    return this.bits.length;
  }
}

/** The smallest version that holds this many bytes at this level. */
export function versionFor(byteLength: number, ecc: EccLevel): number {
  for (let v = 1; v <= MAX_VERSION; v++) {
    if (byteCapacity(v, ecc) >= byteLength) return v;
  }
  throw new TooMuchData(byteLength, byteCapacity(MAX_VERSION, ecc));
}

function codewords(data: Uint8Array, version: number, ecc: EccLevel): number[] {
  const capacity = dataCapacity(version, ecc);
  const bits = new Bits();
  bits.push(0b0100, 4); // byte mode
  bits.push(data.length, version <= 9 ? 8 : 16);
  for (const byte of data) bits.push(byte, 8);

  const capacityBits = capacity * 8;
  bits.push(0, Math.min(4, capacityBits - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(0, 1);

  const words: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits.bits[i + j];
    words.push(byte);
  }
  const PAD = [0xec, 0x11];
  let p = 0;
  while (words.length < capacity) words.push(PAD[p++ % 2]);

  // Split into blocks, compute ECC for each, then interleave — the interleave is what lets a
  // scanner lose a whole region of the symbol and still recover.
  const [ecPerBlock, g1, d1, g2, d2] = BLOCKS[ecc][version - 1];
  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  let at = 0;
  for (let i = 0; i < g1 + g2; i++) {
    const size = i < g1 ? d1 : d2;
    const block = words.slice(at, at + size);
    at += size;
    dataBlocks.push(block);
    eccBlocks.push(eccFor(block, ecPerBlock));
  }

  const out: number[] = [];
  const maxData = Math.max(d1, d2);
  for (let i = 0; i < maxData; i++) {
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of eccBlocks) out.push(block[i]);
  }
  return out;
}

/* --------------------------------------------------------------- matrix */

type Grid = { size: number; dark: boolean[][]; reserved: boolean[][] };

function blankGrid(size: number): Grid {
  return {
    size,
    dark: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    reserved: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
  };
}

function placeFinder(g: Grid, row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= g.size || cc < 0 || cc >= g.size) continue;
      const inRing =
        (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      g.dark[rr][cc] = inRing || inCore;
      g.reserved[rr][cc] = true;
    }
  }
}

function placeAlignment(g: Grid, version: number) {
  const centres = ALIGNMENT[version - 1];
  for (const r of centres) {
    for (const c of centres) {
      // The three finder corners already own their space.
      if ((r === 6 && c === 6) || (r === 6 && c === g.size - 7) || (r === g.size - 7 && c === 6))
        continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          g.dark[r + dr][c + dc] = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          g.reserved[r + dr][c + dc] = true;
        }
      }
    }
  }
}

function placeTiming(g: Grid) {
  for (let i = 8; i < g.size - 8; i++) {
    const dark = i % 2 === 0;
    g.dark[6][i] = dark;
    g.reserved[6][i] = true;
    g.dark[i][6] = dark;
    g.reserved[i][6] = true;
  }
}

function reserveFormat(g: Grid, version: number) {
  for (let i = 0; i < 9; i++) {
    g.reserved[8][i] = true;
    g.reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    g.reserved[8][g.size - 1 - i] = true;
    g.reserved[g.size - 1 - i][8] = true;
  }
  // The module that is always dark.
  g.dark[g.size - 8][8] = true;
  g.reserved[g.size - 8][8] = true;

  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        g.reserved[i][g.size - 11 + j] = true;
        g.reserved[g.size - 11 + j][i] = true;
      }
    }
  }
}

/** `value` shifted up by the generator's degree, with the BCH remainder filled into the low bits. */
function bch(value: number, generator: number): number {
  const degree = 31 - Math.clz32(generator);
  const shifted = value << degree;
  let remainder = shifted;
  while (31 - Math.clz32(remainder) >= degree) {
    remainder ^= generator << (31 - Math.clz32(remainder) - degree);
  }
  return shifted | remainder;
}

function formatBits(ecc: EccLevel, mask: number): number {
  const level = ecc === "L" ? 0b01 : 0b00;
  const data = (level << 3) | mask;
  return bch(data, 0b101_0011_0111) ^ 0b101_0100_0001_0010;
}

function versionBits(version: number): number {
  return bch(version, 0b1_1111_0010_0101);
}

function writeFormat(g: Grid, ecc: EccLevel, mask: number) {
  const bits = formatBits(ecc, mask);
  const bitAt = (i: number) => ((bits >> i) & 1) === 1;

  // Two copies, so a symbol with one damaged corner still reports its own mask and level.
  for (let i = 0; i <= 5; i++) g.dark[i][8] = bitAt(i);
  g.dark[7][8] = bitAt(6);
  g.dark[8][8] = bitAt(7);
  g.dark[8][7] = bitAt(8);
  for (let i = 9; i < 15; i++) g.dark[8][14 - i] = bitAt(i);

  for (let i = 0; i < 8; i++) g.dark[8][g.size - 1 - i] = bitAt(i);
  for (let i = 8; i < 15; i++) g.dark[g.size - 15 + i][8] = bitAt(i);
}

function writeVersion(g: Grid, version: number) {
  if (version < 7) return;
  const bits = versionBits(version);
  for (let i = 0; i < 18; i++) {
    const bit = ((bits >> i) & 1) === 1;
    const r = Math.floor(i / 3);
    const c = g.size - 11 + (i % 3);
    g.dark[r][c] = bit;
    g.dark[c][r] = bit;
  }
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function placeData(g: Grid, words: number[], version: number) {
  const bits: number[] = [];
  for (const word of words) for (let i = 7; i >= 0; i--) bits.push((word >> i) & 1);
  for (let i = 0; i < remainderBits(version); i++) bits.push(0);

  let index = 0;
  let upward = true;
  for (let right = g.size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5; // the vertical timing column is never a data column
    for (let step = 0; step < g.size; step++) {
      const row = upward ? g.size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (g.reserved[row][col]) continue;
        g.dark[row][col] = index < bits.length && bits[index] === 1;
        index++;
      }
    }
    upward = !upward;
  }
}

function penalty(dark: boolean[][], size: number): number {
  let score = 0;

  const runScore = (line: boolean[]) => {
    let total = 0;
    let run = 1;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) {
        run++;
      } else {
        if (run >= 5) total += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) total += 3 + (run - 5);
    return total;
  };

  for (let r = 0; r < size; r++) score += runScore(dark[r]);
  for (let c = 0; c < size; c++) score += runScore(dark.map((row) => row[c]));

  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = dark[r][c];
      if (v === dark[r][c + 1] && v === dark[r + 1][c] && v === dark[r + 1][c + 1]) score += 3;
    }
  }

  const A = [true, false, true, true, true, false, true, false, false, false, false];
  const B = [false, false, false, false, true, false, true, true, true, false, true];
  const matches = (line: boolean[], at: number, pattern: boolean[]) => {
    for (let i = 0; i < pattern.length; i++) if (line[at + i] !== pattern[i]) return false;
    return true;
  };
  const finderLike = (line: boolean[]) => {
    let total = 0;
    for (let i = 0; i + 11 <= line.length; i++) {
      if (matches(line, i, A) || matches(line, i, B)) total += 40;
    }
    return total;
  };
  for (let r = 0; r < size; r++) score += finderLike(dark[r]);
  for (let c = 0; c < size; c++) score += finderLike(dark.map((row) => row[c]));

  let darkCount = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (dark[r][c]) darkCount++;
  const percent = (darkCount * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

export interface QrCode {
  version: number;
  ecc: EccLevel;
  size: number;
  /** `modules[row][col]` — true is dark. Excludes the quiet zone. */
  modules: boolean[][];
  mask: number;
}

/** Encode bytes as a QR symbol, choosing the smallest version and the best mask. */
export function encodeQr(data: Uint8Array, ecc: EccLevel = "M", minVersion = 1): QrCode {
  const version = Math.max(versionFor(data.length, ecc), minVersion);
  const size = version * 4 + 17;
  const words = codewords(data, version, ecc);

  let best: QrCode | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g = blankGrid(size);
    placeFinder(g, 0, 0);
    placeFinder(g, 0, size - 7);
    placeFinder(g, size - 7, 0);
    placeAlignment(g, version);
    placeTiming(g);
    reserveFormat(g, version);
    writeVersion(g, version);
    placeData(g, words, version);

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!g.reserved[r][c] && MASKS[mask](r, c)) g.dark[r][c] = !g.dark[r][c];
      }
    }
    writeFormat(g, ecc, mask);

    const score = penalty(g.dark, size);
    if (score < bestScore) {
      bestScore = score;
      best = { version, ecc, size, modules: g.dark, mask };
    }
  }
  return best!;
}

/** Encode text as UTF-8 and then as a QR symbol. */
export function encodeQrText(text: string, ecc: EccLevel = "M"): QrCode {
  return encodeQr(new TextEncoder().encode(text), ecc);
}

/**
 * The symbol as an SVG path string plus its viewBox side, including the four-module quiet zone a
 * scanner needs. Rendering is left to the caller so nothing here touches the DOM.
 */
export function qrToSvgPath(code: QrCode, quiet = 4): { path: string; side: number } {
  const parts: string[] = [];
  for (let r = 0; r < code.size; r++) {
    for (let c = 0; c < code.size; c++) {
      if (code.modules[r][c]) parts.push(`M${c + quiet} ${r + quiet}h1v1h-1z`);
    }
  }
  return { path: parts.join(""), side: code.size + quiet * 2 };
}
