// What the Today dashboard shows, derived from the record on every render.
//
// Nothing here is stored and nothing here judges. A day with no entry is "missing", never
// "fine"; a measurement is shown with the date and the source it came from, never compared.

import type { AllData } from "./db";
import {
  BASELINE_LABELS,
  MEASUREMENT_LABELS,
  SELF_TEST_LABELS,
  type Appointment,
  type Eye,
  type Measurement,
  type SourceType,
} from "./models";
import { select } from "./query";
import { addDays, isoToDateOnly } from "./util";

export type DayState = "no_change" | "changed" | "missing";

export interface DayCell {
  date: string;
  state: DayState;
}

/** The last `n` days ending today, oldest first. A day nobody wrote anything on stays missing. */
export function recentDays(data: AllData, today: string, n = 14): DayCell[] {
  const start = addDays(today, -(n - 1));
  const logs = new Map(
    select(data, "dailyLogs")
      .between(start, today)
      .all()
      .map((l) => [l.date, l.overall] as const),
  );
  const symptomDays = new Set(
    select(data, "symptoms")
      .between(start, today)
      .all()
      .map((s) => isoToDateOnly(s.date_time)),
  );
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(start, i);
    const overall = logs.get(date);
    const state: DayState =
      overall === "recorded" || symptomDays.has(date)
        ? "changed"
        : overall === "no_change"
          ? "no_change"
          : "missing";
    return { date, state };
  });
}

/** The most recent visual acuity for one eye, from any source, with that source kept. */
export function latestAcuity(data: AllData, eye: "right" | "left"): Measurement | undefined {
  return select(data, "measurements")
    .type("visual_acuity")
    .where((m) => m.eye === eye)
    .latest();
}

/** The next visit on or after today, if one is booked. */
export function nextAppointment(data: AllData, today: string): Appointment | undefined {
  return select(data, "appointments").since(today).order("asc").first();
}

export interface RecentEntry {
  id: string;
  when: string;
  eye: Eye;
  source: SourceType;
  title: string;
  detail?: string;
  demo?: boolean;
}

/** The latest few things written down, across symptoms, drawings, checks and measurements. */
export function recentEntries(data: AllData, limit = 4): RecentEntry[] {
  const take = <T>(rows: T[]) => rows.slice(0, limit);
  const entries: RecentEntry[] = [
    ...take(select(data, "symptoms").order().all()).map((s) => ({
      id: s.id,
      when: s.date_time,
      eye: s.eye,
      source: s.source_type,
      title: s.symptom_type,
      detail: s.baseline_comparison ? BASELINE_LABELS[s.baseline_comparison] : s.description,
      demo: s.demo,
    })),
    ...take(select(data, "drawings").order().all()).map((d) => ({
      id: d.id,
      when: d.date_time,
      eye: d.eye,
      source: d.source_type,
      title: "Drawing",
      detail: d.description,
      demo: d.demo,
    })),
    ...take(select(data, "selfTests").order().all()).map((c) => ({
      id: c.id,
      when: c.date_time,
      eye: c.eye,
      source: c.source_type,
      title: SELF_TEST_LABELS[c.kind],
      detail: c.note,
      demo: c.demo,
    })),
    ...take(select(data, "measurements").order().all()).map((m) => ({
      id: m.id,
      when: m.date,
      eye: m.eye,
      source: m.source_type,
      title: MEASUREMENT_LABELS[m.kind],
      detail: [m.value, m.unit].filter(Boolean).join(" "),
      demo: m.demo,
    })),
  ];
  return entries.sort((a, b) => b.when.localeCompare(a.when)).slice(0, limit);
}

/** A time-of-day greeting. Plain, and the same whatever the record says. */
export function greeting(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
