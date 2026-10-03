// The 3D vessel tubes must agree with the fundus painter and the model: same tree, same disc,
// avascular zone respected, tubes actually sitting on the retinal surface.

import { describe, expect, it } from "vitest";
import { DEFAULT_FUNDUS, fundusLayout } from "./fundus";
import { buildVesselTubes, fundusTo3D, retinaInnerRadius } from "./vessels3d";
import { violatesFAV } from "./vessels";

describe("the 3D vessel tubes", () => {
  const layout = fundusLayout({ ...DEFAULT_FUNDUS, eye: "right", seed: 1 });
  const mesh = buildVesselTubes(layout, { calibre: 1, radialSegments: 6, eye: "right" });

  it("grows the same tree the painter draws", () => {
    expect(layout.segments.length).toBeGreaterThan(50);
    // one ring of `sides` vertices per tree point, for the generations deep enough to be tubes
    const minVerts = layout.segments
      .filter((seg) => seg.depth <= 2)
      .reduce((sum, s) => sum + s.points.length * 6, 0);
    expect(mesh.positions.length / 3).toBeGreaterThanOrEqual(minVerts);
  });

  it("sits on the inner retinal surface, just lifted", () => {
    const radius = retinaInnerRadius();
    let minDistance = Infinity;
    let maxDistance = 0;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const d = Math.hypot(
        mesh.positions[i],
        mesh.positions[i + 1],
        mesh.positions[i + 2],
      );
      minDistance = Math.min(minDistance, d);
      maxDistance = Math.max(maxDistance, d);
    }
    // tubes hug the surface: their inner side may bed slightly into it, the outer side lifts
    // by at most height plus their own radius
    expect(minDistance).toBeGreaterThan(radius - 0.15);
    expect(maxDistance).toBeLessThan(radius + 0.2);
  });

  it("respects the avascular zone in 3D", () => {
    // the property test exists for the 2D tree; assert the projected tubes too, with the FAV
    // radius converted through the same projection (the painter image spans the hemisphere)
    expect(violatesFAV(layout.segments)).toBe(false);
    const radius = retinaInnerRadius();
    const fovea3d = fundusTo3D(0.5, 0.5, radius);
    const favRadius3d = 0.045 * 2 * radius * 0.9;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const d = Math.hypot(
        mesh.positions[i] - fovea3d[0],
        mesh.positions[i + 1] - fovea3d[1],
        mesh.positions[i + 2] - fovea3d[2],
      );
      expect(d, `tube vertex within the avascular zone at ${d.toFixed(3)}`).toBeGreaterThan(
        favRadius3d,
      );
    }
  });

  it("reaches the disc region — vessels connect visually to the nerve head", () => {
    const disc3d = fundusTo3D(layout.disc.x, layout.disc.y, retinaInnerRadius());
    let closest = Infinity;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const d = Math.hypot(
        mesh.positions[i] - disc3d[0],
        mesh.positions[i + 1] - disc3d[1],
        mesh.positions[i + 2] - disc3d[2],
      );
      closest = Math.min(closest, d);
    }
    expect(closest, "no vessel comes near the disc").toBeLessThan(0.8);
  });

  it("carries both vessel kinds and unit normals", () => {
    expect(mesh.kind.some((k) => k === 1)).toBe(true);
    expect(mesh.kind.some((k) => k === 0)).toBe(true);
    // tube normals point outward from the tube wall: unit length after the accumulator pass
    for (let i = 0; i < mesh.normals.length; i += 3) {
      const l = Math.hypot(mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]);
      expect(Math.abs(l - 1), `normal ${i / 3} has length ${l}`).toBeLessThan(0.01);
    }
  });
});
