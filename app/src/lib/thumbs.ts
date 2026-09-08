// Thumbnail generation, in a worker where the browser supports it.
//
// Thumbnails are stored as their own files rather than as data URLs on the record: a data URL is
// about a third larger, is parsed on every read, and sits in the same document as the metadata
// the list view needs.

import type { ThumbRequest, ThumbResponse } from "../workers/image.worker";
import { getStoredFile, saveStoredFile, storedFileURL } from "./db";
import type { StoredFile } from "./models";

export const THUMB_MAX_EDGE = 360;

let worker: Worker | null = null;
let workerBroken = false;

function getWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("../workers/image.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("error", () => {
      workerBroken = true;
      worker = null;
    });
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

interface Thumb {
  bytes: ArrayBuffer;
  mime: string;
  width: number;
  height: number;
}

function inWorker(bytes: ArrayBuffer, mime: string): Promise<Thumb | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(null);

  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => {
      w.removeEventListener("message", onMessage);
      resolve(null);
    }, 15_000);

    const onMessage = (event: MessageEvent<ThumbResponse>) => {
      if (event.data.id !== id) return;
      clearTimeout(timeout);
      w.removeEventListener("message", onMessage);
      const r = event.data;
      resolve(
        r.ok && r.bytes
          ? { bytes: r.bytes, mime: r.mime ?? "image/jpeg", width: r.width ?? 0, height: r.height ?? 0 }
          : null,
      );
    };

    w.addEventListener("message", onMessage);
    const copy = bytes.slice(0);
    const message: ThumbRequest = { id, bytes: copy, mime, maxEdge: THUMB_MAX_EDGE };
    w.postMessage(message, [copy]);
  });
}

/** Fallback for browsers without OffscreenCanvas or module workers. */
async function onMainThread(bytes: ArrayBuffer, mime: string): Promise<Thumb | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  try {
    const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
    const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob) return null;
    return { bytes: await blob.arrayBuffer(), mime: blob.type, width, height };
  } catch {
    return null;
  }
}

export async function makeThumbnail(bytes: ArrayBuffer, mime: string): Promise<Thumb | null> {
  if (!mime.startsWith("image/")) return null;
  return (await inWorker(bytes, mime)) ?? (await onMainThread(bytes, mime));
}

/**
 * Generate a thumbnail for a stored file and save it as its own file record.
 * Returns the thumbnail's id, or undefined if one could not be made.
 */
/**
 * The best available thumbnail source for an imaging record: the stored thumbnail file if there
 * is one, else the data URL written by older versions. Returns an object URL the caller must
 * release, or a data URL that needs no cleanup.
 */
export async function thumbnailSrc(record: {
  thumb_file_id?: string;
  thumb?: string;
}): Promise<{ src: string; revocable: boolean } | null> {
  if (record.thumb_file_id) {
    const file = await getStoredFile(record.thumb_file_id);
    if (file) return { src: storedFileURL(file), revocable: true };
  }
  if (record.thumb) return { src: record.thumb, revocable: false };
  return null;
}

export async function storeThumbnailFor(source: StoredFile): Promise<string | undefined> {
  const thumb = await makeThumbnail(source.bytes, source.mime);
  if (!thumb) return undefined;
  const record: StoredFile = {
    id: `thumb-${source.id}`,
    name: `thumb-${source.name}`,
    mime: thumb.mime,
    bytes: thumb.bytes,
    size: thumb.bytes.byteLength,
    stored_at: new Date().toISOString(),
  };
  await saveStoredFile(record);
  return record.id;
}
