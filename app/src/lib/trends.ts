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
  /** Overrides the clinic/home wording where neither is true, e.g. a copied prescription. */
  howLabel?: string;
}

/** Prescription components are charted alongside measurements but are not measurement kinds. */
export type RxComponent = "sphere" | "cylinder";

export interface Series {
  kind: MeasurementKind | `rx_${RxComponent}`;
  label: string;
  eye: Eye;
  unit?: string;
  points: SeriesPoint[];
  /** Whether higher numbers mean "more of the thing"; used only for axis direction, not judgement. */
  invertForDisplay: boolean;
  /** What one point is called. Defaults to "reading"; a prescription is an entry, not a reading. */
  noun?: { one: string; many: string };
  /**
   * Set when differences between points may not be real changes — plus- and minus-cylinder forms
   * of one lens differ in both sphere and cylinder. The arithmetic notes are then left out.
   */
  mixedCylinderForms?: boolean;
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
    .where((row) => row.source_type !== "document_extracted" || row.confirmed === true)
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

/** Signed the way a prescription is written, so "+1.25" never reads as "1.25". */
export function signedDioptres(value: number): string {
  const fixed = value.toFixed(2);
  return value > 0 ? `+${fixed}` : fixed;
}

// The record does not say whether a prescription is for glasses or contact lenses, so neither is
// claimed here.
const RX_LABELS: Record<RxComponent, string> = {
  sphere: "Prescription — sphere",
  cylinder: "Prescription — cylinder",
};

const RX_NOUN = { one: "entry", many: "entries" };

/**
 * One component of the glasses and contact prescriptions for one eye, oldest first.
 *
 * Axis is deliberately not offered: it is an angle that wraps at 180°, so 175° and 5° are nearly
 * the same and a line between them would draw a change that is not there.
 */
export function prescriptionSeries(
  data: AllData,
  component: RxComponent,
  eye: "right" | "left",
): Series {
  const rows = select(data, "prescriptions").order("asc").all();
  const cylinders = rows
    .map((row) => (eye === "right" ? row.right_eye : row.left_eye)?.cylinder)
    .filter((c): c is number => c != null && Number.isFinite(c));
  const mixedCylinderForms = cylinders.some((c) => c > 0) && cylinders.some((c) => c < 0);
  const points: SeriesPoint[] = [];
  for (const row of rows) {
    const value = (eye === "right" ? row.right_eye : row.left_eye)?.[component];
    if (value == null || !Number.isFinite(value)) continue;
    points.push({
      date: isoToDateOnly(row.date),
      value,
      raw: signedDioptres(value),
      unit: "D",
      // Prescriptions carry no source of their own: the person typed these in. "clinic" here only
      // means the points are one kind and may be joined; the wording comes from howLabel.
      source: "patient_reported",
      provenance: "clinic",
      howLabel: "Copied by you from a written prescription",
      numeric: true,
    });
  }
  return {
    kind: `rx_${component}`,
    label: RX_LABELS[component],
    eye,
    unit: "D",
    points,
    invertForDisplay: false,
    noun: RX_NOUN,
    mixedCylinderForms,
  };
}

/** Sphere and cylinder for each eye, keeping only those with something recorded. */
export function allPrescriptionSeries(data: AllData): Series[] {
  const out: Series[] = [];
  for (const component of ["sphere", "cylinder"] as RxComponent[]) {
    for (const eye of ["right", "left"] as const) {
      const series = prescriptionSeries(data, component, eye);
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

  const noun = series.noun ?? { one: "reading", many: "readings" };
  const summary =
    series.points.length === 1
      ? `${series.label}: one ${noun.one}, ${first.raw}${unit} on ${formatDate(first.date)}.`
      : `${series.label}: ${series.points.length} ${noun.many} from ${formatDate(first.date)} to ${formatDate(last.date)} — ${series.points.map((p) => p.raw).join(", ")}${unit}.`;

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

  if (numeric.length >= 2 && !series.mixedCylinderForms) {
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
