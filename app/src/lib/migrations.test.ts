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
import type { Appointment, DoctorQuestion, FloaterObject, Medication, Prescription, Procedure } from "./models";
import {
  anAllData,
  anAppointment,
  aFloater,
  aMeasurement,
  aMedication,
  aPrescription,
  aProcedure,
  aQuestion,
  aSymptom,
} from "../test/factories";
import { buildTimeline } from "./store";

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

  it("keeps legacy document measurements unchecked while preserving other readings", () => {
    const snap = snapshotAt({ data: anAllData({ measurements: [
      aMeasurement({ id: "document", source_type: "document_extracted", confirmed: undefined }),
      aMeasurement({ id: "clinic", source_type: "clinician_reported", confirmed: undefined }),
    ] }) });
    const result = migrate(snap, 4);
    expect(result.snapshot.data.measurements.map((m) => m.confirmed)).toEqual([false, true]);
    expect(snap.data.measurements.every((m) => m.confirmed === undefined)).toBe(true);
  });
});

describe("lens type (5 → 6)", () => {
  it("marks existing prescriptions as type not recorded, never guessing, and keeps a set type", () => {
    const old = { ...aPrescription({ id: "rx-old" }) } as Partial<Prescription>;
    delete old.lens;
    const set = aPrescription({ id: "rx-set", lens: "contact_lenses" });
    const result = migrate(
      snapshotAt({ data: anAllData({ prescriptions: [old as Prescription, set] }) }),
      5,
    );
    const byId = new Map(result.snapshot.data.prescriptions.map((p) => [p.id, p]));
    expect(byId.get("rx-old")).toEqual({ ...old, lens: "not_recorded" });
    expect(byId.get("rx-set")).toEqual(set);
    expect(result.applied.map((m) => m.to)).toContain(6);
  });
});

/** A record as written before schema 7: no stored `source_type`, and no `eye` where it had none. */
function withoutProvenance<T extends object>(rec: T, ...fields: string[]): T {
  const copy = { ...rec } as Record<string, unknown>;
  for (const f of fields) delete copy[f];
  return copy as T;
}

describe("stored provenance (6 → 7)", () => {
  const old = anAllData({
    appointments: [withoutProvenance(anAppointment({ id: "apt" }), "eye", "source_type") as Appointment],
    questions: [withoutProvenance(aQuestion({ id: "qst" }), "eye", "source_type") as DoctorQuestion],
    procedures: [withoutProvenance(aProcedure({ id: "prc" }), "source_type") as Procedure],
    medications: [
      withoutProvenance(aMedication({ id: "med-rx", kind: "prescription" }), "source_type") as Medication,
      withoutProvenance(aMedication({ id: "med-self", kind: "self_care" }), "source_type") as Medication,
    ],
    prescriptions: [withoutProvenance(aPrescription({ id: "rx" }), "eye", "source_type") as Prescription],
  });

  it("writes down exactly the provenance the timeline already showed for each record", () => {
    // What the timeline displayed for these records before schema 7, when it derived provenance
    // from the record type. The migration must not change a single badge.
    const shownBefore: Record<string, [string, string]> = {
      apt: ["not_applicable", "clinician_reported"],
      prc: ["right", "clinician_reported"],
      "med-rx": ["both", "clinician_reported"],
      "med-self": ["both", "patient_reported"],
      rx: ["both", "clinician_reported"],
    };
    const migrated = migrate(snapshotAt({ data: old }), 6).snapshot.data;
    const after = Object.fromEntries(buildTimeline(migrated).map((e) => [e.entity_id, [e.eye, e.source_type]]));
    expect(after).toEqual(shownBefore);
  });

  it("stores the values on the records themselves", () => {
    const d = migrate(snapshotAt({ data: old }), 6).snapshot.data;
    expect(d.appointments[0]).toMatchObject({ eye: "not_applicable", source_type: "clinician_reported" });
    expect(d.questions[0]).toMatchObject({ eye: "not_applicable", source_type: "patient_reported" });
    expect(d.procedures[0].source_type).toBe("clinician_reported");
    const med = new Map(d.medications.map((m) => [m.id, m.source_type]));
    expect(med.get("med-rx")).toBe("clinician_reported");
    expect(med.get("med-self")).toBe("patient_reported");
    expect(d.prescriptions[0]).toMatchObject({ eye: "both", source_type: "clinician_reported" });
  });

  it("keeps provenance that is already stored, including a patient-reported procedure", () => {
    const told = aProcedure({ id: "told", source_type: "patient_reported" });
    const d = migrate(snapshotAt({ data: anAllData({ procedures: [told] }) }), 6).snapshot.data;
    expect(d.procedures[0]).toEqual(told);
  });

  it("reaches the current schema version", () => {
    expect(migrate(snapshotAt({ data: old }), 6).to).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(7);
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
