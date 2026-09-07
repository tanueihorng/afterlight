// Global search across every stored record type (§35).
// Purely local: nothing leaves the browser, and every hit carries its provenance.

import type { AllData } from "./db";
import type { Eye, SourceType } from "./models";
import { EYE_SHORT, MEASUREMENT_LABELS } from "./models";
import type { Route } from "./router";
import { formatDate } from "./util";

export interface SearchHit {
  id: string;
  kind: string;
  title: string;
  snippet: string;
  date: string; // YYYY-MM-DD
  eye: Eye;
  source_type: SourceType;
  route: Route;
  demo?: boolean;
  score: number;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Parsed query: free-text terms plus optional eye and month/year filters. */
interface ParsedQuery {
  terms: string[];
  eye?: "right" | "left";
  monthPrefix?: string; // YYYY-MM
  year?: string; // YYYY
}

export function parseQuery(raw: string): ParsedQuery {
  let q = raw.toLowerCase().trim();
  const parsed: ParsedQuery = { terms: [] };

  if (/\b(left|os)\b/.test(q) && !/\bright\b/.test(q)) parsed.eye = "left";
  else if (/\b(right|od)\b/.test(q) && !/\bleft\b/.test(q)) parsed.eye = "right";

  // The eye is now a filter, so drop its words from the free-text terms. Leaving them in would
  // require the word "left" to appear in the record text, which silently excludes both-eye
  // records — they read "Both (OU)" — from a search the user meant to include them in.
  if (parsed.eye) q = q.replace(/\b(left|right|os|od)\b/g, " ");

  // "Aug 2026", "August 2026", "2026-08", "2026"
  const monthYear = q.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/,
  );
  if (monthYear) {
    const idx = MONTHS.findIndex((m) => m.startsWith(monthYear[1]));
    if (idx >= 0) parsed.monthPrefix = `${monthYear[2]}-${String(idx + 1).padStart(2, "0")}`;
    q = q.replace(monthYear[0], " ");
  } else {
    const iso = q.match(/\b(\d{4})-(\d{2})\b/);
    if (iso) {
      parsed.monthPrefix = `${iso[1]}-${iso[2]}`;
      q = q.replace(iso[0], " ");
    } else {
      const year = q.match(/\b(19|20)\d{2}\b/);
      if (year) {
        parsed.year = year[0];
        q = q.replace(year[0], " ");
      }
    }
  }

  parsed.terms = q
    .split(/[^a-z0-9/+.-]+/)
    .map((t) => t.trim())
    .filter(
      (t) => t.length > 1 && !["the", "and", "for", "eye", "eyes", "was", "any"].includes(t),
    );

  return parsed;
}

/** One indexed record, flattened to searchable text. */
interface IndexRow extends Omit<SearchHit, "score"> {
  haystack: string;
}

const j = (...parts: (string | undefined | null | number)[]) =>
  parts.filter((p) => p !== undefined && p !== null && p !== "").join(" · ");

export function buildIndex(s: AllData): IndexRow[] {
  const rows: IndexRow[] = [];
  const push = (r: Omit<IndexRow, "haystack">, extra: (string | undefined)[]) => {
    rows.push({
      ...r,
      haystack: [r.title, r.snippet, r.kind, EYE_SHORT[r.eye], ...extra]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    });
  };

  for (const x of s.symptoms) {
    push(
      {
        id: `symptom:${x.id}`,
        kind: "Symptom",
        title: x.symptom_type,
        snippet: j(
          x.severity !== undefined ? `Severity ${x.severity}/10` : undefined,
          x.frequency,
          x.description,
        ),
        date: x.date_time.slice(0, 10),
        eye: x.eye,
        source_type: x.source_type,
        route: "timeline",
        demo: x.demo,
      },
      [x.status, x.baseline_comparison, x.trigger, x.onset, x.duration],
    );
  }

  for (const x of s.dailyLogs) {
    if (!x.note && x.overall === "no_change") continue;
    push(
      {
        id: `log:${x.id}`,
        kind: "Daily log",
        title: x.overall === "no_change" ? "No change recorded" : "Daily log",
        snippet: x.note ?? "",
        date: x.date,
        eye: "not_applicable",
        source_type: x.source_type,
        route: "timeline",
        demo: x.demo,
      },
      [],
    );
  }

  for (const x of s.floaters) {
    push(
      {
        id: `floater:${x.id}`,
        kind: "Floater",
        title: x.nickname || `${x.shape} floater`,
        snippet: j(x.shape, x.size, x.opacity, x.appearance),
        date: x.first_seen.slice(0, 10),
        eye: x.eye,
        source_type: x.source_type,
        route: "my-eyes",
        demo: x.demo,
      },
      [x.status, x.motion, x.persistence, "floaters"],
    );
  }

  for (const x of s.drawings) {
    push(
      {
        id: `drawing:${x.id}`,
        kind: "Drawing",
        title: "What I See drawing",
        snippet: x.description ?? "",
        date: x.date_time.slice(0, 10),
        eye: x.eye,
        source_type: x.source_type,
        route: "what-i-see",
        demo: x.demo,
      },
      ["visual field", "drawing", ...x.canvas_data.marks.map((m) => m.tool), ...x.canvas_data.marks.map((m) => m.text)],
    );
  }

  for (const x of s.appointments) {
    push(
      {
        id: `appointment:${x.id}`,
        kind: "Appointment",
        title: x.reason || "Appointment",
        snippet: j(x.clinic, x.clinician, x.specialty, x.notes),
        date: x.date_time.slice(0, 10),
        eye: "not_applicable",
        source_type: "clinician_reported",
        route: "appointments",
        demo: x.demo,
      },
      x.actions ?? [],
    );
  }

  for (const x of s.questions) {
    push(
      {
        id: `question:${x.id}`,
        kind: "Question for doctor",
        title: x.text,
        snippet: x.answer ?? "",
        date: x.created_at.slice(0, 10),
        eye: "not_applicable",
        source_type: "patient_reported",
        route: "appointments",
        demo: x.demo,
      },
      [x.status],
    );
  }

  for (const x of s.diagnoses) {
    push(
      {
        id: `diagnosis:${x.id}`,
        kind: "Diagnosis",
        title: x.name,
        snippet: j(x.clinician, x.clinic, x.notes),
        date: x.first_documented,
        eye: x.eye,
        source_type: x.source_type,
        route: "my-eyes",
        demo: x.demo,
      },
      [x.status],
    );
  }

  for (const x of s.procedures) {
    push(
      {
        id: `procedure:${x.id}`,
        kind: "Procedure",
        title: x.procedure_type,
        snippet: j(x.surgeon, x.facility, x.indication, x.outcome),
        date: x.date,
        eye: x.eye,
        source_type: "clinician_reported",
        route: "my-eyes",
        demo: x.demo,
      },
      [x.operative_note, "surgery"],
    );
  }

  for (const x of s.medications) {
    push(
      {
        id: `medication:${x.id}`,
        kind: x.kind === "prescription" ? "Medication" : "Self-care",
        title: x.name,
        snippet: j(x.dose, x.frequency, x.reason),
        date: x.start_date,
        eye: x.eye,
        source_type: "clinician_reported",
        route: "my-eyes",
        demo: x.demo,
      },
      [x.prescribed_by, x.notes, "treatment", "drops"],
    );
  }

  for (const x of s.prescriptions) {
    const fmt = (e: { sphere?: number; cylinder?: number; axis?: number; acuity?: string }) =>
      j(
        e.sphere !== undefined ? `SPH ${e.sphere}` : undefined,
        e.cylinder !== undefined ? `CYL ${e.cylinder}` : undefined,
        e.axis !== undefined ? `AX ${e.axis}` : undefined,
        e.acuity,
      );
    push(
      {
        id: `prescription:${x.id}`,
        kind: "Prescription",
        title: "Glasses prescription",
        snippet: `OD ${fmt(x.right_eye) || "—"} / OS ${fmt(x.left_eye) || "—"}`,
        date: x.date,
        eye: "both",
        source_type: "clinician_reported",
        route: "my-eyes",
        demo: x.demo,
      },
      [x.provider, x.notes, "glasses", "lens"],
    );
  }

  for (const x of s.measurements) {
    push(
      {
        id: `measurement:${x.id}`,
        kind: "Measurement",
        title: `${MEASUREMENT_LABELS[x.kind]} ${x.value}${x.unit ? ` ${x.unit}` : ""}`,
        snippet: x.note ?? "",
        date: x.date,
        eye: x.eye,
        source_type: x.source_type,
        route: "my-eyes",
        demo: x.demo,
      },
      [x.kind === "iop" ? "pressure" : undefined, x.kind === "visual_acuity" ? "acuity vision" : undefined],
    );
  }

  for (const x of s.imaging) {
    push(
      {
        id: `imaging:${x.id}`,
        kind: x.modality,
        title: `${x.modality} scan`,
        snippet: j(x.clinic, x.device, x.clinician_interpretation || x.findings),
        date: x.date,
        eye: x.eye,
        source_type: x.source_type,
        route: "imaging",
        demo: x.demo,
      },
      [x.patient_notes, "scan imaging"],
    );
  }

  for (const x of s.documents) {
    push(
      {
        id: `document:${x.id}`,
        kind: "Document",
        title: x.title,
        snippet: j(x.doc_type, x.clinic, x.clinician, x.summary),
        date: x.date,
        eye: x.eye,
        source_type: x.source_type,
        route: "imaging",
        demo: x.demo,
      },
      [x.doc_type, "letter report"],
    );
  }

  for (const x of s.baselines) {
    push(
      {
        id: `baseline:${x.id}`,
        kind: "Baseline",
        title: `${x.id === "right" ? "Right" : "Left"} eye baseline`,
        snippet: x.text,
        date: x.established_date,
        eye: x.id,
        source_type: "patient_reported",
        route: "my-eyes",
        demo: x.demo,
      },
      ["usual normal baseline"],
    );
  }

  for (const x of s.briefs) {
    push(
      {
        id: `brief:${x.id}`,
        kind: "Appointment brief",
        title: `Brief ${formatDate(x.range_start)} → ${formatDate(x.range_end)}`,
        snippet: "Saved appointment brief",
        date: x.created_at.slice(0, 10),
        eye: "both",
        source_type: "ai_generated",
        route: "appointments",
        demo: x.demo,
      },
      [],
    );
  }

  return rows;
}

export function searchRecords(s: AllData, raw: string, limit = 40): SearchHit[] {
  const q = parseQuery(raw);
  if (!q.terms.length && !q.eye && !q.monthPrefix && !q.year) return [];
  const rows = buildIndex(s);
  const hits: SearchHit[] = [];

  for (const row of rows) {
    if (q.eye && row.eye !== q.eye && row.eye !== "both") continue;
    if (q.monthPrefix && !row.date.startsWith(q.monthPrefix)) continue;
    if (q.year && !row.date.startsWith(q.year)) continue;

    let score = 0;
    let matchedAll = true;
    for (const term of q.terms) {
      if (row.title.toLowerCase().includes(term)) score += 3;
      else if (row.haystack.includes(term)) score += 1;
      else matchedAll = false;
    }
    if (q.terms.length && !matchedAll) continue;
    // A pure date/eye query matches everything in range.
    if (!q.terms.length) score = 1;
    // Recency nudge so the newest matching record surfaces first.
    hits.push({ ...row, score: score * 1000 + dateRank(row.date) });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

function dateRank(date: string): number {
  const t = Date.parse(date);
  return Number.isNaN(t) ? 0 : Math.floor(t / 86_400_000);
}
