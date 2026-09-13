// Thickness-aware sections: cap geometry for a sliced solid.
//
// Clipping planes alone leave hollow open shells — the exact failure the previous explorer had.
// This module computes the plane section of a decoded structure's triangles, chains the crossing
// segments into closed loops, and fills them: a single loop becomes a capped face (a cut muscle
// shows its cross-section), nested loops become the band between them (a cut shell shows the
// wall as an annulus, keeping the sclera/choroid/retina bands distinct). Everything is plain
// typed arrays so it can be tested in node and adapted by either renderer.
//
// All coordinates are eye-local millimetres; the caller supplies the plane in the same frame.

import type { StructureMesh } from "./model";

export interface SectionPlane {
  /** Unit normal; the kept side is where dot(normal, p) >= constant. */
  normal: Vec3;
  constant: number;
}

export type Vec3 = [number, number, number];

function signedArea(loops2D: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < loops2D.length; i++) {
    const [ax, ay] = loops2D[i];
    const [bx, by] = loops2D[(i + 1) % loops2D.length];
    area += ax * by - bx * ay;
  }
  return area / 2;
}

export interface SectionResult {
  loops: Vec3[][];
  min: Vec3;
  max: Vec3;
}

/**
 * The plane section of one structure: crossing segments chained into closed loops. Degenerate
 * loops (tangent grazes, slivers) are dropped.
 */
export function planeSection(mesh: StructureMesh, plane: SectionPlane): SectionResult | null {
  const [nx, ny, nz] = plane.normal;
  const { positions, indices } = mesh;
  const triangles = indices.length / 3;
  const sides = new Float32Array(3);

  // Chains are keyed by mesh edge (vertex-index pair), not by quantised point: the crossing
  // point on a shared edge is identical for both adjacent triangles by construction, so loops
  // close exactly — quantised point keys broke at tangent tips and on-plane vertices.
  const segments: [number, number][] = []; // pairs of edge keys, unordered
  const atNode = new Map<number, number[]>(); // edge key -> segment indices touching it
  const pointOfEdge = new Map<number, Vec3>();
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];

  const edgeKey = (a: number, b: number): number => (a < b ? a * 16777216 + b : b * 16777216 + a);

  const recordEdge = (a: number, b: number, da: number, db: number): number => {
    const key = edgeKey(a, b);
    if (!pointOfEdge.has(key)) {
      const t = Math.max(0, Math.min(1, da / (da - db)));
      const point: Vec3 = [
        positions[a * 3] + (positions[b * 3] - positions[a * 3]) * t,
        positions[a * 3 + 1] + (positions[b * 3 + 1] - positions[a * 3 + 1]) * t,
        positions[a * 3 + 2] + (positions[b * 3 + 2] - positions[a * 3 + 2]) * t,
      ];
      pointOfEdge.set(key, point);
      for (let axis = 0; axis < 3; axis++) {
        if (point[axis] < min[axis]) min[axis] = point[axis];
        if (point[axis] > max[axis]) max[axis] = point[axis];
      }
    }
    return key;
  };

  for (let t = 0; t < triangles; t++) {
    let positive = 0;
    let negative = 0;
    for (let k = 0; k < 3; k++) {
      const vi = indices[t * 3 + k] * 3;
      const s = positions[vi] * nx + positions[vi + 1] * ny + positions[vi + 2] * nz - plane.constant;
      sides[k] = s;
      // Asymmetric classification: vertices within epsilon of the plane count as positive.
      // Grid vertices can sit exactly on the cut (x = 0 runs through mesh columns), and with
      // a symmetric test their triangles contribute a single crossing point, breaking loops.
      // With this rule the crossing collapses onto the shared edge and chains continue.
      if (s > -1e-9) positive++;
      else negative++;
    }
    if (positive === 0 || negative === 0) continue;

    let e1 = -1;
    let e2 = -1;
    for (let k = 0; k < 3; k++) {
      const k2 = (k + 1) % 3;
      const sk = sides[k];
      const sk2 = sides[k2];
      if ((sk >= -1e-9 && sk2 < -1e-9) || (sk < -1e-9 && sk2 >= -1e-9)) {
        const ia = indices[t * 3 + k];
        const ib = indices[t * 3 + k2];
        const key =
          sk >= -1e-9 ? recordEdge(ia, ib, Math.max(sk, 0), sk2) : recordEdge(ib, ia, Math.max(sk2, 0), sk);
        if (e1 < 0) e1 = key;
        else if (e2 < 0) e2 = key;
      }
    }
    if (e1 < 0 || e2 < 0 || e1 === e2) continue;
    const id = segments.length;
    segments.push([e1, e2]);
    for (const node of [e1, e2]) {
      const list = atNode.get(node) ?? [];
      list.push(id);
      atNode.set(node, list);
    }
  }

  // extract loops, orientation-free: each crossing edge sits on exactly two segments (the two
  // triangles beside it), so a walk that never takes the same segment back traces the loop
  const usedSegment = new Set<number>();
  const usedNode = new Set<number>();
  const loops: Vec3[][] = [];
  for (const startNode of atNode.keys()) {
    if (usedNode.has(startNode)) continue;
    const chainNodes: number[] = [];
    let node: number = startNode;
    let arrivingSegment = -1;
    let guard = 0;
    let closed = false;
    while (guard++ < 200000) {
      const options = (atNode.get(node) ?? []).filter(
        (id) => id !== arrivingSegment && !usedSegment.has(id),
      );
      // at the start node both segments belong to the loop — take either; later nodes have
      // exactly one continuation once the arriving segment is excluded
      if (options.length === 0 || (options.length > 1 && arrivingSegment !== -1)) break;
      const segmentId = options[0];
      const [a, b] = segments[segmentId];
      const nextNode = a === node ? b : a;
      usedSegment.add(segmentId);
      usedNode.add(node);
      chainNodes.push(node);
      if (nextNode === startNode) {
        closed = chainNodes.length >= 3;
        break;
      }
      arrivingSegment = segmentId;
      node = nextNode;
    }
    if (closed) {
      loops.push(chainNodes.map((key) => pointOfEdge.get(key)!));
    }
  }

  if (!loops.length) return null;
  return { loops, min, max };
}

/**
 * Cap triangles for a section's loops. Nested loops become a band between the outermost and
 * each hole (resampled by angle so different vertex counts pair up); a lone loop is ear-clipped
 * flat. Triangles face the anti-normal side so they are front-facing through the cut.
 */
export function capGeometryFromLoops(
  loops: Vec3[][],
  normal: Vec3,
): { positions: Float32Array; indices: Uint32Array } {
  const up: Vec3 = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u: Vec3 = [
    normal[1] * up[2] - normal[2] * up[1],
    normal[2] * up[0] - normal[0] * up[2],
    normal[0] * up[1] - normal[1] * up[0],
  ];
  const ul = Math.hypot(u[0], u[1], u[2]);
  u[0] /= ul;
  u[1] /= ul;
  u[2] /= ul;
  const v: Vec3 = [
    normal[1] * u[2] - normal[2] * u[1],
    normal[2] * u[0] - normal[0] * u[2],
    normal[0] * u[1] - normal[1] * u[0],
  ];
  const to2D = (p: Vec3): [number, number] => [
    p[0] * u[0] + p[1] * u[1] + p[2] * u[2],
    p[0] * v[0] + p[1] * v[1] + p[2] * v[2],
  ];

  const valid = loops
    .map((loop) => ({ loop, area: signedArea(loop.map(to2D)) }))
    .filter((entry) => entry.loop.length >= 3 && Math.abs(entry.area) > 0.002);

  const positions: number[] = [];
  const indices: number[] = [];

  if (valid.length === 1) {
    const loop = valid[0].loop;
    const pts = loop.map(to2D);
    // ear clipping, counter-clockwise
    const ccw = signedArea(pts) > 0;
    const remaining: number[] = loop.map((_, i) => i);
    if (!ccw) remaining.reverse();
    let guard = 0;
    while (remaining.length > 2 && guard++ < 50000) {
      let clipped = false;
      for (let i = 0; i < remaining.length; i++) {
        const iPrev = remaining[(i + remaining.length - 1) % remaining.length];
        const iCur = remaining[i];
        const iNext = remaining[(i + 1) % remaining.length];
        const [ax, ay] = pts[iCur];
        const [bx, by] = pts[iNext];
        const [cx, cy] = pts[iPrev];
        const winding = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        if (winding <= 1e-12) continue;
        let contains = false;
        for (const other of remaining) {
          if (other === iPrev || other === iCur || other === iNext) continue;
          const [px, py] = pts[other];
          const d1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
          const d2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
          const d3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
          if (d1 >= 0 && d2 >= 0 && d3 >= 0) {
            contains = true;
            break;
          }
        }
        if (contains) continue;
        indices.push(iCur, iNext, iPrev);
        remaining.splice(i, 1);
        clipped = true;
        break;
      }
      if (!clipped) break;
    }
    for (const p of loop) positions.push(p[0], p[1], p[2]);
  } else if (valid.length >= 2) {
    // outermost by |area| first; band each of the others onto it as a hole
    const sorted = [...valid].sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
    const outer = sorted[0];
    const outerPts = outer.loop.map(to2D);
    const cx = outerPts.reduce((s, p) => s + p[0], 0) / outerPts.length;
    const cy = outerPts.reduce((s, p) => s + p[1], 0) / outerPts.length;

    const SAMPLES = 96;
    const resample = (loop: Vec3[], centre: [number, number]): number => {
      const pts = loop.map(to2D);
      const angles = pts.map((p) => Math.atan2(p[1] - centre[1], p[0] - centre[0]));
      const base = positions.length / 3;
      for (let s = 0; s < SAMPLES; s++) {
        const target = (s / SAMPLES) * Math.PI * 2 - Math.PI;
        let i = 0;
        while (i < angles.length - 1 && angles[i] < target) i++;
        // walk angles continuously (they can wrap more than once for wiggly loops)
        let bestI = 0;
        let bestD = Infinity;
        for (let k = 0; k < angles.length; k++) {
          let a = angles[k] - target;
          while (a > Math.PI) a -= Math.PI * 2;
          while (a < -Math.PI) a += Math.PI * 2;
          if (Math.abs(a) < bestD) {
            bestD = Math.abs(a);
            bestI = k;
          }
        }
        i = bestI;
        const j = (i + 1) % pts.length;
        const p0 = loop[i];
        const p1 = loop[j];
        const a0 = angles[i];
        let a1 = angles[j];
        if (a1 < a0) a1 += Math.PI * 2;
        const t0 = target < a0 ? target + Math.PI * 2 : target;
        const t = a1 > a0 ? Math.max(0, Math.min(1, (t0 - a0) / (a1 - a0))) : 0;
        positions.push(
          p0[0] + (p1[0] - p0[0]) * t,
          p0[1] + (p1[1] - p0[1]) * t,
          p0[2] + (p1[2] - p0[2]) * t,
        );
      }
      return base;
    };

    const outerBase = resample(outer.loop, [cx, cy]);
    for (const hole of sorted.slice(1)) {
      const holePts = hole.loop.map(to2D);
      const hx = holePts.reduce((s, p) => s + p[0], 0) / holePts.length;
      const hy = holePts.reduce((s, p) => s + p[1], 0) / holePts.length;
      const holeBase = resample(hole.loop, [hx, hy]);
      for (let s = 0; s < SAMPLES; s++) {
        const s2 = (s + 1) % SAMPLES;
        indices.push(outerBase + s, holeBase + s2, outerBase + s2);
        indices.push(outerBase + s, holeBase + s, holeBase + s2);
      }
    }
  }

  if (!indices.length) return { positions: new Float32Array(0), indices: new Uint32Array(0) };

  // face the anti-normal side so the cap is front-facing seen through the cut
  const a = indices[0] * 3;
  const b = indices[1] * 3;
  const c = indices[2] * 3;
  const e1: Vec3 = [
    positions[b] - positions[a],
    positions[b + 1] - positions[a + 1],
    positions[b + 2] - positions[a + 2],
  ];
  const e2: Vec3 = [
    positions[c] - positions[a],
    positions[c + 1] - positions[a + 1],
    positions[c + 2] - positions[a + 2],
  ];
  const facing =
    (e1[1] * e2[2] - e1[2] * e2[1]) * normal[0] +
    (e1[2] * e2[0] - e1[0] * e2[2]) * normal[1] +
    (e1[0] * e2[1] - e1[1] * e2[0]) * normal[2];
  if (facing > 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = tmp;
    }
  }

  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

/** Convenience: section + cap in one call. */
export function sectionCap(
  mesh: StructureMesh,
  plane: SectionPlane,
): { positions: Float32Array; indices: Uint32Array } | null {
  const section = planeSection(mesh, plane);
  if (!section) return null;
  const cap = capGeometryFromLoops(section.loops, plane.normal);
  if (!cap.indices.length) return null;
  return cap;
}
