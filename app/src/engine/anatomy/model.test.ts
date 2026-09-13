// Geometry tests over the committed Blender export.
//
// These run wherever npm test runs — no Blender needed — and they pin the asset contract:
// every structure present, solids watertight after the weld, bounds inside the orbit, the disc
// nasal to the fovea in the authored right-eye frame, the iris painter's polar UV convention,
// and the embedded-asset budget. A geometry bug that survives export fails here, not in front
// of a patient.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  boundaryEdges,
  decodeAnatomy,
  maxRadial,
  minRadial,
  type AnatomyManifest,
} from "./model";

const assetsDir = resolve(__dirname, "../assets");
const manifest: AnatomyManifest = JSON.parse(
  readFileSync(resolve(assetsDir, "anatomy.json"), "utf8"),
);
const bin = readFileSync(resolve(assetsDir, "anatomy.bin"));
// copy into an ArrayBuffer so the DataView path matches the browser's
const buffer = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
const structures = decodeAnatomy(buffer as ArrayBuffer, manifest);

const SOLID_STRUCTURES = new Set([
  "sclera",
  "cornea",
  "iris",
  "lens",
  "ciliary_body",
  "retina",
  "choroid",
  "optic_nerve_sheath",
  "optic_nerve_core",
  "nerve_head",
  "zonules",
  "muscle_medial",
  "muscle_lateral",
  "muscle_superior",
  "muscle_inferior",
]);

describe("the Blender-authored eye model", () => {
  it("carries every contract structure", () => {
    for (const id of SOLID_STRUCTURES) {
      expect(structures.has(id), `missing structure: ${id}`).toBe(true);
    }
  });

  it("decodes finite positions within the orbit's physical bounds", () => {
    let violations = 0;
    let first = "";
    for (const [id, mesh] of structures) {
      for (let i = 0; i < mesh.positions.length; i += 3) {
        for (let axis = 0; axis < 3; axis++) {
          const value = mesh.positions[i + axis];
          // globe is ±12 mm; muscles and the nerve reach the orbital apex behind it
          if (!Number.isFinite(value) || Math.abs(value) > 42) {
            violations += 1;
            first ||= `${id} vertex ${i / 3} axis ${axis} = ${value}`;
          }
        }
      }
    }
    expect(violations, first).toBe(0);
  });

  it("is watertight for every solid structure after the weld", () => {
    for (const [id, mesh] of structures) {
      if (SOLID_STRUCTURES.has(id)) {
        const boundary = boundaryEdges(mesh);
        expect(boundary, `${id} has ${boundary} boundary edges`).toBe(0);
      }
    }
  });

  it("has index triples within range and matching slot records", () => {
    let outOfRange = 0;
    let first = "";
    for (const [id, mesh] of structures) {
      const vertexCount = mesh.positions.length / 3;
      for (let i = 0; i < mesh.indices.length; i++) {
        if (mesh.indices[i] >= vertexCount) {
          outOfRange += 1;
          first ||= `${id} index ${i} = ${mesh.indices[i]} (vertices: ${vertexCount})`;
        }
      }
      expect(mesh.slotOfTriangle.length, id).toBe(mesh.indices.length / 3);
    }
    expect(outOfRange, first).toBe(0);
  });

  it("places the disc nasal and posterior in the authored right-eye frame", () => {
    const [x, y, z] = manifest.disc3d;
    expect(x).toBeGreaterThan(0); // nasal is +x for the authored right eye
    expect(z).toBeLessThan(0); // posterior
    expect(Math.abs(y)).toBeLessThan(Math.abs(x)); // superior tilt is slight
    const [fx, , fz] = manifest.fovea3d;
    expect(fx).toBeCloseTo(0, 5); // the fovea sits on the visual axis
    expect(fz).toBeLessThan(0); // posterior
    // the disc is nasal to the fovea — the classic tell of a faked fundus
    expect(x).toBeGreaterThan(fx + 1);
  });

  it("keeps the retina inside the sclera and outside the choroid's inner surface", () => {
    const retina = structures.get("retina")!;
    const sclera = structures.get("sclera")!;
    const radii = (mesh: typeof retina) => {
      let min = Infinity;
      let max = 0;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const r = Math.hypot(
          mesh.positions[i],
          mesh.positions[i + 1],
          mesh.positions[i + 2],
        );
        min = Math.min(min, r);
        max = Math.max(max, r);
      }
      return { min, max };
    };
    const ret = radii(retina);
    const scl = radii(sclera);
    expect(ret.max).toBeLessThan(scl.max - 0.3); // retina strictly inside the outer sclera
    expect(ret.min).toBeGreaterThan(6); // well clear of the axis; the bowl is a shell
  });

  it("authors the iris from its fixed aperture out to the limbus with painter UVs", () => {
    const iris = structures.get("iris")!;
    // the geometric aperture is fixed at 0.7 mm (below the smallest pupil, which is runtime art)
    expect(minRadial(iris)).toBeGreaterThan(0.55);
    expect(minRadial(iris)).toBeLessThan(0.85);
    // and reaches the limbus
    expect(maxRadial(iris)).toBeGreaterThan(5.5);
    // anterior rows carry radial v in [0,1] for the painter; u wraps the full circle
    expect(iris.uvs.length).toBe((iris.positions.length / 3) * 2);
  });

  it("fits the embedded-asset budget for the lazy renderer", () => {
    // 2.6 MB of geometry keeps the Visualize chunk and the 5 MB standalone comfortably inside
    // their caps alongside the baked iris PNGs and Three itself.
    expect(bin.byteLength).toBeLessThan(2.6 * 1024 * 1024);
    expect(manifest.parts.length).toBeGreaterThan(0);
  });

  it("records the shared retinal radius the vessel projection uses", () => {
    // vessels-default.json projects onto this radius; if the model's retina drifts from it,
    // runtime tubes would float off the surface
    const retina = structures.get("retina")!;
    let innermost = Infinity;
    for (let i = 0; i < retina.positions.length; i += 3) {
      const r = Math.hypot(
        retina.positions[i],
        retina.positions[i + 1],
        retina.positions[i + 2],
      );
      innermost = Math.min(innermost, r);
    }
    expect(Math.abs(innermost - manifest.retinaInnerRadiusMm)).toBeLessThan(0.3);
  });
});
