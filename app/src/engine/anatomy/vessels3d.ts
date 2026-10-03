// Retinal vessels as geometry: the seeded tree conformed to the inner retinal surface.
//
// The fundus painter draws vessels into a texture for the ophthalmoscopic view; the cutaway
// needs them as real tubes sitting on the concave retina, visually connected to the disc. The
// tree is grown by the existing vessels.ts (so severity parameters keep working) and mapped
// through the same projection the retina's UVs sample — a vessel in the texture and its tube
// are the same vessel.

import { EYE, mm } from "./dimensions";
import { fundusLayout, type FundusParams } from "./fundus";
import type { VesselSegment } from "./vessels";

export interface VesselTubeParams {
  /** Overall tube calibre multiplier (severity). */
  calibre: number;
  /** Tessellation by quality tier. */
  radialSegments: number;
  /** Laterality: the tree is grown for a right eye; a left eye mirrors x. */
  eye: "right" | "left";
  /** Generations deep enough to still be tubes; finer generations stay in the painted fundus. */
  maxDepth?: number;
}

const DEFAULT_FAV_RADIUS = 0.045;

export interface VesselTubeMesh {
  positions: Float32Array;
  normals: Float32Array;
  /** 1 for artery, 0 for vein — the material mixes colours from this. */
  kind: Float32Array;
  indices: Uint32Array;
}

/** Radius of the inner retinal surface in scene units, matching the model export. */
export function retinaInnerRadius(): number {
  return mm(
    EYE.axialLength / 2 -
      EYE.sclera.thicknessPosterior -
      EYE.choroid.thickness * 3 -
      EYE.retina.thickness,
  );
}

/**
 * Catmull-Rom resampling of a tree polyline: the grown tree turns at 14 coarse points, which
 * reads as sharp elbows once extruded into tubes. Smoothing in normalised coordinates keeps
 * the tube aligned with the painted vessel beneath it.
 */
function smooth(points: { x: number; y: number }[], factor = 3): { x: number; y: number }[] {
  if (points.length < 3) return points;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let t = 0; t < factor; t++) {
      const s = t / factor;
      const s2 = s * s;
      const s3 = s2 * s;
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * s + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * s + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/**
 * Map a normalised fundus coordinate (canvas convention) onto the inner retinal hemisphere,
 * identical to the exporter's projection and to what the painter's UVs sample through.
 */
export function fundusTo3D(fx: number, fy: number, radius: number): [number, number, number] {
  const x = (2 * fx - 1) * radius;
  const y = (2 * (1 - fy) - 1) * radius;
  const z = -Math.sqrt(Math.max(0, radius * radius - x * x - y * y));
  return [x, y, z];
}

/**
 * Build the vessel tubes. `layout` comes from `fundusLayout(params)` so condition changes flow
 * through unchanged; callers pass the layout they already use for the texture.
 */
export function buildVesselTubes(
  layout: ReturnType<typeof fundusLayout>,
  params: VesselTubeParams,
): VesselTubeMesh {
  const radius = retinaInnerRadius();
  // sit just proud of the surface (≈0.3 mm): high enough to read as tubes, low enough to align
  // with the painted vessels beneath rather than double-image them
  const lift = 0.018 + 0.008;
  const positions: number[] = [];
  const kinds: number[] = [];
  const indices: number[] = [];

  const maxDepth = params.maxDepth ?? 3;
  // Segments crowding the fovea stay in the painted fundus only: as tubes they are thinner
  // than their own specular width at that scale and read as a knot next to the reflex. The
  // trunks and arcade branches — the part that must read as geometry — stay.
  // 4.5 FAV radii: within this the painted fundus carries the vessels alone. Tubes this close
  // to the fovea are thinner than their own specular width at that scale and read as a knot.
  const keepOut = DEFAULT_FAV_RADIUS * 4.5;
  for (const segment of layout.segments) {
    if (segment.depth > maxDepth) continue;
    const nearest = Math.min(
      ...segment.points.map((pt) => Math.hypot(pt.x - 0.5, pt.y - 0.5)),
    );
    if (nearest < keepOut) continue;
    if (segment.depth > 2) continue; // finer branches stay in the painted fundus
    appendTube(segment, params, radius, lift, positions, kinds, indices);
  }

  const mesh: VesselTubeMesh = {
    positions: new Float32Array(positions),
    normals: new Float32Array(positions.length),
    kind: new Float32Array(kinds),
    indices: new Uint32Array(indices),
  };
  computeNormals(mesh);
  return mesh;
}

function appendTube(
  segment: VesselSegment,
  params: VesselTubeParams,
  radius: number,
  lift: number,
  positions: number[],
  kinds: number[],
  indices: number[],
): void {
  const pts = smooth(segment.points);
  if (pts.length < 2) return;
  const sides = params.radialSegments;
  const baseRadius = Math.max(0.012, (segment.width * 14) / 2);
  const kindValue = segment.kind === "artery" ? 1 : 0;
  const ringStart = positions.length / 3;

  // path frames: tangent + a reference up that avoids degeneracy near the posterior pole
  const rings: [number, number, number][][] = [];
  for (let j = 0; j < pts.length; j++) {
    const [x, y, z] = fundusTo3D(pts[j].x, pts[j].y, radius);
    // radial direction (from globe centre) lifts the tube off the surface
    const len = Math.hypot(x, y, z) || 1;
    const radial: [number, number, number] = [x / len, y / len, z / len];
    const prev = pts[Math.max(0, j - 1)];
    const next = pts[Math.min(pts.length - 1, j + 1)];
    const [px, py, pz] = fundusTo3D(prev.x, prev.y, radius);
    const [nx, ny, nz] = fundusTo3D(next.x, next.y, radius);
    let tx = nx - px;
    let ty = ny - py;
    let tz = nz - pz;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    // side = radial × tangent
    let sx = radial[1] * tz - radial[2] * ty;
    let sy = radial[2] * tx - radial[0] * tz;
    let sz = radial[0] * ty - radial[1] * tx;
    const sl = Math.hypot(sx, sy, sz) || 1;
    sx /= sl;
    sy /= sl;
    sz /= sl;
    const upx = ty * sz - tz * sy;
    const upy = tz * sx - tx * sz;
    const upz = tx * sy - ty * sx;
    const t = j / (pts.length - 1);
    // taper the last quarter to nothing: tube tips fade out instead of ending with knobs
    const tipFade = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
    const r =
      baseRadius * params.calibre * (1 - 0.55 * t) * (1 - 0.12 * Math.min(1, segment.depth / 4)) * tipFade;
    const height = lift + 0.015 * Math.min(1, segment.depth / 3);
    const ring: [number, number, number][] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const ca = Math.cos(a) * r;
      const sa = Math.sin(a) * r;
      ring.push([
        x + radial[0] * height + sx * ca + upx * sa,
        y + radial[1] * height + sy * ca + upy * sa,
        z + radial[2] * height + sz * ca + upz * sa,
      ]);
    }
    rings.push(ring);
  }

  for (const ring of rings) {
    for (const [x, y, z] of ring) {
      positions.push(x, y, z);
      kinds.push(kindValue);
    }
  }
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < sides; i++) {
      const i2 = (i + 1) % sides;
      const a = ringStart + j * sides + i;
      const b = ringStart + j * sides + i2;
      const c = ringStart + (j + 1) * sides + i2;
      const d = ringStart + (j + 1) * sides + i;
      indices.push(a, b, d, b, c, d);
    }
  }
}

/** Area-weighted vertex normals for the tube mesh (no Three dependency). */
function computeNormals(mesh: VesselTubeMesh): void {
  const { positions, normals, indices } = mesh;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const e1x = positions[b] - positions[a];
    const e1y = positions[b + 1] - positions[a + 1];
    const e1z = positions[b + 2] - positions[a + 2];
    const e2x = positions[c] - positions[a];
    const e2y = positions[c + 1] - positions[a + 1];
    const e2z = positions[c + 2] - positions[a + 2];
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const v of [a, b, c]) {
      normals[v] += nx;
      normals[v + 1] += ny;
      normals[v + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= l;
    normals[i + 1] /= l;
    normals[i + 2] /= l;
  }
}

/** Convenience for the renderer: grow + build in one call. */
export function vesselTubesFor(params: FundusParams, tier: VesselTubeParams): VesselTubeMesh {
  return buildVesselTubes(fundusLayout(params), tier);
}
