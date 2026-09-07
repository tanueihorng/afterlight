import { describe, expect, it } from "vitest";
import { askRecords, EXAMPLE_QUESTIONS, NOT_FOUND } from "./ask";
import {
  anAllData,
  anAppointment,
  aDiagnosis,
  aFloater,
  anImaging,
  aMeasurement,
  aPrescription,
  aProcedure,
  aQuestion,
  aSymptom,
} from "../test/factories";

describe("askRecords — the empty record", () => {
  it("says exactly the not-found sentence for every example question", () => {
    for (const q of EXAMPLE_QUESTIONS) {
      const a = askRecords(anAllData(), q);
      expect(a.found, `"${q}" should find nothing in an empty record`).toBe(false);
      expect(a.lines).toEqual([NOT_FOUND]);
      expect(a.citations).toEqual([]);
    }
  });

  it("returns nothing at all for an empty question", () => {
    const a = askRecords(anAllData(), "   ");
    expect(a.found).toBe(false);
    expect(a.lines).toEqual([]);
  });
});

describe("askRecords — first occurrence", () => {
  const data = anAllData({
    symptoms: [
      aSymptom({ eye: "left", symptom_type: "glare", date_time: "2026-08-22T20:00:00" }),
      aSymptom({ eye: "left", symptom_type: "glare", date_time: "2026-09-07T20:00:00" }),
      aSymptom({ eye: "right", symptom_type: "glare", date_time: "2026-07-01T20:00:00" }),
    ],
  });

  it("answers with the earliest matching entry for the named eye", () => {
    const a = askRecords(data, "When did glare in my left eye first appear?");
    expect(a.found).toBe(true);
    expect(a.lines[0]).toContain("22 Aug 2026");
    expect(a.lines[0]).not.toContain("1 Jul 2026");
  });

  it("cites the record it answered from", () => {
    const a = askRecords(data, "When did glare in my left eye first appear?");
    expect(a.citations.length).toBeGreaterThan(0);
    expect(a.citations[0].label).toMatch(/22 Aug 2026/);
    expect(a.citations[0].route).toBeTruthy();
  });

  it("finds the first floater of a given year", () => {
    const withFloaters = anAllData({
      floaters: [
        aFloater({ first_seen: "2026-03-02", nickname: "Comma" }),
        aFloater({ first_seen: "2025-11-02", nickname: "Older" }),
      ],
    });
    const a = askRecords(withFloaters, "When was the first new floater recorded this year 2026?");
    expect(a.lines.join(" ")).toContain("Comma");
    expect(a.lines.join(" ")).not.toContain("Older");
  });
});

describe("askRecords — imaging after surgery", () => {
  it("lists only scans on or after the most recent procedure", () => {
    const data = anAllData({
      procedures: [aProcedure({ date: "2026-05-01", procedure_type: "vitrectomy" })],
      imaging: [
        anImaging({ date: "2026-04-01", modality: "OCT" }),
        anImaging({ date: "2026-06-01", modality: "OCT" }),
      ],
    });
    const a = askRecords(data, "Show every OCT after my surgery");
    expect(a.lines.join(" ")).toContain("1 Jun 2026");
    expect(a.lines.join(" ")).not.toContain("1 Apr 2026");
  });
});

describe("askRecords — between the last two appointments", () => {
  it("counts only entries inside that window", () => {
    const data = anAllData({
      appointments: [
        anAppointment({ date_time: "2026-05-01T10:00:00" }),
        anAppointment({ date_time: "2026-06-01T10:00:00" }),
      ],
      symptoms: [
        aSymptom({ date_time: "2026-05-15T10:00:00", symptom_type: "glare" }),
        aSymptom({ date_time: "2026-04-15T10:00:00", symptom_type: "halos" }),
      ],
    });
    const a = askRecords(data, "What symptoms did I report between my last two appointments?");
    expect(a.found).toBe(true);
    expect(a.lines.join(" ")).toContain("glare");
    expect(a.lines.join(" ")).not.toContain("halos");
  });

  it("finds nothing when there has only ever been one appointment", () => {
    const data = anAllData({ appointments: [anAppointment({ date_time: "2026-05-01T10:00:00" })] });
    const a = askRecords(data, "What symptoms did I report between my last two appointments?");
    expect(a.lines).toEqual([NOT_FOUND]);
  });
});

describe("askRecords — clinician-documented content", () => {
  it("quotes documented text and cites it, without paraphrasing", () => {
    const data = anAllData({
      imaging: [
        anImaging({
          date: "2026-06-01",
          clinician_interpretation: "Stable macula, no subretinal fluid",
          source_type: "clinician_reported",
        }),
      ],
    });
    const a = askRecords(data, "What did my doctors document about the macula?");
    expect(a.lines.join(" ")).toContain("Stable macula, no subretinal fluid");
    expect(a.citations.length).toBeGreaterThan(0);
  });
});

describe("askRecords — prescriptions", () => {
  it("compares the two most recent and reports both dates", () => {
    const data = anAllData({
      prescriptions: [
        aPrescription({ date: "2024-09-08", right_eye: { sphere: -0.5 }, left_eye: { sphere: -3.25 } }),
        aPrescription({ date: "2026-07-10", right_eye: { sphere: -0.25 }, left_eye: { sphere: -3.5 } }),
      ],
    });
    const a = askRecords(data, "Compare my two most recent prescriptions");
    expect(a.lines[0]).toContain("8 Sep 2024");
    expect(a.lines[0]).toContain("10 Jul 2026");
    expect(a.citations).toHaveLength(2);
  });

  it("cannot compare when only one prescription exists", () => {
    const data = anAllData({ prescriptions: [aPrescription()] });
    expect(askRecords(data, "Compare my two most recent prescriptions").lines).toEqual([NOT_FOUND]);
  });
});

describe("askRecords — measurements", () => {
  it("lists pressures most recent first", () => {
    const data = anAllData({
      measurements: [
        aMeasurement({ date: "2026-03-01", value: "18" }),
        aMeasurement({ date: "2026-06-01", value: "22" }),
      ],
    });
    const a = askRecords(data, "What is my eye pressure?");
    const text = a.lines.join(" ");
    expect(text.indexOf("22")).toBeLessThan(text.indexOf("18"));
  });
});

describe("askRecords — questions and change summary", () => {
  it("lists questions carried into the last appointment", () => {
    const data = anAllData({
      appointments: [anAppointment({ date_time: "2026-06-01T10:00:00" })],
      questions: [aQuestion({ text: "Has my OCT changed?" })],
    });
    const a = askRecords(data, "What questions did I want to ask at my previous appointment?");
    expect(a.lines.join(" ")).toContain("Has my OCT changed?");
  });

  it("summarises change since the last appointment without inventing events", () => {
    const data = anAllData({
      appointments: [anAppointment({ date_time: "2026-06-01T10:00:00" })],
      symptoms: [aSymptom({ date_time: "2026-06-05T10:00:00", status: "new", symptom_type: "flashes" })],
    });
    const a = askRecords(data, "Summarize what changed since my last review");
    expect(a.lines.join(" ")).toMatch(/flashes/i);
    // The appointment that opens the window is itself the only clinical event; nothing else
    // may appear, because nothing else was recorded.
    expect(a.lines.join(" ")).toMatch(/Clinical events: 1 Jun 2026 Appointment\./);
    expect(a.lines.join(" ")).not.toMatch(/OCT|injection|laser/i);
  });
});

describe("askRecords — never invents", () => {
  it("only emits substrings that trace back to the record", () => {
    const data = anAllData({
      diagnoses: [aDiagnosis({ name: "Lattice degeneration" })],
    });
    const a = askRecords(data, "lattice");
    expect(a.found).toBe(true);
    expect(a.lines.join(" ")).toContain("Lattice degeneration");
  });

  it("falls back to keyword search rather than guessing", () => {
    const data = anAllData({ symptoms: [aSymptom({ symptom_type: "halos" })] });
    const a = askRecords(data, "halos");
    expect(a.interpretation).toMatch(/keyword/i);
    expect(a.lines.join(" ")).toContain("halos");
  });

  it("returns not-found rather than a near-miss for an unanswerable question", () => {
    const data = anAllData({ symptoms: [aSymptom({ symptom_type: "halos" })] });
    expect(askRecords(data, "zzzzqqq").lines).toEqual([NOT_FOUND]);
  });
});
