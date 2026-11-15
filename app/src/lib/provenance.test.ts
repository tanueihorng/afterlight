import { describe, expect, it } from "vitest";
import { buildTimeline } from "./store";
import { searchRecords } from "./search";
import { generateBrief } from "./brief";
import { anAllData, anAppointment, aMedication, aProcedure, aQuestion } from "../test/factories";

// Provenance is stored on every record, so the timeline, search and the brief must all read the
// record's own value. Deriving it from the record type labelled a surgery someone described from
// memory as "Clinician documented", and a self-care medicine differently in search and timeline.
describe("stored provenance is the one source of truth", () => {
  const data = anAllData({
    procedures: [
      aProcedure({ id: "told", procedure_type: "Vitrectomy", date: "2026-05-10", source_type: "patient_reported" }),
      aProcedure({ id: "letter", procedure_type: "Barrier laser", date: "2026-05-12", source_type: "clinician_reported" }),
    ],
    medications: [aMedication({ id: "tears", name: "Artificial tears", kind: "self_care", start_date: "2026-05-01" })],
    appointments: [anAppointment({ id: "visit", date_time: "2026-05-20T10:00:00" })],
    questions: [aQuestion({ id: "q", text: "Is the floater new?" })],
  });

  it("the timeline shows each record's stored source", () => {
    const by = new Map(buildTimeline(data).map((e) => [e.entity_id, e.source_type]));
    expect(by.get("told")).toBe("patient_reported");
    expect(by.get("letter")).toBe("clinician_reported");
    expect(by.get("tears")).toBe("patient_reported");
    expect(by.get("visit")).toBe("clinician_reported");
  });

  it("search agrees with the timeline", () => {
    const source = (q: string) => searchRecords(data, q)[0]?.source_type;
    expect(source("vitrectomy")).toBe("patient_reported");
    expect(source("barrier laser")).toBe("clinician_reported");
    expect(source("artificial tears")).toBe("patient_reported");
    expect(source("floater new")).toBe("patient_reported");
  });

  it("the brief keeps a patient-reported procedure marked as the patient's own", () => {
    const brief = generateBrief(data, { range_start: "2026-05-01", range_end: "2026-05-31" });
    const events = new Map(brief.clinicalEvents.map((e) => [e.title, e.source_type]));
    expect(events.get("Vitrectomy")).toBe("patient_reported");
    expect(events.get("Barrier laser")).toBe("clinician_reported");
  });
});
