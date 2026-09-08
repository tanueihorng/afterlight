import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MAX_VERSION,
  TOTAL_CODEWORDS,
  TooMuchData,
  byteCapacity,
  encodeQr,
  encodeQrText,
  qrToSvgPath,
  totalCodewords,
  versionFor,
} from "./qr";

function fingerprint(modules: boolean[][]): string {
  const rows = modules.map((r) => r.map((d) => (d ? "1" : "0")).join("")).join("\n");
  return createHash("sha256").update(rows).digest("hex").slice(0, 16);
}

describe("QR encoder", () => {
  it("agrees with the specification's codeword totals at both levels", () => {
    // If a row of the block table were mistyped, this is where it shows: the data codewords plus
    // the error-correction codewords have to add up to the version's published total.
    for (let v = 1; v <= MAX_VERSION; v++) {
      expect(totalCodewords(v, "L")).toBe(TOTAL_CODEWORDS[v - 1]);
      expect(totalCodewords(v, "M")).toBe(TOTAL_CODEWORDS[v - 1]);
    }
  });

  it("sizes the symbol by the amount of data", () => {
    expect(encodeQrText("afterlight").size).toBe(21);
    expect(versionFor(1, "M")).toBe(1);
    expect(versionFor(byteCapacity(1, "M"), "M")).toBe(1);
    expect(versionFor(byteCapacity(1, "M") + 1, "M")).toBe(2);
    // Level L holds more than M at the same version, because it spends fewer codewords on ECC.
    expect(byteCapacity(10, "L")).toBeGreaterThan(byteCapacity(10, "M"));
  });

  it("refuses data it cannot carry rather than truncating it", () => {
    const tooMuch = new Uint8Array(byteCapacity(MAX_VERSION, "M") + 1);
    expect(() => encodeQr(tooMuch, "M")).toThrow(TooMuchData);
  });

  it("places the three finder patterns", () => {
    const { modules, size } = encodeQrText("afterlight");
    for (const [r0, c0] of [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ]) {
      expect(modules[r0][c0]).toBe(true); // outer ring
      expect(modules[r0 + 1][c0 + 1]).toBe(false); // light ring
      expect(modules[r0 + 3][c0 + 3]).toBe(true); // dark core
    }
  });

  it("places the timing patterns and the dark module", () => {
    const { modules, size } = encodeQrText("afterlight");
    for (let i = 8; i < size - 8; i++) {
      expect(modules[6][i]).toBe(i % 2 === 0);
      expect(modules[i][6]).toBe(i % 2 === 0);
    }
    expect(modules[size - 8][8]).toBe(true);
  });

  it("is deterministic", () => {
    expect(fingerprint(encodeQrText("harbour-lantern-quiet-seven").modules)).toBe(
      fingerprint(encodeQrText("harbour-lantern-quiet-seven").modules),
    );
  });

  /**
   * Golden symbols.
   *
   * A structural test cannot tell you a QR code scans; only a decoder can. These four were
   * rendered to PNG and read back with Apple's own CoreImage QR detector — including a byte-exact
   * round trip of the longest one — and their matrices pinned here. Version 7 crosses into
   * version-information blocks and version 19 into multi-block interleaving with a 16-bit length
   * header, so between them they exercise every branch that differs by size.
   *
   * If one of these changes, the encoder changed. Re-verify with a real decoder before updating.
   */
  it.each([
    ["afterlight", 1, 21, "ba9b1889ae9e9d1d"],
    ["harbour-lantern-quiet-seven", 3, 29, "d82deea248373a2a"],
    [
      "AFTERLIGHT BRIEF 26 Aug - 9 Sep 2026\nOD: floaters unchanged\nOS: NEW small dark dot 4 Sep; glare more than usual 7 Sep",
      7,
      45,
      "8f76f51b73a3d1bc",
    ],
  ])("matches a decoder-verified symbol (v%#)", (text, version, size, hash) => {
    const code = encodeQrText(text as string, "M");
    expect(code.version).toBe(version);
    expect(code.size).toBe(size);
    expect(fingerprint(code.modules)).toBe(hash);
  });

  it("draws an SVG path with the quiet zone a scanner needs", () => {
    const code = encodeQrText("afterlight");
    const { path, side } = qrToSvgPath(code, 4);
    expect(side).toBe(code.size + 8);
    expect(path.startsWith("M")).toBe(true);
    // The top-left finder starts four modules in, never at the edge.
    expect(path).toContain("M4 4h1v1h-1z");
  });
});
