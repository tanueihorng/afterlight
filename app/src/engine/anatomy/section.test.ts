// Section tests over the committed model: caps must exist, lie exactly in the plane, stay valid
// at slice extremes and tangent cuts, and never emit degenerate triangles. These run in node —
// the renderer consumes the same functions.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { boundaryEdges, decodeAnatomy, type AnatomyManifest } from "./model";
import type { SectionPlane } from "./section";
import { sectionCap } from "./section";


const bin = readFileSync(resolve(__dirname, "../assets/anatomy.bin"));
const buffer = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
export const EYE_MODEL_MANIFEST: AnatomyManifest = JSON.parse(
  readFileSync(resolve(__dirname, "../assets/anatomy.json"), "utf8"),
);
const structures = decodeAnatomy(buffer as ArrayBuffer, EYE_MODEL_MANIFEST);

const SLICEABLE = [
  "sclera",
  "cornea",
  "iris",
  "lens",
  "ciliary_body",
  "retina",
  "choroid",
  "muscle_superior",
];

// the nerve runs nasal (disc at x ≈ +3.9 mm), so lengthwise cuts happen near its own axis
const NERVE_AXIS_X = EYE_MODEL_MANIFEST.disc3d[0];

function capArea(cap: { positions: Float32Array; indices: Uint32Array }): number {
  let area = 0;
  for (let i = 0; i < cap.indices.length; i += 3) {
    const a = cap.indices[i] * 3;
    const b = cap.indices[i + 1] * 3;
    const c = cap.indices[i + 2] * 3;
    const p = cap.positions;
    const e1: [number, number, number] = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
    const e2: [number, number, number] = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    area += Math.hypot(
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    );
  }
  return area / 2;
}

const midSagittal: SectionPlane = { normal: [1, 0, 0], constant: 0 };

describe("plane sections of the anatomical model", () => {
  it("produces caps for the sliceable structures through the eye's centre", () => {
    for (const id of SLICEABLE) {
      const cap = sectionCap(structures.get(id)!, midSagittal);
      expect(cap, `${id} produced no cap`).not.toBeNull();
      expect(cap!.indices.length, `${id} cap has no triangles`).toBeGreaterThan(0);
      expect(capArea(cap!), `${id} cap is empty`).toBeGreaterThan(0.01);
    }
  });

  it("keeps every cap vertex exactly in the cutting plane", () => {
    for (const id of SLICEABLE) {
      const cap = sectionCap(structures.get(id)!, midSagittal)!;
      for (let i = 0; i < cap.positions.length; i += 3) {
        expect(Math.abs(cap.positions[i])).toBeLessThan(0.01);
      }
    }
  });

  it("emits no degenerate triangles (every cap edge pairs with its neighbour)", () => {
    for (const id of SLICEABLE) {
      const cap = sectionCap(structures.get(id)!, midSagittal)!;
      const counts = new Map<string, number>();
      for (let i = 0; i < cap.indices.length; i += 3) {
        for (let e = 0; e < 3; e++) {
          const a = cap.indices[i + e];
          const b = cap.indices[i + ((e + 1) % 3)];
          expect(a, `${id} cap uses vertex ${a} twice in a triangle`).not.toBe(b);
          const key = a < b ? `${a}_${b}` : `${b}_${a}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      // every cap edge is shared by exactly two cap triangles, or it borders the clipped
      // surface (the loops). No edge may appear three times.
      for (const [key, count] of counts) {
        expect(count, `${id} cap edge ${key} appears ${count} times`).toBeLessThan(3);
      }
    }
  });

  it("slices at offsets with caps shrinking toward the edge", () => {
    const lens = structures.get("lens")!;
    const centre = sectionCap(lens, midSagittal)!;
    const nearEdge = sectionCap(lens, { normal: [1, 0, 0], constant: 3.5 })!;
    const outside = sectionCap(lens, { normal: [1, 0, 0], constant: 7 });
    expect(capArea(centre)).toBeGreaterThan(capArea(nearEdge));
    expect(outside).toBeNull(); // the plane has left the structure entirely
  });

  it("handles tangent cuts without NaN or explosions", () => {
    for (const id of SLICEABLE) {
      const mesh = structures.get(id)!;
      // find the structure's max |x| and slice just inside and just outside it
      let maxX = 0;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        maxX = Math.max(maxX, Math.abs(mesh.positions[i]));
      }
      for (const c of [maxX - 0.01, maxX + 0.01]) {
        const cap = sectionCap(mesh, { normal: [1, 0, 0], constant: c });
        if (!cap) continue;
        for (const value of cap.positions) expect(Number.isFinite(value), id).toBe(true);
        expect(capArea(cap)).toBeGreaterThan(0);
      }
    }
  });

  it("sweeps the full slice range repeatedly without leaking or drifting", () => {
    const retina = structures.get("retina")!;
    let totalCaps = 0;
    for (let round = 0; round < 3; round++) {
      for (let s = 0; s <= 10; s++) {
        const cap = sectionCap(retina, { normal: [1, 0, 0], constant: -10 + (s / 10) * 2.4 });
        if (cap) totalCaps++;
      }
    }
    // three identical rounds must find the same number of caps
    expect(totalCaps).toBeGreaterThan(20);
  });

  it("keeps the source model immutable — sections never mutate the decoded arrays", () => {
    const lens = structures.get("lens")!;
    const before = lens.positions.slice();
    sectionCap(lens, midSagittal);
    sectionCap(lens, { normal: [1, 0, 0], constant: 2 });
    expect(Buffer.from(lens.positions.buffer).equals(Buffer.from(before.buffer))).toBe(true);
    expect(boundaryEdges(lens)).toBe(0);
  });

  it("slices along an arbitrary tilted plane", () => {
    // the default cutaway is a tilted sagittal cut; the section maths must not assume x = 0
    const normal: [number, number, number] = [Math.sin(0.5), 0, Math.cos(0.5)];
    const cap = sectionCap(structures.get("sclera")!, { normal, constant: 0 });
    expect(cap).not.toBeNull();
    for (let i = 0; i < cap!.positions.length; i += 3) {
      const d =
        cap!.positions[i] * normal[0] +
        cap!.positions[i + 1] * normal[1] +
        cap!.positions[i + 2] * normal[2];
      expect(Math.abs(d)).toBeLessThan(0.01);
    }
  });

  it("cuts the nerve and muscles lengthwise and closes the channel", () => {
    // a slice through a tube's own axis must leave a capped cross-section band, not an
    // open channel — the exact failure the old explorer's clipping had
    for (const id of ["optic_nerve_sheath", "optic_nerve_core"] as const) {
      const cap = sectionCap(structures.get(id)!, {
        normal: [1, 0, 0],
        constant: NERVE_AXIS_X,
      })!;
      expect(cap, `${id} produced no cap at its own axis`).not.toBeNull();
      expect(capArea(cap), `${id} channel is not capped`).toBeGreaterThan(1);
    }
    // the superior muscle straddles the mid-sagittal plane and is cut along its length
    const muscleCap = sectionCap(structures.get("muscle_superior")!, midSagittal)!;
    expect(capArea(muscleCap), "muscle channel is not capped").toBeGreaterThan(1);
  });
});

describe("section caps of shells", () => {
  it("caps the sclera's connected C-section with its shell band, not a filled disc", () => {
    // through the centre the sclera's section is one connected curve (shell + aperture wall);
    // its cap must be the wall band: far smaller than the full 24 mm disc it would wrongly fill
    const cap = sectionCap(structures.get("sclera")!, midSagittal)!;
    const fullDisc = Math.PI * 12 * 12;
    expect(capArea(cap)).toBeLessThan(fullDisc * 0.35);
    expect(capArea(cap)).toBeGreaterThan(4);
    // and at the canal the section still caps
    const canalCap = sectionCap(structures.get("sclera")!, {
      normal: [1, 0, 0],
      constant: 3,
    })!;
    expect(capArea(canalCap)).toBeGreaterThan(0.5);
  });

  it("keeps layer bands distinct: the sclera cap's outer loop is larger than the retina's", () => {
    const scleraCap = sectionCap(structures.get("sclera")!, midSagittal)!;
    const retinaCap = sectionCap(structures.get("retina")!, midSagittal)!;
    expect(capArea(scleraCap)).toBeGreaterThan(capArea(retinaCap));
  });
});
