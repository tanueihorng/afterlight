import { describe, expect, it } from "vitest";
import {
  MIGRATIONS,
  SCHEMA_VERSION,
  materialiseFiles,
  migrate,
  migrationsFor,
  schemaVersionOf,
  type Snapshot,
} from "./migrations";
import type { FloaterObject } from "./models";
import { anAllData, aFloater, aSymptom } from "../test/factories";

const snapshotAt = (over: Partial<Snapshot> = {}): Snapshot => ({
  data: anAllData(),
  files: [],
  meta: { id: "meta", onboarded: true, theme: "dark", demo_seeded: false },
  ...over,
});

describe("version detection", () => {
  it("treats a record with no recorded version as version 1", () => {
    expect(schemaVersionOf(undefined)).toBe(1);
    expect(schemaVersionOf({ id: "meta", onboarded: true, theme: "dark", demo_seeded: false })).toBe(1);
  });

  it("reads the version a record declares", () => {
    expect(
      schemaVersionOf({ id: "meta", onboarded: true, theme: "dark", demo_seeded: false, schema_version: 2 }),
    ).toBe(2);
  });
});

describe("migration chain", () => {
  it("is contiguous and ends at the declared schema version", () => {
    const sorted = [...MIGRATIONS].sort((a, b) => a.from - b.from);
    sorted.forEach((m, i) => {
      expect(m.to).toBe(m.from + 1);
      if (i > 0) expect(m.from).toBe(sorted[i - 1].to);
    });
    expect(sorted[sorted.length - 1].to).toBe(SCHEMA_VERSION);
    expect(sorted[0].from).toBe(1);
  });

  it("selects only the steps a given version still needs", () => {
    expect(migrationsFor(1)).toHaveLength(MIGRATIONS.length);
    expect(migrationsFor(SCHEMA_VERSION)).toHaveLength(0);
  });

  it("describes every step, so a person can see what happened to their record", () => {
    for (const m of MIGRATIONS) expect(m.describe.length).toBeGreaterThan(10);
  });
});

describe("migrate", () => {
  it("is a no-op for a record already at the current version", () => {
    const snap = snapshotAt({
      meta: { id: "meta", onboarded: true, theme: "dark", demo_seeded: false, schema_version: SCHEMA_VERSION },
    });
    const result = migrate(snap);
    expect(result.applied).toEqual([]);
    expect(result.snapshot.data).toEqual(snap.data);
  });

  it("carries a version 1 record all the way to current", () => {
    const legacyFloater = { ...aFloater() } as Partial<FloaterObject>;
    delete legacyFloater.source_type;
    const snap = snapshotAt({
      data: anAllData({ floaters: [legacyFloater as FloaterObject], symptoms: [aSymptom()] }),
    });

    const result = migrate(snap, 1);
    expect(result.from).toBe(1);
    expect(result.to).toBe(SCHEMA_VERSION);
    expect(result.snapshot.data.floaters[0].source_type).toBe("patient_reported");
    expect(result.snapshot.meta?.schema_version).toBe(SCHEMA_VERSION);
  });

  it("does not touch provenance that was already recorded", () => {
    const snap = snapshotAt({
      data: anAllData({ floaters: [aFloater({ source_type: "clinician_reported" })] }),
    });
    expect(migrate(snap, 1).snapshot.data.floaters[0].source_type).toBe("clinician_reported");
  });

  it("leaves every other record untouched", () => {
    const symptom = aSymptom({ description: "unchanged by migration" });
    const snap = snapshotAt({ data: anAllData({ symptoms: [symptom] }) });
    expect(migrate(snap, 1).snapshot.data.symptoms).toEqual([symptom]);
  });

  it("does not mutate the snapshot it was given", () => {
    const legacy = { ...aFloater() } as Partial<FloaterObject>;
    delete legacy.source_type;
    const snap = snapshotAt({ data: anAllData({ floaters: [legacy as FloaterObject] }) });
    migrate(snap, 1);
    expect((snap.data.floaters[0] as Partial<FloaterObject>).source_type).toBeUndefined();
  });
});

describe("materialiseFiles", () => {
  it("keeps a file that is already stored as bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const [out] = await materialiseFiles([
      { id: "f1", name: "a.png", mime: "image/png", bytes, size: 3, stored_at: "2026-01-01T00:00:00Z" },
    ]);
    expect(out.bytes.byteLength).toBe(3);
    expect(out.size).toBe(3);
  });

  it("reads the payload out of a legacy Blob file", async () => {
    const [out] = await materialiseFiles([
      { id: "f2", name: "b.png", mime: "image/png", blob: new Blob([new Uint8Array([9, 9])]) },
    ]);
    expect(Array.from(new Uint8Array(out.bytes))).toEqual([9, 9]);
    expect(out.size).toBe(2);
  });

  it("keeps an unreadable file as an empty record rather than dropping it", async () => {
    const [out] = await materialiseFiles([{ id: "f3", name: "lost.pdf", mime: "application/pdf" }]);
    expect(out.id).toBe("f3");
    expect(out.name).toBe("lost.pdf");
    expect(out.size).toBe(0);
  });
});
