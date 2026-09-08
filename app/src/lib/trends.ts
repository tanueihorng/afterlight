// Numeric series from the record, described and never judged.
//
// This is the easiest place in the whole app to accidentally imply a prognosis. The rule here is
// absolute: state the numbers, the dates and the shape of the series. Never a threshold, never a
// direction word that carries a verdict ("worsening", "stable"), never a prediction, and never a
// colour that means good or bad.
//
// A clinician reading the brief gets the values. What they mean is their judgement, not ours.

import type { AllData } from "./db";
import { acuityForms } from "./acuity";
import { select } from "./query";
import type { Eye, MeasurementKind, SourceType } from "./models";
import { MEASUREMENT_LABELS, METHOD_LABELS } from "./models";
import { formatDate, isoToDateOnly } from "./util";

export interface SeriesPoint {
  date: string;
  value: number;
  /** As written by whoever recorded it, so the original is never lost. */
  raw: string;
  unit?: string;
  source: SourceType;
  /** Clinic-measured and patient-performed values are never plotted as one line. */
  provenance: "clinic" | "home";
  method?: string;
  /** Values that cannot be compared numerically (CF, HM, LP) are carried but not plotted. */
  numeric: boolean;
}

export interface Series {
  kind: MeasurementKind;
  label: string;
  eye: Eye;
  unit?: string;
  points: SeriesPoint[];
  /** Whether higher numbers mean "more of the thing"; used only for axis direction, not judgement. */
  invertForDisplay: boolean;
}

/** logMAR runs the opposite way to how people read acuity, so the axis is flipped for display. */
const INVERTED: MeasurementKind[] = ["visual_acuity"];

function provenanceOf(source: SourceType, method?: string): "clinic" | "home" {
  if (method === "home_screen_test") return "home";
  return source === "patient_reported" ? "home" : "clinic";
}

export function seriesFor(data: AllData, kind: MeasurementKind, eye: Eye): Series {
  const rows = select(data, "measurements")
    .type(kind)
    .eye(eye)
    .order("asc")
    .all();

  const points: SeriesPoint[] = [];
  for (const row of rows) {
    const raw = row.value;
    let value = Number(raw);
    let numeric = Number.isFinite(value);

    if (kind === "visual_acuity") {
      const forms = acuityForms(raw);
      if (forms.logmar !== undefined) {
        value = forms.logmar;
        numeric = true;
      } else {
        numeric = false;
      }
    }

    points.push({
      date: isoToDateOnly(row.date),
      value: numeric ? value : Number.NaN,
      raw,
      unit: row.unit,
      source: row.source_type,
      provenance: provenanceOf(row.source_type, row.method),
      method: row.method ? METHOD_LABELS[row.method] : undefined,
      numeric,
    });
  }

  return {
    kind,
    label: MEASUREMENT_LABELS[kind],
    eye,
    unit: rows.find((r) => r.unit)?.unit,
    points,
    invertForDisplay: INVERTED.includes(kind),
  };
}

/** Every series with at least one value, for the eyes given. */
export function allSeries(data: AllData, eyes: Eye[] = ["right", "left"]): Series[] {
  const kinds = new Set(data.measurements.map((m) => m.kind));
  const out: Series[] = [];
  for (const kind of kinds) {
    for (const eye of eyes) {
      const series = seriesFor(data, kind, eye);
      if (series.points.length > 0) out.push(series);
    }
  }
  return out;
}

/* ------------------------------------------------------------ describing */

export interface SeriesDescription {
  /** A factual sentence: the count, the span, and the values. */
  summary: string;
  /** Notes about the series' shape, all descriptive. */
  notes: string[];
  /** True when clinic and home values are mixed, which the reader must be told. */
  mixedProvenance: boolean;
}

/**
 * Describe a series without judging it.
 *
 * Everything here is arithmetic reported in words: how many readings, over what period, what the
 * values were, whether they were taken the same way. No verdict.
 */
export function describe(series: Series): SeriesDescription {
  const numeric = series.points.filter((p) => p.numeric);
  const notes: string[] = [];
  const provenances = new Set(series.points.map((p) => p.provenance));
  const mixedProvenance = provenances.size > 1;

  if (series.points.length === 0) {
    return { summary: `${series.label}: nothing recorded.`, notes, mixedProvenance: false };
  }

  const first = series.points[0];
  const last = series.points[series.points.length - 1];
  const unit = series.unit ? ` ${series.unit}` : "";

  const summary =
    series.points.length === 1
      ? `${series.label}: one reading, ${first.raw}${unit} on ${formatDate(first.date)}.`
      : `${series.label}: ${series.points.length} readings from ${formatDate(first.date)} to ${formatDate(last.date)} — ${series.points.map((p) => p.raw).join(", ")}${unit}.`;

  if (mixedProvenance) {
    notes.push(
      "Some of these were measured at a clinic and some were done at home. They are not the same kind of measurement and are shown separately.",
    );
  }

  const nonNumeric = series.points.filter((p) => !p.numeric);
  if (nonNumeric.length > 0) {
    notes.push(
      `${nonNumeric.length} of these (${nonNumeric.map((p) => p.raw).join(", ")}) are not numbers and are not plotted.`,
    );
  }

  if (numeric.length >= 2) {
    const values = numeric.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    notes.push(`Recorded values range from ${format(min)} to ${format(max)}${unit}.`);

    // Say only what the arithmetic says: the direction between the first and last readings, with
    // no word implying whether that is good, bad, expected or concerning.
    const change = values[values.length - 1] - values[0];
    if (change !== 0) {
      notes.push(
        `The most recent reading is ${format(Math.abs(change))}${unit} ${change > 0 ? "higher" : "lower"} than the first.`,
      );
    } else {
      notes.push("The first and most recent readings are the same number.");
    }

    // Variability, as a fact about the numbers.
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const spread = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    if (spread > 0) notes.push(`They vary by about ${format(spread)}${unit} around their average.`);
  }

  return { summary, notes, mixedProvenance };
}

function format(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/* ------------------------------------------------- same as last time? */

export interface PriorInstance<T> {
  record: T;
  date: string;
  /** How long before the one being compared. */
  daysBefore: number;
}

/**
 * Every earlier instance of the same thing, for the "is this the same as last time?" question a
 * clinician actually asks. The answer is the patient's to give; this only lays them side by side.
 */
export function priorInstances(
  data: AllData,
  symptomType: string,
  eye: Eye,
  beforeDate: string,
  limit = 8,
): PriorInstance<AllData["symptoms"][number]>[] {
  const rows = select(data, "symptoms")
    .type(symptomType)
    .eye(eye)
    .before(beforeDate)
    .order("desc")
    .limit(limit)
    .all();

  const target = new Date(beforeDate).getTime();
  return rows.map((record) => {
    const date = isoToDateOnly(record.date_time);
    return {
      record,
      date,
      daysBefore: Math.round((target - new Date(date).getTime()) / 86_400_000),
    };
  });
}
