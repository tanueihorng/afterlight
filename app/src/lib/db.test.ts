import { beforeEach, describe, expect, it } from "vitest";
import {
  STORES,
  dbClear,
  dbDelete,
  dbGet,
  dbGetAll,
  dbPut,
  dbPutMany,
  getStoredFile,
  loadAllData,
} from "./db";
import type { FloaterObject, StoredFile } from "./models";
import { aDrawing, aFloater, anImaging, aSymptom } from "../test/factories";

beforeEach(async () => {
  for (const store of STORES) await dbClear(store);
});

describe("record round trip", () => {
  it("stores and reads a record unchanged", async () => {
    const symptom = aSymptom({ description: "One new dark dot, slightly right of centre" });
    await dbPut("symptoms", symptom);
    expect(await dbGet("symptoms", symptom.id)).toEqual(symptom);
  });

  it("writes many records in one call", async () => {
    await dbPutMany("symptoms", [aSymptom(), aSymptom(), aSymptom()]);
    expect(await dbGetAll("symptoms")).toHaveLength(3);
  });

  it("deletes only the named record", async () => {
    const keep = aSymptom();
    const drop = aSymptom();
    await dbPutMany("symptoms", [keep, drop]);
    await dbDelete("symptoms", drop.id);
    const left = await dbGetAll<{ id: string }>("symptoms");
    expect(left.map((r) => r.id)).toEqual([keep.id]);
  });
});

describe("stored files", () => {
  it("round-trips the file's identity and type", async () => {
    const file: StoredFile = {
      id: "file-1",
      name: "oct.png",
      mime: "image/png",
      blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
    };
    await dbPut("files", file);

    const back = await getStoredFile("file-1");
    expect(back).toBeDefined();
    expect(back!.name).toBe("oct.png");
    expect(back!.mime).toBe("image/png");
  });

  // fake-indexeddb's structured clone does not carry a jsdom Blob: it comes back as a plain
  // object with no bytes, so the payload of every scan and document a patient uploads cannot be
  // asserted in this environment. This is the highest-value untested path in the app. It needs a
  // real browser (the Playwright suite in Phase 04) or a switch to ArrayBuffer storage, which
  // Phase 01 should decide when it defines the archive format.
  it.skip("round-trips blob bytes — needs a real browser, see Phase 01/04", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128]);
    await dbPut("files", {
      id: "file-2",
      name: "oct.png",
      mime: "image/png",
      blob: new Blob([bytes], { type: "image/png" }),
    });
    const back = await getStoredFile("file-2");
    expect(Array.from(new Uint8Array(await back!.blob.arrayBuffer()))).toEqual(Array.from(bytes));
  });
});

describe("loadAllData", () => {
  it("returns empty lists rather than undefined for a fresh record", async () => {
    const data = await loadAllData();
    expect(data.symptoms).toEqual([]);
    expect(data.imaging).toEqual([]);
    expect(data.meta).toBeUndefined();
  });

  it("loads every slice it stored", async () => {
    await dbPut("symptoms", aSymptom());
    await dbPut("drawings", aDrawing());
    await dbPut("imaging", anImaging());
    const data = await loadAllData();
    expect(data.symptoms).toHaveLength(1);
    expect(data.drawings).toHaveLength(1);
    expect(data.imaging).toHaveLength(1);
  });

  it("fills in provenance for floaters stored before the field existed", async () => {
    // A pre-provenance record, exactly as an older build would have written it.
    const legacy = { ...aFloater() } as Partial<FloaterObject>;
    delete legacy.source_type;
    await dbPut("floaters", legacy);

    const data = await loadAllData();
    expect(data.floaters[0].source_type).toBe("patient_reported");
  });

  it("does not overwrite provenance that is already recorded", async () => {
    await dbPut("floaters", aFloater({ source_type: "clinician_reported" }));
    const data = await loadAllData();
    expect(data.floaters[0].source_type).toBe("clinician_reported");
  });
});
