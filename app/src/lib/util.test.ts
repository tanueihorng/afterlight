import { describe, expect, it } from "vitest";
import {
  addDays,
  clamp,
  daysBetween,
  formatDate,
  formatLongDate,
  formatShortDate,
  isoToDateOnly,
  parseLocalDate,
  pluralize,
  todayLocal,
  uid,
} from "./util";

describe("date arithmetic", () => {
  it("crosses a month boundary in both directions", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("crosses a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("survives a spring-forward DST boundary without shifting the day", () => {
    // Whatever the runner's zone, adding a day must change the calendar date by exactly one.
    for (const start of ["2026-03-07", "2026-03-08", "2026-10-24", "2026-11-01"]) {
      expect(daysBetween(start, addDays(start, 1))).toBe(1);
    }
  });

  it("counts days between dates symmetrically", () => {
    expect(daysBetween("2026-06-01", "2026-06-08")).toBe(7);
    expect(Math.abs(daysBetween("2026-06-08", "2026-06-01"))).toBe(7);
  });
});

describe("formatting", () => {
  it("renders a date without drifting to the previous day", () => {
    expect(formatDate("2026-01-01")).toMatch(/1 Jan 2026/);
    expect(formatLongDate("2026-01-01")).toMatch(/2026/);
    expect(formatShortDate("2026-01-01")).toMatch(/Jan/);
  });

  it("reduces an ISO timestamp to its local calendar date", () => {
    expect(isoToDateOnly("2026-06-01T23:30:00")).toBe("2026-06-01");
  });

  it("parses a date string as local, not UTC", () => {
    const d = parseLocalDate("2026-06-01");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(1);
  });

  it("returns today in the same shape it parses", () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("small helpers", () => {
  it("clamps to both bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("pluralises around one", () => {
    expect(pluralize(1, "entry", "entries")).toMatch(/1 entry/);
    expect(pluralize(2, "entry", "entries")).toMatch(/2 entries/);
    expect(pluralize(0, "day")).toMatch(/0 days/);
  });

  it("issues unique ids", () => {
    const ids = new Set(Array.from({ length: 500 }, () => uid()));
    expect(ids.size).toBe(500);
  });
});
