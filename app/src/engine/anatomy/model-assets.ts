// Loading the committed Blender model in the browser.
//
// Vite inlines the binary as a base64 data URL (`?inline`), so the lazy renderer chunk carries
// the whole model with no fetch and no network — the nonetwork gate checks the built output.
// Node callers (tests, the legacy explorer's build) read the same files from disk.

import { decodeAnatomy, type AnatomyManifest, type StructureMesh } from "./model";
import anatomyManifest from "../assets/anatomy.json";
import anatomyDataUrl from "../assets/anatomy-data";

export type { AnatomyManifest, StructureMesh };

export const EYE_MODEL_MANIFEST = anatomyManifest as AnatomyManifest;

function base64ToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cached: Map<string, StructureMesh> | null = null;

/** The decoded model, memoised: the arrays are immutable and shared by every scene instance. */
export function loadEyeModel(): Map<string, StructureMesh> {
  if (!cached) {
    cached = decodeAnatomy(base64ToArrayBuffer(anatomyDataUrl), EYE_MODEL_MANIFEST);
  }
  return cached;
}

/** For callers that already hold the bytes (tests, the legacy explorer's generated block). */
export function decodeEyeModelFrom(bin: ArrayBuffer, manifest: AnatomyManifest) {
  return decodeAnatomy(bin, manifest);
}
