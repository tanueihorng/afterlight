// The browser side of the Blender-authored model: decode anatomy.bin + anatomy.json into
// plain typed arrays. No Three.js import here — the app (r180) and the embedded legacy
// explorer (r160) each adapt these arrays to their own BufferGeometry, and node tests can
// walk the data directly.
//
// The binary layout is fixed by assets-src/build-anatomy.py: per vertex, three int16 position
// components quantised against the structure's bounding box, then two int16 UV components.
// Indices are not stored: every part is a regular rows×cols grid, so the decoder regenerates
// them, welds coincident border vertices between parts (shared edges are emitted twice), and
// leaves normals to the renderer's computeVertexNormals.

export interface AnatomyPart {
  id: string;
  structure: string;
  slot: string;
  rows: number;
  cols: number;
  wrap: boolean;
  rowWrap: boolean;
  byteOffset: number;
  vertexCount: number;
  bboxMin: [number, number, number];
  bboxSpan: [number, number, number];
}

export interface AnatomyManifest {
  generator: string;
  units: string;
  decoding: string;
  disc3d: [number, number, number];
  fovea3d: [number, number, number];
  retinaInnerRadiusMm: number;
  layerMagnification: number;
  openStructures: string[];
  parts: AnatomyPart[];
}

export interface StructureMesh {
  structure: string;
  /** Welded vertex positions in eye-local millimetres (+Z anterior, +Y superior, +X nasal). */
  positions: Float32Array;
  uvs: Float32Array;
  /** Slot name per triangle, aligned with the index triples (tissue vs cut face). */
  slotOfTriangle: string[];
  indices: Uint32Array;
}

const BYTES_PER_VERTEX = 10;

function gridIndices(part: AnatomyPart, vertexAt: (row: number, col: number) => number): number[] {
  const out: number[] = [];
  const colSpan = part.wrap ? part.cols : part.cols - 1;
  const rowSpan = part.rowWrap ? part.rows : part.rows - 1;
  for (let j = 0; j < rowSpan; j++) {
    const j2 = (j + 1) % part.rows;
    for (let i = 0; i < colSpan; i++) {
      const i2 = (i + 1) % part.cols;
      const a = vertexAt(j, i);
      const b = vertexAt(j, i2);
      const c = vertexAt(j2, i2);
      const d = vertexAt(j2, i);
      // collapsed rows (apex poles welded to one vertex) leave partially degenerate quads:
      // emit only the genuinely triangular remainders
      if (a !== b && a !== d && b !== d) out.push(a, b, d);
      if (b !== c && b !== d && c !== d) out.push(b, c, d);
    }
  }
  return out;
}

/**
 * Decode the model. Welding is by exact quantised position key, which is why the exporter
 * quantises each structure against one shared bounding box: coincident border rows produce
 * identical keys and merge into a continuous skin.
 */
export function decodeAnatomy(bin: ArrayBuffer, manifest: AnatomyManifest): Map<string, StructureMesh> {
  const view = new DataView(bin);
  const structures = new Map<string, StructureMesh>();

  const byStructure = new Map<string, AnatomyPart[]>();
  for (const part of manifest.parts) {
    const list = byStructure.get(part.structure) ?? [];
    list.push(part);
    byStructure.set(part.structure, list);
  }

  for (const [structure, parts] of byStructure) {
    const bboxMin = parts[0].bboxMin;
    const bboxSpan = parts[0].bboxSpan;

    // First pass: weld every part's vertices through one map.
    const weld = new Map<number, number>();
    const positions: number[] = [];
    const uvs: number[] = [];
    const partVertexIds: number[][] = [];

    for (const part of parts) {
      const ids: number[] = new Array(part.vertexCount);
      for (let k = 0; k < part.vertexCount; k++) {
        const offset = part.byteOffset + k * BYTES_PER_VERTEX;
        const px = view.getInt16(offset, true);
        const py = view.getInt16(offset + 2, true);
        const pz = view.getInt16(offset + 4, true);
        const u = view.getInt16(offset + 6, true);
        const v = view.getInt16(offset + 8, true);
        const x = bboxMin[0] + (px / 32767) * bboxSpan[0];
        const y = bboxMin[1] + (py / 32767) * bboxSpan[1];
        const z = bboxMin[2] + (pz / 32767) * bboxSpan[2];
        // The weld key rounds to 0.01 mm: the exporter's trig puts the seam column of a
        // wrap=False grid at sin(2π) vs sin(0), which differs by ~1e-15 mm but flips one
        // int16 quantum. Grid vertices are never within 0.01 mm of each other, so this only
        // ever merges the coincident border rows the weld is for.
        const key =
          Math.round((x + 50) * 100) * 1e8 +
          Math.round((y + 50) * 100) * 1e4 +
          Math.round((z + 50) * 100);
        let index = weld.get(key);
        if (index === undefined) {
          index = positions.length / 3;
          weld.set(key, index);
          positions.push(x, y, z);
          uvs.push(u / 32767, v / 32767);
        }
        ids[k] = index;
      }
      partVertexIds.push(ids);
    }

    // Second pass: regenerate grid indices per part, recording each triangle's slot.
    const indices: number[] = [];
    const slotOfTriangle: string[] = [];
    parts.forEach((part, partIndex) => {
      const ids = partVertexIds[partIndex];
      const start = indices.length;
      for (const index of gridIndices(part, (row, col) => ids[row * part.cols + col])) {
        indices.push(index);
      }
      const triangles = (indices.length - start) / 3;
      for (let t = 0; t < triangles; t++) slotOfTriangle.push(part.slot);
    });

    structures.set(structure, {
      structure,
      positions: new Float32Array(positions),
      uvs: new Float32Array(uvs),
      slotOfTriangle,
      indices: new Uint32Array(indices),
    });
  }

  return structures;
}

/**
 * Boundary edges of a decoded structure: edges referenced by exactly one triangle. Solids must
 * have none; a nonzero count is a broken weld or a dropped part, so tests pin it at zero.
 */
export function boundaryEdges(mesh: StructureMesh): number {
  const counts = new Map<bigint, number>();
  const triangles = mesh.indices.length / 3;
  for (let t = 0; t < triangles; t++) {
    for (let e = 0; e < 3; e++) {
      const a = mesh.indices[t * 3 + e];
      const b = mesh.indices[t * 3 + (e + 1) % 3];
      const key = a < b ? (BigInt(a) << 32n) | BigInt(b) : (BigInt(b) << 32n) | BigInt(a);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let boundary = 0;
  for (const count of counts.values()) if (count === 1) boundary += 1;
  return boundary;
}

/** Distance from the anterior–posterior axis, for checking the iris's polar geometry. */
export function maxRadial(mesh: StructureMesh): number {
  let max = 0;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const r = Math.hypot(mesh.positions[i], mesh.positions[i + 1]);
    if (r > max) max = r;
  }
  return max;
}

export function minRadial(mesh: StructureMesh): number {
  let min = Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const r = Math.hypot(mesh.positions[i], mesh.positions[i + 1]);
    if (r < min) min = r;
  }
  return min;
}
