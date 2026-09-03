/**
 * A minimal QR encoder, drawn in-process.
 *
 * Deliberately not a QR web service or a remote chart API: rendering a pairing
 * secret through somebody else's server would hand them the secret on the way to
 * drawing it. No network call belongs anywhere in this flow.
 *
 * Byte mode, error-correction level L, smallest version that fits. That covers
 * an `otpauth://` URI comfortably and keeps the module count low enough to stay
 * scannable at the sizes this surface renders.
 */

const ALIGNMENT: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

/** Capacity in bytes for level L, versions 1-10. */
const CAPACITY_L = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255];
})();

const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]);

function generatorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= gfMul(poly[j], GF_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function errorCorrection(data: number[], count: number): number[] {
  const poly = generatorPoly(count);
  const remainder = new Array(count).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < count; i += 1) remainder[i] ^= gfMul(poly[i + 1], factor);
  }
  return remainder;
}

/** Error-correction codeword count for level L, versions 1-10. */
const EC_L = [7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
/** Total data codewords for level L, versions 1-10 (single block for 1-5). */
const DATA_L = [19, 34, 55, 80, 108, 136, 156, 194, 232, 274];

export type QrMatrix = { size: number; modules: boolean[][] };

/**
 * Encode a string. Returns null when it does not fit the supported versions,
 * so the caller can say so rather than render a corrupt code.
 */
export function encodeQr(text: string): QrMatrix | null {
  const bytes = [...new TextEncoder().encode(text)];
  const version = CAPACITY_L.findIndex((capacity) => bytes.length <= capacity) + 1;
  if (version === 0 || version > 5) return null; // versions 6+ use multiple blocks

  const size = 17 + version * 4;
  const totalData = DATA_L[version - 1];
  const ecCount = EC_L[version - 1];

  // Byte mode, 8-bit count for versions 1-9.
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, totalData * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  const padding = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < totalData) codewords.push(padding[padIndex++ % 2]);

  const full = [...codewords, ...errorCorrection(codewords, ecCount)];

  // ---- Matrix ------------------------------------------------------------
  const modules: (boolean | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null));

  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = row + r, cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const ring = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        modules[rr][cc] = inner && (ring || core);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    modules[6][i] = i % 2 === 0;
    modules[i][6] = i % 2 === 0;
  }

  for (const r of ALIGNMENT[version] ?? []) {
    for (const c of ALIGNMENT[version] ?? []) {
      if (modules[r]?.[c] !== null) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          modules[r + dr][c + dc] = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
        }
      }
    }
  }

  modules[size - 8][8] = true; // dark module

  // Reserve format areas.
  for (let i = 0; i < 9; i += 1) {
    if (modules[8][i] === null) modules[8][i] = false;
    if (modules[i][8] === null) modules[i][8] = false;
  }
  for (let i = 0; i < 8; i += 1) {
    if (modules[8][size - 1 - i] === null) modules[8][size - 1 - i] = false;
    if (modules[size - 1 - i][8] === null) modules[size - 1 - i][8] = false;
  }

  // ---- Place data, mask 0 -------------------------------------------------
  let bitIndex = 0;
  const dataBits = full.flatMap((byte) => [7, 6, 5, 4, 3, 2, 1, 0].map((i) => (byte >> i) & 1));
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const c of [col, col - 1]) {
        if (modules[row][c] !== null) continue;
        const bit = bitIndex < dataBits.length ? dataBits[bitIndex++] : 0;
        // Mask 0: (row + column) mod 2 === 0.
        modules[row][c] = ((row + c) % 2 === 0 ? bit ^ 1 : bit) === 1;
      }
    }
    upward = !upward;
  }

  // ---- Format information for level L, mask 0 -----------------------------
  const FORMAT_L0 = 0b111011111000100;
  const formatBits = [...Array(15).keys()].map((i) => ((FORMAT_L0 >> (14 - i)) & 1) === 1);
  for (let i = 0; i < 6; i += 1) modules[8][i] = formatBits[i];
  modules[8][7] = formatBits[6];
  modules[8][8] = formatBits[7];
  modules[7][8] = formatBits[8];
  for (let i = 9; i < 15; i += 1) modules[14 - i][8] = formatBits[i];
  for (let i = 0; i < 8; i += 1) modules[size - 1 - i][8] = formatBits[i];
  for (let i = 8; i < 15; i += 1) modules[8][size - 15 + i] = formatBits[i];

  return { size, modules: modules.map((row) => row.map((cell) => cell === true)) };
}

/** The standard pairing URI an authenticator expects. */
export function otpauthUri({
  issuer, account, secret, algorithm = 'SHA1', digits = 6, period = 30,
}: {
  issuer: string; account: string; secret: string;
  algorithm?: string; digits?: number; period?: number;
}): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret, issuer, algorithm, digits: String(digits), period: String(period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
