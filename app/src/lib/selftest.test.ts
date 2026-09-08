import { describe, expect, it } from "vitest";
import {
  CARD_WIDTH_MM,
  COMPARABILITY_NOTE,
  SELF_TEST_BOUNDARY,
  calibrationFromCardWidth,
  comparability,
  conditionsSummary,
  describeSeries,
  homeAcuityNotation,
  letterHeightMm,
  seriesFor,
  stepIsRenderable,
} from "./selftest";
import { conditionsComplete, type SelfTestResult, type TestConditions } from "./models";

const conditions = (over: Partial<TestConditions> = {}): TestConditions => ({
  brightness: "medium",
  ambient: "normal",
  distance_cm: 40,
  correction: "glasses",
  ...over,
});

const result = (over: Partial<SelfTestResult> = {}): SelfTestResult => ({
  id: `t${Math.random()}`,
  kind: "home_acuity",
  date_time: "2026-09-01T09:00:00",
  eye: "left",
  result: { smallest_step: 3 },
  conditions: conditions(),
  source_type: "patient_reported",
  created_at: "2026-09-01T09:00:00",
  updated_at: "2026-09-01T09:00:00",
  ...over,
});

describe("calibration", () => {
  it("derives a scale from a card measured on screen", () => {
    const c = calibrationFromCardWidth(342.4)!;
    expect(c.px_per_mm).toBeCloseTo(4, 2);
    expect(c.px_per_mm * CARD_WIDTH_MM).toBeCloseTo(342.4, 1);
  });

  it("refuses a nonsensical measurement rather than producing a wrong scale", () => {
    expect(calibrationFromCardWidth(0)).toBeNull();
    expect(calibrationFromCardWidth(-5)).toBeNull();
    expect(calibrationFromCardWidth(Number.NaN)).toBeNull();
  });
});

describe("letter geometry", () => {
  it("matches the standard: 6/6 at 6 metres is about 8.7 mm tall", () => {
    expect(letterHeightMm(0, 600)).toBeCloseTo(8.73, 1);
  });

  it("scales with logMAR and with distance", () => {
    expect(letterHeightMm(1, 600)).toBeCloseTo(letterHeightMm(0, 600) * 10, 1);
    expect(letterHeightMm(0, 300)).toBeCloseTo(letterHeightMm(0, 600) / 2, 2);
  });

  it("knows when a step is too small for the screen to show honestly", () => {
    const calibration = { px_per_mm: 4 };
    expect(stepIsRenderable(1, 40, calibration)).toBe(true);
    expect(stepIsRenderable(-0.3, 40, calibration)).toBe(false);
  });
});

describe("comparability", () => {
  it("accepts two attempts taken the same way", () => {
    expect(comparability(result(), result())).toBe("comparable");
  });

  it("rejects attempts taken at a different distance", () => {
    expect(comparability(result(), result({ conditions: conditions({ distance_cm: 60 }) }))).toBe(
      "conditions_differ",
    );
  });

  it("tolerates a small difference in distance, since nobody measures exactly", () => {
    expect(comparability(result(), result({ conditions: conditions({ distance_cm: 43 }) }))).toBe(
      "comparable",
    );
  });

  it("rejects attempts with different brightness, lighting or correction", () => {
    expect(comparability(result(), result({ conditions: conditions({ brightness: "high" }) }))).toBe(
      "conditions_differ",
    );
    expect(comparability(result(), result({ conditions: conditions({ ambient: "dark" }) }))).toBe(
      "conditions_differ",
    );
    expect(comparability(result(), result({ conditions: conditions({ correction: "none" }) }))).toBe(
      "conditions_differ",
    );
  });

  it("says so when the conditions were never recorded", () => {
    const incomplete = result({ conditions: { correction: "glasses" } });
    expect(comparability(result(), incomplete)).toBe("conditions_missing");
    expect(conditionsComplete(incomplete.conditions)).toBe(false);
  });

  it("explains every verdict in plain words", () => {
    for (const note of Object.values(COMPARABILITY_NOTE)) {
      expect(note.length).toBeGreaterThan(10);
      expect(note).not.toMatch(/worse|better|improv|declin|abnormal|normal/i);
    }
  });
});

describe("describeSeries", () => {
  it("says nothing has been recorded when nothing has", () => {
    expect(describeSeries(seriesFor([], "home_acuity", "left"))).toBe("No attempts recorded.");
  });

  it("does not compare a single attempt with anything", () => {
    const series = seriesFor([result()], "home_acuity", "left");
    expect(describeSeries(series)).toMatch(/nothing to compare against yet/);
  });

  it("states that attempts differ rather than plotting them together", () => {
    const series = seriesFor(
      [
        result({ date_time: "2026-09-05T09:00:00" }),
        result({ date_time: "2026-09-01T09:00:00", conditions: conditions({ distance_cm: 100 }) }),
      ],
      "home_acuity",
      "left",
    );
    expect(describeSeries(series)).toMatch(/cannot be compared/);
  });

  it("never uses trend or judgement language", () => {
    const series = seriesFor([result(), result({ date_time: "2026-09-05T09:00:00" })], "home_acuity", "left");
    expect(describeSeries(series)).not.toMatch(/worse|better|improv|declin|stable|normal|abnormal/i);
  });

  it("keeps the two eyes as separate series", () => {
    const results = [result({ eye: "left" }), result({ eye: "right" })];
    expect(seriesFor(results, "home_acuity", "left").results).toHaveLength(1);
    expect(seriesFor(results, "home_acuity", "right").results).toHaveLength(1);
  });
});

describe("wording", () => {
  it("states the boundary in one place, and states it plainly", () => {
    expect(SELF_TEST_BOUNDARY).toMatch(/not a measurement of your vision/i);
    expect(SELF_TEST_BOUNDARY).toMatch(/cannot be compared with a test done at a clinic/i);
  });

  it("never renders a home result as a bare clinical acuity", () => {
    const text = homeAcuityNotation(0.3);
    expect(text).toMatch(/home screen check/);
    expect(text).toMatch(/^about /);
    expect(text).not.toMatch(/^6\/\d+$/);
  });

  it("summarises the conditions a result was taken under", () => {
    expect(conditionsSummary(conditions())).toBe(
      "40 cm away, with glasses, screen brightness medium, normal room",
    );
  });
});
