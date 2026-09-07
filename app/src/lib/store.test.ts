import { describe, expect, it } from "vitest";
import { buildTimeline } from "./store";
import {
  anAllData,
  anAppointment,
  aDiagnosis,
  aDrawing,
  aFloater,
  anImaging,
  aMeasurement,
  aMedication,
  aProcedure,
  aSymptom,
  aDocument,
  aPrescription,
} from "../test/factories";

const fullRecord = () =>
  anAllData({
    symptoms: [aSymptom({ date_time: "2026-06-01T09:00:00" })],
    drawings: [aDrawing({ date_time: "2026-06-02T09:00:00" })],
    appointments: [anAppointment({ date_time: "2026-06-03T09:00:00" })],
    diagnoses: [aDiagnosis({ first_documented: "2026-06-04" })],
    procedures: [aProcedure({ date: "2026-06-05" })],
    medications: [aMedication({ start_date: "2026-06-06" })],
    prescriptions: [aPrescription({ date: "2026-06-07" })],
    measurements: [aMeasurement({ date: "2026-06-08" })],
    imaging: [anImaging({ date: "2026-06-09" })],
    documents: [aDocument({ date: "2026-06-10" })],
    floaters: [aFloater({ first_seen: "2026-06-11" })],
  });

describe("buildTimeline", () => {
  it("orders newest first", () => {
    const events = buildTimeline(fullRecord());
    const dates = events.map((e) => e.date_time);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
  });

  it("represents every entity type that carries a date", () => {
    const kinds = new Set(buildTimeline(fullRecord()).map((e) => e.event_type));
    for (const kind of [
      "symptom",
      "drawing",
      "appointment",
      "diagnosis",
      "procedure",
      "medication",
      "prescription",
      "measurement",
      "imaging",
      "document",
      "floater",
    ]) {
      expect(kinds, `timeline is missing ${kind}`).toContain(kind);
    }
  });

  it("carries provenance and eye through to every event", () => {
    for (const event of buildTimeline(fullRecord())) {
      expect(event.source_type, `${event.event_type} lost its source`).toBeTruthy();
      expect(event.eye, `${event.event_type} lost its eye`).toBeTruthy();
      expect(event.entity_id).toBeTruthy();
      expect(event.title).toBeTruthy();
    }
  });

  it("keeps a patient drawing labelled as patient-drawn", () => {
    const events = buildTimeline(anAllData({ drawings: [aDrawing()] }));
    expect(events[0].source_type).toBe("patient_drawn");
  });

  it("keeps clinician-documented imaging labelled as documented, not patient-reported", () => {
    const events = buildTimeline(
      anAllData({ imaging: [anImaging({ source_type: "clinician_reported" })] }),
    );
    expect(events[0].source_type).toBe("clinician_reported");
  });

  it("produces nothing from an empty record", () => {
    expect(buildTimeline(anAllData())).toEqual([]);
  });

  it("gives every event a unique id", () => {
    const events = buildTimeline(fullRecord());
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });

  it("never merges the two eyes into one event", () => {
    const events = buildTimeline(
      anAllData({
        symptoms: [
          aSymptom({ eye: "left", date_time: "2026-06-01T09:00:00" }),
          aSymptom({ eye: "right", date_time: "2026-06-01T09:00:00" }),
        ],
      }),
    );
    expect(events).toHaveLength(2);
    expect(new Set(events.map((e) => e.eye))).toEqual(new Set(["left", "right"]));
  });
});
