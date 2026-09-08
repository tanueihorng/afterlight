// Visual acuity notation.
//
// Clinics write acuity in whichever notation they use — 6/6, 20/20, logMAR 0.0, decimal 1.0 — and
// a patient's own records end up mixed. Conversion is arithmetic, not interpretation: the same
// measurement written a different way. Nothing here judges whether a value is good or bad.

export type AcuityNotation = "snellen6" | "snellen20" | "logmar" | "decimal";

export const ACUITY_NOTATION_LABELS: Record<AcuityNotation, string> = {
  snellen6: "Snellen (6m)",
  snellen20: "Snellen (20ft)",
  logmar: "logMAR",
  decimal: "decimal",
};

/**
 * Acuities that are not fractions. These are ordered, but they are not numbers and must never be
 * plotted as though they were.
 */
export const NON_NUMERIC_ACUITY = ["CF", "HM", "LP", "NLP"] as const;
export type NonNumericAcuity = (typeof NON_NUMERIC_ACUITY)[number];

export const NON_NUMERIC_LABELS: Record<NonNumericAcuity, string> = {
  CF: "Counting fingers",
  HM: "Hand movements",
  LP: "Light perception",
  NLP: "No light perception",
};

export interface ParsedAcuity {
  /** logMAR value, the only form that can be averaged or compared arithmetically. */
  logmar?: number;
  nonNumeric?: NonNumericAcuity;
  raw: string;
}

const SNELLEN = /^\s*(\d+(?:\.\d+)?)\s*[/:]\s*(\d+(?:\.\d+)?)\s*$/;

export function parseAcuity(raw: string, notation?: AcuityNotation): ParsedAcuity {
  const text = raw.trim();
  const upper = text.toUpperCase().replace(/\s+/g, "");

  const nonNumeric = NON_NUMERIC_ACUITY.find((n) => n === upper);
  if (nonNumeric) return { nonNumeric, raw: text };

  const snellen = text.match(SNELLEN);
  if (snellen) {
    const numerator = Number(snellen[1]);
    const denominator = Number(snellen[2]);
    if (numerator > 0 && denominator > 0) {
      return { logmar: round(Math.log10(denominator / numerator)), raw: text };
    }
  }

  const value = Number(text);
  if (!Number.isNaN(value)) {
    if (notation === "decimal") {
      return value > 0 ? { logmar: round(-Math.log10(value)), raw: text } : { raw: text };
    }
    if (notation === "logmar") return { logmar: round(value), raw: text };
    // Unlabelled bare numbers are ambiguous; do not guess.
  }

  return { raw: text };
}

function round(n: number): number {
  // Three places, and never negative zero: a logMAR of exactly 0 is 6/6, not "-0".
  const value = Math.round(n * 1000) / 1000;
  return value === 0 ? 0 : value;
}

export function logmarToSnellen(logmar: number, base: 6 | 20 = 6): string {
  const denominator = base * 10 ** logmar;
  // Whole numbers at ordinary acuities; one decimal only for the better-than-standard end, where
  // 6/4.8 is a real notation and 6/5 would be a different measurement.
  const rounded = denominator >= 5 ? Math.round(denominator) : Math.round(denominator * 10) / 10;
  return `${base}/${rounded}`;
}

export function logmarToDecimal(logmar: number): number {
  return round(10 ** -logmar);
}

export interface AcuityForms extends ParsedAcuity {
  /** What to show: the value as written, or the words for a non-numeric acuity. */
  label: string;
  snellen6?: string;
  snellen20?: string;
  decimal?: number;
}

/** Every notation for one measurement, so a mixed record can be read as one series. */
export function acuityForms(raw: string, notation?: AcuityNotation): AcuityForms {
  const parsed = parseAcuity(raw, notation);
  if (parsed.nonNumeric) {
    return {
      ...parsed,
      label: NON_NUMERIC_LABELS[parsed.nonNumeric],
      snellen6: undefined,
      snellen20: undefined,
      decimal: undefined,
    };
  }
  if (parsed.logmar === undefined) return { ...parsed, label: parsed.raw };
  return {
    ...parsed,
    label: parsed.raw,
    snellen6: logmarToSnellen(parsed.logmar, 6),
    snellen20: logmarToSnellen(parsed.logmar, 20),
    decimal: logmarToDecimal(parsed.logmar),
  };
}

/**
 * Whether two acuities can be compared as numbers at all. Non-numeric acuities and unparseable
 * values cannot; saying so is better than plotting them as zero.
 */
export function comparable(a: ParsedAcuity, b: ParsedAcuity): boolean {
  return a.logmar !== undefined && b.logmar !== undefined;
}
