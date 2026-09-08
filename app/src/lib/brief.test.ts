import { describe, expect, it } from "vitest";
import { defaultBriefRange, generateBrief, changesSince, eyeName } from "./brief";
import {
  anAllData,
  anAppointment,
  aDrawing,
  aMedication,
  aProcedure,
  aQuestion,
  aSymptom,
  anImaging,
} from "../test/factories";

const flat = (p: ReturnType<typeof generateBrief>, eye: "right" | "left") =>
  [...p.perEye[eye].new, ...p.perEye[eye].unchanged, ...p.perEye[eye].improved, ...p.perEye[eye].worse];

describe("generateBrief — section placement", () => {
  it("never files a worsening symptom under unchanged", () => {
    const data = anAllData({
      symptoms: [aSymptom({ eye: "left", status: "worse", symptom_type: "glare" })],
    });
    const p = generateBrief(data, { range_start: "2026-05-01", range_end: "2026-06-30" });
    expect(p.perEye.left.worse).toHaveLength(1);
    expect(p.perEye.left.unchanged.join(" ")).not.toMatch(/glare/i);
  });

  it("files new symptoms under new, by status or by baseline comparison", () => {
    const data = anAllData({
      symptoms: [
        aSymptom({ eye: "left", status: "new", symptom_type: "flashes" }),
        aSymptom({ eye: "left", status: "same", baseline_comparison: "new", symptom_type: "halos" }),
      ],
    });
    const p = generateBrief(data, { range_start: "2026-05-01", range_end: "2026-06-30" });
    expect(p.perEye.left.new.join(" ")).toMatch(/flashes/i);
    expect(p.perEye.left.new.join(" ")).toMatch(/halos/i);
    expect(p.perEye.left.unchanged).toHaveLength(0);
  });

  it("treats better and resolved as improved", () => {
    const data = anAllData({
      symptoms: [
        aSymptom({ eye: "right", status: "better", symptom_type: "dryness" }),
        aSymptom({ eye: "right", status: "resolved", symptom_type: "pain" }),
      ],
    });
    const p = generateBrief(data, { range_start: "2026-05-01", range_end: "2026-06-30" });
    expect(p.perEye.right.improved).toHaveLength(2);
    expect(p.perEye.right.worse).toHaveLength(0);
  });
});

describe("generateBrief — eye separation", () => {
  it("never leaks a left-eye symptom into the right eye", () => {
    const data = anAllData({
      symptoms: [aSymptom({ eye: "left", symptom_type: "distortion", status: "worse" })],
    });
    const p = generateBrief(data, { range_start: "2026-05-01", range_end: "2026-06-30" });
    expect(flat(p, "right").join(" ")).not.toMatch(/distortion/i);
    expect(flat(p, "left").join(" ")).toMatch(/distortion/i);
  });

  it("reports a both-eyes symptom under each eye", () => {
    const data = anAllData({ symptoms: [aSymptom({ eye: "both", symptom_type: "glare" })] });
    const p = generateBrief(data, { range_start: "2026-05-01", range_end: "2026-06-30" });
    expect(flat(p, "right").join(" ")).toMatch(/glare/i);
    expect(flat(p, "left").join(" ")).toMatch(/glare/i);
  });
});

describe("generateBrief — empty and out-of-range periods", () => {
  it("fabricates nothing for an empty record", () => {
    const p = generateBrief(anAllData(), { range_start: "2026-05-01", range_end: "2026-06-30" });
    expect(p.perEye.right.new).toHaveLength(0);
    expect(p.perEye.left.new).toHaveLength(0);
    expect(p.clinicalEvents).toHaveLength(0);
    expect(p.drawings).toHaveLength(0);
    expect(p.questions).toHaveLength(0);
    // The only unchanged line is the explicit "nothing recorded" statement.
    expect(p.perEye.right.unchanged).toEqual([
      "No symptoms recorded for the right eye in this period.",
    ]);
  });

  it("excludes records outside the range at both ends", () => {
    const data = anAllData({
      symptoms: [
        aSymptom({ date_time: "2026-04-30T09:00:00", symptom_type: "before-window" }),
        aSymptom({ date_time: "2026-07-01T09:00:00", symptom_type: "after-window" }),
        aSymptom({ date_time: "2026-06-30T23:00:00", symptom_type: "last-day" }),
        aSymptom({ date_time: "2026-05-01T00:30:00", symptom_type: "first-day" }),
      ],
    });
    const p = generateBrief(data, { range_start: "2026-05-01", range_end: "2026-06-30" });
    const text = flat(p, "left").join(" ");
    expect(text).not.toMatch(/before-window|after-window/i);
    expect(text).toMatch(/last-day/i);
    expect(text).toMatch(/first-day/i);
  });
});

describe("generateBrief — supporting sections", () => {
  it("collects drawings, clinical events, treatment and pending questions in range", () => {
    const data = anAllData({
      drawings: [aDrawing({ date_time: "2026-06-02T09:00:00" })],
      imaging: [anImaging({ date: "2026-06-03" })],
      procedures: [aProcedure({ date: "2026-06-04", procedure_type: "laser photocoagulation" })],
      medications: [aMedication({ start_date: "2026-05-02", name: "Test drops" })],
      questions: [aQuestion({ text: "Has my OCT changed?", status: "pending" })],
    });
    const p = generateBrief(data, { range_start: "2026-05-01", range_end: "2026-06-30" });
    expect(p.drawings).toHaveLength(1);
    expect(p.clinicalEvents.length).toBeGreaterThanOrEqual(2);
    expect(p.treatment.join(" ")).toMatch(/Test drops/);
    expect(p.questions).toContain("Has my OCT changed?");
  });

  it("omits questions that are already answered", () => {
    const data = anAllData({
      questions: [aQuestion({ text: "Already asked", status: "answered", answer: "Yes" })],
    });
    const p = generateBrief(data, { range_start: "2026-05-01", range_end: "2026-06-30" });
    expect(p.questions).not.toContain("Already asked");
  });
});

describe("defaultBriefRange", () => {
  it("spans from the previous appointment to the target one", () => {
    const prev = anAppointment({ id: "prev", date_time: "2026-05-10T10:00:00" });
    const target = anAppointment({ id: "target", date_time: "2026-06-15T10:00:00" });
    const range = defaultBriefRange(anAllData({ appointments: [prev, target] }), {
      beforeApptId: "target",
    });
    expect(range).toEqual({ range_start: "2026-05-10", range_end: "2026-06-15" });
  });

  it("falls back to 30 days before a first-ever appointment", () => {
    const only = anAppointment({ id: "only", date_time: "2026-06-15T10:00:00" });
    const range = defaultBriefRange(anAllData({ appointments: [only] }), { beforeApptId: "only" });
    expect(range).toEqual({ range_start: "2026-05-16", range_end: "2026-06-15" });
  });

  it("never starts after it ends", () => {
    const range = defaultBriefRange(anAllData());
    expect(range.range_start <= range.range_end).toBe(true);
  });
});

describe("changesSince", () => {
  it("counts only what falls inside the window", () => {
    const data = anAllData({
      symptoms: [
        aSymptom({ date_time: "2026-06-02T09:00:00", status: "new" }),
        aSymptom({ date_time: "2026-01-02T09:00:00", status: "new" }),
      ],
      drawings: [aDrawing({ date_time: "2026-06-03T09:00:00" })],
    });
    const c = changesSince(data, "2026-06-01", "2026-06-30");
    expect(c.newSymptoms).toBe(1);
    expect(c.drawings).toBe(1);
  });
});

describe("eyeName", () => {
  it("names both eyes distinctly", () => {
    expect(eyeName("right")).not.toBe(eyeName("left"));
  });
});

describe("unreviewed extractions", () => {
  const range = { range_start: "2026-09-01", range_end: "2026-09-30" };

  it("keeps a scan read out of a filename out of the brief until it is confirmed", () => {
    // A date or an eye guessed from a filename is a suggestion. A brief is the one place where a
    // guess would be read as a fact by someone who was not there when it was made.
    const data = anAllData({
      imaging: [
        anImaging({
          id: "unchecked",
          date: "2026-09-05",
          source_type: "document_extracted",
          confirmed: false,
        }),
        anImaging({
          id: "checked",
          date: "2026-09-06",
          source_type: "document_extracted",
          confirmed: true,
        }),
      ],
    });
    const payload = generateBrief(data, range);
    const kinds = payload.clinicalEvents.map((e) => `${e.date} ${e.kind}`);
    expect(kinds.join(" ")).toContain("2026-09-06");
    expect(kinds.join(" ")).not.toContain("2026-09-05");
  });

  it("still counts nothing it excluded, so the dashboard and the brief agree", () => {
    const data = anAllData({
      imaging: [
        anImaging({ id: "u", date: "2026-09-05", source_type: "document_extracted", confirmed: false }),
      ],
    });
    expect(changesSince(data, range.range_start, range.range_end).imaging).toBe(0);
  });

  it("leaves records the person entered themselves alone, confirmed or not", () => {
    const data = anAllData({
      imaging: [
        anImaging({ id: "own", date: "2026-09-05", source_type: "device_measurement", confirmed: false }),
      ],
    });
    expect(generateBrief(data, range).clinicalEvents).toHaveLength(1);
  });
});
