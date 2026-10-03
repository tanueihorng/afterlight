// Legacy-explorer adapter: the original anatomical model for the embedded Three r160 page.
//
// Bundled by sync-eye-assets.mjs into a marked block in EyeExplorer.html (like the iris block
// beside it). The page's own Three version and material helpers are passed in — no THREE
// instance or material crosses this boundary, only plain data and the page's objects.
// Geometry and section caps both read the same decoded arrays, mirroring the app.

import { decodeAnatomy, type AnatomyManifest, type StructureMesh } from "../anatomy/model";
import { sectionCap, type SectionPlane } from "../anatomy/section";
import { paintFundus, DEFAULT_FUNDUS } from "../anatomy/fundus";

export { paintFundus, DEFAULT_FUNDUS };

import anatomyManifest from "../assets/anatomy.json";
import anatomyDataUrl from "../assets/anatomy-data";

export const LEGACY_MANIFEST = anatomyManifest as AnatomyManifest;

function decodeAll(): Map<string, StructureMesh> {
  const base64 = anatomyDataUrl.slice(anatomyDataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return decodeAnatomy(bytes.buffer, LEGACY_MANIFEST);
}

export interface LegacyEyeHandles {
  root: Record<string, unknown>;
  updateCut: (constantSceneUnits: number) => void;
  structureNames: string[];
}

export interface LegacyEyeOptions {
  THREE: typeof import("three"); // shape-compatible with the page's embedded r160
  /** mm → the page's scene units (the explorer uses 1/6, the app 1/10). */
  unitScale: number;
  /** clipping planes applied to every sliceable structure's materials */
  clip: unknown[];
  /** material per structure (or per slot); first entry is tissue, a named "cut" one is the cap */
  materials: Record<string, unknown | unknown[]>;
  /** the page's pick registry call */
  pick: (mesh: unknown, id: string) => unknown;
  /** where to add meshes */
  add: (mesh: unknown) => void;
  /** structures hidden from the start */
  hidden?: string[];
}

export function createLegacyEye(options: LegacyEyeOptions): LegacyEyeHandles {
  const { THREE, unitScale, clip, materials, pick, add } = options;
  const structures = decodeAll();
  const scale = (positions: Float32Array): Float32Array => {
    const out = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i++) out[i] = positions[i] * unitScale;
    return out;
  };

  const root: Record<string, unknown> = {};
  const cutMaterialOf = new Map<string, unknown>();

  for (const [structure, data] of structures) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(scale(data.positions), 3));
    if (data.uvs && data.uvs.length === (data.positions.length / 3) * 2) {
      geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(data.uvs), 2));
    }
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(data.indices), 1));
    geometry.computeVertexNormals();

    const material = materials[structure];
    if (material === undefined) continue;
    const mats: unknown[] = Array.isArray(material) ? material : [material];
    for (const m of mats as { clippingPlanes?: unknown[] }[]) m.clippingPlanes = clip;

    const slots: string[] = [];
    for (const slot of data.slotOfTriangle) {
      if (!slots.includes(slot)) slots.push(slot);
    }
    let scanned = 0;
    while (scanned < data.slotOfTriangle.length) {
      const slot = data.slotOfTriangle[scanned];
      let count = 0;
      while (
        scanned + count < data.slotOfTriangle.length &&
        data.slotOfTriangle[scanned + count] === slot
      ) {
        count++;
      }
      geometry.addGroup(
        scanned * 3,
        count * 3,
        Math.min(slots.indexOf(slot), mats.length - 1),
      );
      scanned += count;
    }

    const mesh = new THREE.Mesh(geometry, (mats.length > 1 ? mats : mats[0]) as never);
    mesh.name = structure;
    if (!options.hidden?.includes(structure)) {
      add(pick(mesh, structure));
    } else {
      add(mesh);
    }
    root[structure] = mesh;
    const namedCut = (mats as { name?: string }[]).find((m) => m.name === "cut");
    cutMaterialOf.set(structure, namedCut ?? mats[mats.length - 1]);
  }

  const caps: unknown[] = [];
  let lastConstant = Number.NaN;

  const disposeCaps = () => {
    for (const cap of caps) {
      const mesh = cap as { geometry: { dispose(): void }; parent: { remove(m: unknown): void } };
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
    }
    caps.length = 0;
  };

  const updateCut = (constantSceneUnits: number): void => {
    if (constantSceneUnits === lastConstant) return;
    lastConstant = constantSceneUnits;
    disposeCaps();
    const constantMm = constantSceneUnits / unitScale;
    for (const [structure, data] of structures) {
      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i < data.positions.length; i += 3) {
        minX = Math.min(minX, data.positions[i]);
        maxX = Math.max(maxX, data.positions[i]);
      }
      if (constantMm <= minX || constantMm >= maxX) continue;
      const plane: SectionPlane = { normal: [1, 0, 0], constant: constantMm };
      const cap = sectionCap(data, plane);
      if (!cap || !cap.indices.length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(scale(cap.positions), 3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(cap.indices), 1));
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, cutMaterialOf.get(structure) as never);
      mesh.name = `${structure}.cap`;
      mesh.renderOrder = 1;
      add(mesh);
      caps.push(mesh);
    }
  };

  return {
    root,
    updateCut,
    structureNames: [...structures.keys()],
  };
}
