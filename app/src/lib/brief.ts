// "Prepare for appointment" + "What changed?" summarisation.
// This is an organisational summary of stored records — never a medical interpretation.

import type { AllData } from "./db";
import type { BriefPayload, Eye } from "./models";
import { isoToDateOnly } from "./util";

export interface BriefOptions {
  range_start: string; // YYYY-MM-DD inclusive
  range_end: string; // YYYY-MM-DD inclusive
}

export function defaultBriefRange(s: AllData, opts?: { beforeApptId?: string }): BriefOptions {
  // Default: since the previous appointment (before the next upcoming one), else last 30 days.
  const now = new Date();
  const nowISODate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const appts = [...s.appointments].sort((a, b) => (a.date_time < b.date_time ? 1 : -1));
  let upcoming = appts.find((a) => a.date_time >= now.toISOString());
  if (opts?.beforeApptId) {
    const target = s.appointments.find((a) => a.id === opts.beforeApptId);
    if (target) {
      upcoming = target;
    }
  }
  if (upcoming) {
    const sorted = appts.filter((a) => a.date_time < upcoming!.date_time);
    const prev = sorted[0];
    const start = prev ? isoToDateOnly(prev.date_time) : shiftDay(isoToDateOnly(upcoming.date_time), -30);
    return { range_start: start, range_end: isoToDateOnly(upcoming.date_time) };
  }
  return { range_start: shiftDay(nowISODate, -30), range_end: nowISODate };
}

function shiftDay(s: string, n: number): string {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function describeSymptom(x: AllData["symptoms"][number]): string {
  const parts: string[] = [];
  if (x.baseline_comparison === "new") parts.push("new");
  if (x.status === "new") parts.push("first recorded");
  const sev = x.severity != null && x.severity > 0 ? ` (severity ${x.severity}/10)` : "";
  const desc = x.description ? ` — ${x.description}` : "";
  const cmp =
    x.baseline_comparison && x.baseline_comparison !== "new" && x.baseline_comparison !== "same_as_usual"
      ? ` (compared with usual: ${x.baseline_comparison.replace(/_/g, " ")})`
      : "";
  const date = humanDate(x.date_time);
  return `${capitalize(x.symptom_type)}${sev}${desc}${cmp} — recorded ${date}`.trim();
}

function humanDate(iso: string): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function ordinal(n: number): string {
  const suffix = n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th";
  return `${n}${suffix}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateBrief(s: AllData, opts: BriefOptions): BriefPayload {
  const start = opts.range_start;
  const end = `${opts.range_end}T23:59:59.999Z`;
  const inRange = (iso: string) => {
    const dOnly = isoToDateOnly(iso);
    return dOnly >= start && dOnly <= end.slice(0, 10);
  };

  const payload: BriefPayload = {
    generated_at: new Date().toISOString(),
    range_start: start,
    range_end: opts.range_end,
    perEye: {
      right: { new: [], unchanged: [], improved: [], worse: [] },
      left: { new: [], unchanged: [], improved: [], worse: [] },
    },
    drawings: [],
    clinicalEvents: [],
    treatment: [],
    questions: [],
  };

  for (const eye of ["right", "left"] as const) {
    const rows = s.symptoms
      .filter((x) => inRange(x.date_time) && (x.eye === eye || x.eye === "both"))
      .sort((a, b) => (a.date_time < b.date_time ? 1 : -1));
    for (const x of rows) {
      const text = describeSymptom(x);
      if (x.status === "new" || x.baseline_comparison === "new") {
        payload.perEye[eye].new.push(text);
      } else if (x.status === "better" || x.status === "resolved") {
        payload.perEye[eye].improved.push(text);
      } else if (x.status === "worse") {
        payload.perEye[eye].worse.push(text);
      } else {
        payload.perEye[eye].unchanged.push(text);
      }
    }
    // dedupe
    for (const k of ["new", "unchanged", "improved", "worse"] as const) {
      payload.perEye[eye][k] = Array.from(new Set(payload.perEye[eye][k]));
    }
    if (payload.perEye[eye].new.length === 0 && payload.perEye[eye].improved.length === 0 && payload.perEye[eye].worse.length === 0 && payload.perEye[eye].unchanged.length === 0) {
      payload.perEye[eye].unchanged.push(`No symptoms recorded for the ${eye} eye in this period.`);
    }
  }

  payload.drawings = s.drawings
    .filter((d) => inRange(d.date_time))
    .sort((a, b) => (a.date_time < b.date_time ? 1 : -1))
    .map((d) => ({
      id: d.id,
      date_time: d.date_time,
      eye: d.eye,
      thumbnail: d.thumbnail,
      description: d.description,
    }));

  for (const i of s.imaging.filter((i) => inRange(i.date))) {
    payload.clinicalEvents.push({
      date: i.date,
      kind: i.modality.toUpperCase(),
      title: [i.clinic, i.findings].filter(Boolean).join(" · ") || "Imaging",
    });
  }
  for (const a of s.appointments.filter((a) => inRange(a.date_time))) {
    payload.clinicalEvents.push({
      date: isoToDateOnly(a.date_time),
      kind: "Appointment",
      title: [a.reason, a.clinic, a.clinician].filter(Boolean).join(" · ") || "Clinic visit",
    });
  }
  for (const p of s.procedures.filter((p) => inRange(p.date))) {
    payload.clinicalEvents.push({ date: p.date, kind: "Procedure", title: p.procedure_type });
  }
  for (const d of s.diagnoses.filter((d) => inRange(d.first_documented))) {
    payload.clinicalEvents.push({
      date: d.first_documented,
      kind: "Diagnosis",
      title: `${d.name} (${d.eye})`,
    });
  }
  payload.clinicalEvents.sort((a, b) => (a.date < b.date ? 1 : -1));

  for (const m of s.medications) {
    const active = !m.end_date || m.end_date >= start;
    const startedInRange = inRange(m.start_date);
    if (active && startedInRange) {
      payload.treatment.push(
        `${m.name}${m.dose ? ` ${m.dose}` : ""}${m.frequency ? `, ${m.frequency}` : ""} — started ${m.start_date} (${m.kind === "prescription" ? `prescribed by ${m.prescribed_by || "clinician"}` : "self-care"})`
      );
    } else if (active) {
      payload.treatment.push(
        `${m.name}${m.dose ? ` ${m.dose}` : ""}${m.frequency ? `, ${m.frequency}` : ""} — ongoing (since ${m.start_date})`
      );
    }

    // An injection series is a cycle, and "3rd injection, 6-week interval, most recent 12 Aug" is
    // the sentence a clinic actually needs — a start date alone does not carry it.
    if (m.pattern === "injection_series" && active) {
      const parts = [
        m.cycle_number ? `${ordinal(m.cycle_number)} injection` : "injection series",
        m.interval_weeks ? `${m.interval_weeks}-week interval` : undefined,
        m.last_given ? `most recent ${humanDate(m.last_given)}` : undefined,
      ].filter(Boolean);
      payload.treatment.push(`${m.name} — ${parts.join(", ")}`);
    }
    if (m.pattern === "taper" && active) {
      payload.treatment.push(`${m.name} — reducing dose, started ${humanDate(m.start_date)}`);
    }
  }

  // Checks the patient did themselves, always badged as such and never mixed with clinic results.
  for (const t of s.selfTests) {
    if (!inRange(t.date_time)) continue;
    payload.clinicalEvents.push({
      date: isoToDateOnly(t.date_time),
      kind: "Check done by patient",
      title: `${t.kind.replace(/_/g, " ")} — ${t.eye === "right" ? "right eye" : "left eye"}${
        t.result.notation ? `, ${t.result.notation}` : ""
      }`,
    });
  }

  payload.questions = s.questions
    .filter((q) => q.status === "pending" || q.status === "follow_up")
    .map((q) => q.text);

  return payload;
}

/** Compact "what changed" counts for the appointments dashboard. */
export function changesSince(s: AllData, sinceISODate: string, untilISODate: string) {
  const inRange = (d: string) => {
    const dOnly = isoToDateOnly(d);
    return dOnly >= sinceISODate && dOnly <= untilISODate;
  };
  const newSymptoms = s.symptoms.filter((x) => inRange(x.date_time) && (x.status === "new" || x.baseline_comparison === "new"));
  const updates = s.symptoms.filter((x) => inRange(x.date_time) && x.status !== "new");
  const drawings = s.drawings.filter((d) => inRange(d.date_time));
  const imaging = s.imaging.filter((i) => inRange(i.date));
  return {
    newSymptoms: newSymptoms.length,
    updates: updates.length,
    drawings: drawings.length,
    imaging: imaging.length,
  };
}

export function eyeName(eye: Eye): string {
  return eye === "right" ? "Right eye (OD)" : eye === "left" ? "Left eye (OS)" : "Both eyes (OU)";
}
