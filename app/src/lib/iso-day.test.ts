import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatDate, formatTime, isoToDateOnly, localNaiveNow } from "./util";

// The UTC/local boundary is where the old slicing lost whole days. Pin a timezone east of GMT
// so that boundary is crossed on every run, whatever machine the suite executes on.
const REAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Asia/Kuala_Lumpur";
});
afterAll(() => {
  process.env.TZ = REAL_TZ;
});

// UTC 2026-09-13T19:02 is 2026-09-14 03:02 in Kuala Lumpur: the local calendar says the 14th.
const EARLY_LOCAL_MORNING = "2026-09-13T19:02:00.000Z";

describe("day extraction stays on the person's calendar", () => {
  it("a timestamp written before 8am local belongs to today, not yesterday", () => {
    expect(isoToDateOnly(EARLY_LOCAL_MORNING)).toBe("2026-09-14");
  });

  it("an evening local timestamp still lands on its own day", () => {
    // UTC 2026-09-13T10:02 is 2026-09-13 18:02 local.
    expect(isoToDateOnly("2026-09-13T10:02:00.000Z")).toBe("2026-09-13");
  });

  it("date-only strings pass through untouched", () => {
    expect(isoToDateOnly("2026-09-14")).toBe("2026-09-14");
    expect(isoToDateOnly("2024-03-01")).toBe("2024-03-01");
  });

  it("the date and the time on an event row agree with each other", () => {
    expect(formatDate(EARLY_LOCAL_MORNING)).toBe("14 Sep 2026");
    expect(formatTime(EARLY_LOCAL_MORNING)).toBe("3:02");
  });
});

describe("localNaiveNow — comparing now with zone-less stored timestamps", () => {
  // Appointments are stored as "2026-10-24T13:00:00": local wall-clock, no zone. Comparing them
  // with toISOString() sorted them against UTC, so east of Greenwich a visit stayed "Next" for
  // hours after it happened and the brief button vanished on the day it was needed.
  it("writes the wall-clock moment in the same form the forms store", () => {
    // UTC 2026-10-24T10:00 is 18:00 in Kuala Lumpur.
    expect(localNaiveNow(new Date("2026-10-24T10:00:00Z"))).toBe("2026-10-24T18:00:00");
  });

  it("an appointment earlier today is past once its hour has gone by, at any offset", () => {
    const now = new Date("2026-10-24T10:00:00Z"); // 18:00 local
    const visit = "2026-10-24T17:00:00"; // 17:00 local, an hour ago
    expect(visit >= localNaiveNow(now)).toBe(false);
  });

  it("this afternoon's visit is still coming", () => {
    const now = new Date("2026-10-24T02:00:00Z"); // 10:00 local
    expect("2026-10-24T13:00:00" >= localNaiveNow(now)).toBe(true);
  });
});
