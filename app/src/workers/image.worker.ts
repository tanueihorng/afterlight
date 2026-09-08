/// <reference lib="webworker" />
// Thumbnailing off the main thread.
//
// A fundus photo or an OCT export is often several megapixels; decoding and scaling one on the
// main thread freezes the interface at exactly the moment someone is adding a scan they care
// about. This does the work in a worker and hands back compressed bytes.

export interface ThumbRequest {
  id: string;
  bytes: ArrayBuffer;
  mime: string;
  maxEdge: number;
}

export interface ThumbResponse {
  id: string;
  ok: boolean;
  bytes?: ArrayBuffer;
  mime?: string;
  width?: number;
  height?: number;
  error?: string;
}

self.onmessage = async (event: MessageEvent<ThumbRequest>) => {
  const { id, bytes, mime, maxEdge } = event.data;
  const respond = (r: ThumbResponse, transfer: Transferable[] = []) =>
    (self as unknown as Worker).postMessage(r, transfer);

  try {
    const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context in worker");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // WebP where supported, JPEG otherwise; both are far smaller than a stored data URL.
    let blob: Blob;
    try {
      blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
    } catch {
      blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
    }

    const out = await blob.arrayBuffer();
    respond({ id, ok: true, bytes: out, mime: blob.type, width, height }, [out]);
  } catch (e) {
    respond({ id, ok: false, error: e instanceof Error ? e.message : "thumbnail failed" });
  }
};
