// Reading the whole record out to a single file.
//
// This reads IndexedDB directly rather than the React store, so it works even when the UI has
// crashed — the error boundary offers it as an escape hatch, which is the one moment a patient
// most needs their data out. Phase 01 extends this envelope (versioning, checksum, encryption);
// keep the shape stable until then.

import { STORES, dbGetAll, type StoreName } from "./db";
import type { StoredFile } from "./models";
import { nowISO } from "./util";

export const ARCHIVE_APP = "afterlight";
export const ARCHIVE_VERSION = 1;

export interface Archive {
  app: string;
  version: number;
  exported_at: string;
  data: Record<string, unknown>;
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function dataURLToBlob(dataURL: string): Blob {
  const [meta, b64] = dataURL.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Every record and every stored file, read straight from the database. */
export async function buildArchive(): Promise<Archive> {
  const data: Record<string, unknown> = {};
  for (const store of STORES) {
    if (store === "files") continue;
    const rows = await dbGetAll<unknown>(store as StoreName);
    // `meta` is a single record; the UI expects it unwrapped.
    data[store] = store === "meta" ? (rows[0] ?? null) : rows;
  }

  const files = await dbGetAll<StoredFile>("files");
  data.files = await Promise.all(
    files.map(async (f) => ({
      id: f.id,
      name: f.name,
      mime: f.mime,
      data: await blobToDataURL(f.blob),
    })),
  );

  return { app: ARCHIVE_APP, version: ARCHIVE_VERSION, exported_at: nowISO(), data };
}

export function archiveFilename(now = nowISO()): string {
  return `afterlight-export-${now.slice(0, 10)}.json`;
}

/** Build the archive and hand it to the browser as a download. */
export async function downloadArchive(): Promise<void> {
  const archive = await buildArchive();
  const blob = new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = archiveFilename(archive.exported_at);
  a.click();
  URL.revokeObjectURL(url);
}
