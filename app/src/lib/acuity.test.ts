import { describe, expect, it } from "vitest";
import {
  acuityForms,
  comparable,
  logmarToDecimal,
  logmarToSnellen,
  parseAcuity,
} from "./acuity";

describe("parseAcuity", () => {
  it("converts the reference Snellen values to logMAR exactly", () => {
    expect(parseAcuity("6/6").logmar).toBe(0);
    expect(parseAcuity("20/20").logmar).toBe(0);
    expect(parseAcuity("6/60").logmar).toBe(1);
    expect(parseAcuity("20/200").logmar).toBe(1);
    expect(parseAcuity("6/12").logmar).toBeCloseTo(0.3, 2);
    expect(parseAcuity("20/40").logmar).toBeCloseTo(0.3, 2);
  });

  it("handles better-than-standard acuity as a negative logMAR", () => {
    expect(parseAcuity("6/4.8").logmar).toBeCloseTo(-0.1, 2);
  });

  it("reads decimal notation when told that is what it is", () => {
    expect(parseAcuity("1.0", "decimal").logmar).toBe(0);
    expect(parseAcuity("0.5", "decimal").logmar).toBeCloseTo(0.3, 2);
  });

  it("reads a logMAR value directly", () => {
    expect(parseAcuity("0.3", "logmar").logmar).toBe(0.3);
  });

  it("refuses to guess what a bare number means", () => {
    expect(parseAcuity("0.3").logmar).toBeUndefined();
  });

  it("recognises the non-numeric acuities and never turns them into numbers", () => {
    for (const value of ["CF", "hm", "LP", "nlp"]) {
      const parsed = parseAcuity(value);
      expect(parsed.nonNumeric).toBeTruthy();
      expect(parsed.logmar).toBeUndefined();
    }
  });

  it("keeps an unreadable value as-is rather than inventing one", () => {
    const parsed = parseAcuity("about the same");
    expect(parsed.logmar).toBeUndefined();
    expect(parsed.raw).toBe("about the same");
  });
});

describe("conversion back out", () => {
  it("round-trips the reference values", () => {
    expect(logmarToSnellen(0, 6)).toBe("6/6");
    expect(logmarToSnellen(0, 20)).toBe("20/20");
    expect(logmarToSnellen(1, 6)).toBe("6/60");
    expect(logmarToSnellen(0.3, 20)).toBe("20/40");
    expect(logmarToDecimal(0)).toBe(1);
    expect(logmarToDecimal(1)).toBe(0.1);
  });

  it("survives a full round trip in either notation", () => {
    for (const value of ["6/6", "6/9", "6/12", "6/18", "6/24", "6/36", "6/60"]) {
      const logmar = parseAcuity(value).logmar!;
      expect(logmarToSnellen(logmar, 6)).toBe(value);
    }
  });
});

describe("acuityForms", () => {
  it("gives every notation for one measurement", () => {
    const forms = acuityForms("6/12");
    expect(forms.snellen20).toBe("20/40");
    expect(forms.decimal).toBeCloseTo(0.5, 2);
    expect(forms.logmar).toBeCloseTo(0.3, 2);
    expect(forms.label).toBe("6/12");
  });

  it("labels a non-numeric acuity in words and offers no conversions", () => {
    const forms = acuityForms("HM");
    expect(forms.label).toBe("Hand movements");
    expect(forms.snellen6).toBeUndefined();
    expect(forms.decimal).toBeUndefined();
  });
});

describe("comparable", () => {
  it("refuses to compare values that are not numbers", () => {
    expect(comparable(parseAcuity("6/6"), parseAcuity("6/12"))).toBe(true);
    expect(comparable(parseAcuity("6/6"), parseAcuity("HM"))).toBe(false);
    expect(comparable(parseAcuity("6/6"), parseAcuity("nonsense"))).toBe(false);
  });
});
