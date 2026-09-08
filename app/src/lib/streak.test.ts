import { describe, expect, it } from "vitest";
import { continuity, continuitySentence } from "./streak";
import { aDailyLog } from "../test/factories";

const logs = (...dates: string[]) => dates.map((date) => aDailyLog({ id: date, date }));

describe("continuity", () => {
  it("counts days recorded inside the window only", () => {
    const c = continuity(logs("2026-09-08", "2026-09-07", "2026-05-01"), "2026-09-08", 30);
    expect(c.daysRecorded).toBe(2);
    expect(c.windowDays).toBe(30);
  });

  it("counts a run up to today and stops at the first gap", () => {
    const c = continuity(logs("2026-09-08", "2026-09-07", "2026-09-05"), "2026-09-08");
    expect(c.currentRun).toBe(2);
  });

  it("reports no run when today is not recorded", () => {
    const c = continuity(logs("2026-09-07", "2026-09-06"), "2026-09-08");
    expect(c.currentRun).toBe(0);
    expect(c.recordedToday).toBe(false);
    expect(c.lastRecordedDate).toBe("2026-09-07");
  });

  it("handles an empty record", () => {
    const c = continuity([], "2026-09-08");
    expect(c.daysRecorded).toBe(0);
    expect(c.currentRun).toBe(0);
    expect(c.lastRecordedDate).toBeUndefined();
  });
});

describe("continuitySentence", () => {
  it("says nothing for an empty record", () => {
    expect(continuitySentence(continuity([], "2026-09-08"), "2026-09-08")).toBeNull();
  });

  it("says nothing on a first day", () => {
    const c = continuity(logs("2026-09-08"), "2026-09-08");
    expect(continuitySentence(c, "2026-09-08")).toBeNull();
  });

  it("states the plain count without praise or reward", () => {
    const c = continuity(logs("2026-09-08", "2026-09-07", "2026-09-06"), "2026-09-08");
    const sentence = continuitySentence(c, "2026-09-08")!;
    expect(sentence).toBe("You have recorded 3 of the last 30 days.");
    expect(sentence).not.toMatch(/streak|well done|great|keep it up|don't break/i);
  });

  it("acknowledges a gap without implying failure", () => {
    const c = continuity(logs("2026-09-01", "2026-08-31"), "2026-09-08");
    const sentence = continuitySentence(c, "2026-09-08")!;
    expect(sentence).toMatch(/Gaps are fine/);
    expect(sentence).not.toMatch(/missed|should|lost|broken/i);
  });
});
