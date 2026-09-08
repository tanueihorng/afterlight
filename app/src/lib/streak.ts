// How consistently the record has been kept.
//
// Stated as a plain fact and nothing more. There is no streak to break, no flame, no badge, and
// no notification: a missed day is not a failure, and someone whose vision got worse this week
// does not need their diary to scold them.

import type { DailyLog } from "./models";
import { addDays, daysBetween, todayLocal } from "./util";

export interface Continuity {
  /** Days with any entry in the window. */
  daysRecorded: number;
  windowDays: number;
  /** Consecutive days up to and including today. Reported, never rewarded. */
  currentRun: number;
  lastRecordedDate?: string;
  /** Whether today already has an entry. */
  recordedToday: boolean;
}

export function continuity(logs: DailyLog[], today = todayLocal(), windowDays = 30): Continuity {
  const dates = new Set(logs.map((l) => l.date));
  const windowStart = addDays(today, -(windowDays - 1));

  let daysRecorded = 0;
  for (const date of dates) {
    if (date >= windowStart && date <= today) daysRecorded++;
  }

  let currentRun = 0;
  for (let i = 0; ; i++) {
    const day = addDays(today, -i);
    if (!dates.has(day)) break;
    currentRun++;
    if (currentRun > 3650) break;
  }

  const sorted = [...dates].filter((d) => d <= today).sort();
  return {
    daysRecorded,
    windowDays,
    currentRun,
    lastRecordedDate: sorted[sorted.length - 1],
    recordedToday: dates.has(today),
  };
}

/**
 * One sentence, or nothing at all. Silence is the right output for a record that is either brand
 * new or perfectly ordinary — there is no value in commenting on every day.
 */
export function continuitySentence(c: Continuity, today = todayLocal()): string | null {
  if (c.daysRecorded === 0) return null;
  if (c.daysRecorded === 1 && c.recordedToday) return null;

  if (!c.recordedToday && c.lastRecordedDate) {
    const gap = daysBetween(c.lastRecordedDate, today);
    if (gap >= 2) {
      return `Last recorded ${gap} days ago. Gaps are fine — the record still works with them.`;
    }
  }

  return `You have recorded ${c.daysRecorded} of the last ${c.windowDays} days.`;
}
