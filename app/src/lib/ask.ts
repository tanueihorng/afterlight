// "Ask my records" (§34) — a deterministic, offline query layer over the patient's own data.
//
// Design rule from the product context: never invent clinical content. Every answer is
// assembled from stored records and carries citations back to them. When the records do not
// contain an answer, say exactly that.

import type { AllData } from "./db";
import { generateBrief } from "./brief";
import type { Eye, SymptomEntry } from "./models";
import { EYE_SHORT, MEASUREMENT_LABELS, SOURCE_LABELS } from "./models";
import type { Route } from "./router";
import { searchRecords, parseQuery } from "./search";
import { dateOf, select, type Entity } from "./query";
import { describe as describeSeries, seriesFor } from "./trends";
import type { MeasurementKind } from "./models";
import { addDays, formatDate, isoToDateOnly, todayLocal } from "./util";

export interface Citation {
  label: string; // e.g. "Daily symptom log — 22 Aug 2026"
  route: Route;
}

export interface AskAnswer {
  /** Paragraphs of answer text. Empty when nothing was found. */
  lines: string[];
  citations: Citation[];
  found: boolean;
  /** Short label describing which query the engine matched, for transparency. */
  interpretation: string;
}

export const NOT_FOUND = "I could not find that in your stored records.";

export const EXAMPLE_QUESTIONS = [
  "When did glare in my left eye first appear?",
  "Show every OCT after my surgery",
  "What symptoms did I report between my last two appointments?",
  "When was the first new floater recorded this year?",
  "What did my doctors document about the macula?",
  "Compare my two most recent prescriptions",
  "What questions did I want to ask at my previous appointment?",
  "Summarize what changed since my last review",
];

const notFound = (interpretation: string): AskAnswer => ({
  lines: [NOT_FOUND],
  citations: [],
  found: false,
  interpretation,
});

const eyeWord = (e: Eye) => EYE_SHORT[e];

function symptomCitation(s: SymptomEntry): Citation {
  return { label: `Daily symptom log — ${formatDate(s.date_time.slice(0, 10))}`, route: "timeline" };
}

/** Symptom terms mentioned in the question, matched against what is actually stored. */
function matchedSymptomTypes(data: AllData, q: string): string[] {
  const present = Array.from(new Set(data.symptoms.map((s) => s.symptom_type)));
  return present.filter((t) => {
    const head = t.split(" / ")[0].toLowerCase();
    return q.includes(head) || q.includes(t.toLowerCase());
  });
}

export function askRecords(data: AllData, rawQuestion: string): AskAnswer {
  const q = rawQuestion.toLowerCase().trim();
  if (!q) return { lines: [], citations: [], found: false, interpretation: "" };
  const parsed = parseQuery(rawQuestion);
  const eye = parsed.eye;

  // ---- 1. "When did X first appear / start?" -------------------------------
  if (/\b(when|first)\b/.test(q) && /\b(appear|start|begin|record|notice|see|onset|happen)/.test(q)) {
    const types = matchedSymptomTypes(data, q);
    if (types.length) {
      const candidates = data.symptoms
        .filter((s) => types.includes(s.symptom_type))
        .filter((s) => (eye ? s.eye === eye || s.eye === "both" : true))
        .filter((s) => (parsed.year ? s.date_time.startsWith(parsed.year) : true))
        .sort((a, b) => a.date_time.localeCompare(b.date_time));
      if (!candidates.length) {
        return notFound(`First recorded ${types.join(", ")}${eye ? ` — ${eyeWord(eye)}` : ""}`);
      }
      const first = candidates[0];
      const lines = [
        `Your first recorded ${first.symptom_type} entry${
          first.eye !== "not_applicable" ? ` for the ${eyeWord(first.eye).toLowerCase()}` : ""
        } was on ${formatDate(first.date_time.slice(0, 10))}.`,
      ];
      if (first.description) lines.push(`Recorded description: "${first.description}"`);
      if (first.severity !== undefined) lines.push(`Severity recorded at the time: ${first.severity}/10.`);
      lines.push(
        `${candidates.length} entr${candidates.length === 1 ? "y" : "ies"} of this symptom ${
          candidates.length === 1 ? "is" : "are"
        } stored, most recently on ${formatDate(candidates[candidates.length - 1].date_time.slice(0, 10))}.`,
      );
      return {
        lines,
        citations: [symptomCitation(first), symptomCitation(candidates[candidates.length - 1])].filter(
          (c, i, a) => a.findIndex((x) => x.label === c.label) === i,
        ),
        found: true,
        interpretation: `First recorded ${first.symptom_type}${eye ? ` — ${eyeWord(eye)}` : ""}`,
      };
    }

    if (/floater/.test(q)) {
      const floaters = [...data.floaters]
        .filter((f) => (eye ? f.eye === eye || f.eye === "both" : true))
        .filter((f) => (parsed.year ? f.first_seen.startsWith(parsed.year) : true))
        .sort((a, b) => a.first_seen.localeCompare(b.first_seen));
      if (!floaters.length) return notFound("First recorded floater");
      const f = floaters[0];
      return {
        lines: [
          `The first floater recorded${parsed.year ? ` in ${parsed.year}` : ""} was ${
            f.nickname ? `"${f.nickname}"` : `a ${f.shape} floater`
          } in the ${eyeWord(f.eye).toLowerCase()}, first seen on ${formatDate(f.first_seen.slice(0, 10))}.`,
          `It is currently marked ${f.status}.`,
        ],
        citations: [{ label: `Floater record — first seen ${formatDate(f.first_seen.slice(0, 10))}`, route: "my-eyes" }],
        found: true,
        interpretation: "First recorded floater",
      };
    }
  }

  // ---- 2. Imaging queries ("show every OCT after my surgery") --------------
  if (/\b(oct|scan|imaging|fundus|photo|angiograph|visual field test)\b/.test(q) || /\bshow every\b/.test(q)) {
    const modality = /\boct\b/.test(q)
      ? "OCT"
      : /fundus|photo/.test(q)
        ? "fundus"
        : /visual field/.test(q)
          ? "visual_field"
          : undefined;

    let cutoff: string | undefined;
    let cutoffLabel = "";
    if (/\bafter\b/.test(q) && /(surgery|vitrectomy|buckle|procedure|operation)/.test(q)) {
      const proc = [...data.procedures].sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!proc) return notFound("Imaging after surgery");
      cutoff = proc.date;
      cutoffLabel = ` after your ${proc.procedure_type} on ${formatDate(proc.date)}`;
    }

    const scans = data.imaging
      .filter((i) => (modality ? i.modality === modality : true))
      .filter((i) => (eye ? i.eye === eye || i.eye === "both" : true))
      .filter((i) => (cutoff ? i.date >= cutoff : true))
      .filter((i) => (parsed.monthPrefix ? i.date.startsWith(parsed.monthPrefix) : true))
      .filter((i) => (parsed.year ? i.date.startsWith(parsed.year) : true))
      .sort((a, b) => b.date.localeCompare(a.date));

    if (!scans.length) return notFound(`${modality ?? "Imaging"} records${cutoffLabel}`);

    return {
      lines: [
        `${scans.length} ${modality ?? "imaging"} record${scans.length === 1 ? "" : "s"} stored${cutoffLabel}:`,
        ...scans.map(
          (i) =>
            `• ${formatDate(i.date)} — ${i.modality}, ${eyeWord(i.eye).toLowerCase()}${
              i.clinic ? `, ${i.clinic}` : ""
            }${i.clinician_interpretation ? ` — documented: "${i.clinician_interpretation}"` : ""}`,
        ),
      ],
      citations: scans.slice(0, 6).map((i) => ({
        label: `${i.modality} — ${formatDate(i.date)} (${SOURCE_LABELS[i.source_type]})`,
        route: "imaging" as Route,
      })),
      found: true,
      interpretation: `${modality ?? "Imaging"} records${cutoffLabel}`,
    };
  }

  // ---- 3. Symptoms between the last two appointments -----------------------
  if (/symptom/.test(q) && /(between|since)/.test(q) && /(appointment|review|visit)/.test(q)) {
    const past = data.appointments
      .filter((a) => a.date_time.slice(0, 10) <= new Date().toISOString().slice(0, 10))
      .sort((a, b) => b.date_time.localeCompare(a.date_time));
    if (past.length < 2) return notFound("Symptoms between the last two appointments");
    const [latest, previous] = past;
    const start = previous.date_time.slice(0, 10);
    const end = latest.date_time.slice(0, 10);
    const entries = data.symptoms
      .filter((s) => {
        const d = s.date_time.slice(0, 10);
        return d >= start && d <= end;
      })
      .filter((s) => (eye ? s.eye === eye || s.eye === "both" : true))
      .sort((a, b) => a.date_time.localeCompare(b.date_time));

    if (!entries.length) return notFound("Symptoms between the last two appointments");

    const byEye = (e: "right" | "left") =>
      entries.filter((s) => s.eye === e || s.eye === "both");
    const summarise = (e: "right" | "left") => {
      const list = byEye(e);
      if (!list.length) return `${EYE_SHORT[e]}: nothing recorded.`;
      const kinds = Array.from(new Set(list.map((s) => s.symptom_type)));
      return `${EYE_SHORT[e]}: ${kinds.join(", ")} (${list.length} entr${list.length === 1 ? "y" : "ies"}).`;
    };

    return {
      lines: [
        `Between ${formatDate(start)} (${previous.reason || "appointment"}) and ${formatDate(end)} (${
          latest.reason || "appointment"
        }) you recorded ${entries.length} symptom entr${entries.length === 1 ? "y" : "ies"}.`,
        summarise("right"),
        summarise("left"),
      ],
      citations: [
        { label: `Appointment — ${formatDate(start)}`, route: "appointments" },
        { label: `Appointment — ${formatDate(end)}`, route: "appointments" },
        { label: `Daily symptom logs — ${formatDate(start)} to ${formatDate(end)}`, route: "timeline" },
      ],
      found: true,
      interpretation: "Symptoms between the last two appointments",
    };
  }

  // ---- 4. "What did my doctors document about X?" --------------------------
  if (/(doctor|clinician|ophthalmolog|surgeon|consultant)/.test(q) && /(document|say|said|note|write|wrote|record)/.test(q)) {
    const topics = parsed.terms.filter(
      (t) => !["what", "did", "my", "doctors", "doctor", "document", "documented", "about", "say", "said", "notes", "note", "record", "recorded", "wrote", "write"].includes(t),
    );
    const matches: { label: string; text: string; route: Route; date: string }[] = [];
    const hit = (text?: string) => !!text && (topics.length === 0 || topics.some((t) => text.toLowerCase().includes(t)));

    for (const i of data.imaging) {
      const text = i.clinician_interpretation || i.findings;
      if (i.source_type !== "patient_reported" && hit(text)) {
        matches.push({ label: `${i.modality} report — ${formatDate(i.date)}`, text: text!, route: "imaging", date: i.date });
      }
    }
    for (const d of data.documents) {
      if (hit(d.summary)) {
        matches.push({ label: `${d.title} — ${formatDate(d.date)}`, text: d.summary!, route: "imaging", date: d.date });
      }
    }
    for (const a of data.appointments) {
      if (hit(a.notes)) {
        matches.push({
          label: `${a.reason || "Appointment"} notes — ${formatDate(a.date_time.slice(0, 10))}`,
          text: a.notes!,
          route: "appointments",
          date: a.date_time.slice(0, 10),
        });
      }
    }
    for (const dx of data.diagnoses) {
      if (hit(dx.notes) || hit(dx.name)) {
        matches.push({
          label: `Diagnosis: ${dx.name} — ${formatDate(dx.first_documented)}`,
          text: dx.notes || dx.name,
          route: "my-eyes",
          date: dx.first_documented,
        });
      }
    }

    if (!matches.length) return notFound(`Clinician-documented content${topics.length ? ` about "${topics.join(" ")}"` : ""}`);
    matches.sort((a, b) => b.date.localeCompare(a.date));
    return {
      lines: [
        `${matches.length} clinician-documented record${matches.length === 1 ? "" : "s"}${
          topics.length ? ` mention "${topics.join(" ")}"` : ""
        }. Quoted as documented, without interpretation:`,
        ...matches.slice(0, 8).map((m) => `• ${m.label} — "${m.text}"`),
      ],
      citations: matches.slice(0, 8).map((m) => ({ label: m.label, route: m.route })),
      found: true,
      interpretation: `Clinician-documented records${topics.length ? ` about "${topics.join(" ")}"` : ""}`,
    };
  }

  // ---- 5. Compare the two most recent prescriptions ------------------------
  if (/prescription|glasses|lens/.test(q)) {
    const rx = [...data.prescriptions].sort((a, b) => b.date.localeCompare(a.date));
    if (!rx.length) return notFound("Prescriptions");
    if (/compar|change|differ/.test(q)) {
      if (rx.length < 2) return notFound("Comparison of the two most recent prescriptions");
      const [now, before] = rx;
      const line = (label: string, a?: number, b?: number, unit = "D") => {
        if (a === undefined && b === undefined) return `${label}: not recorded.`;
        if (a === undefined || b === undefined) return `${label}: ${b ?? "—"} → ${a ?? "—"}`;
        const delta = a - b;
        return `${label}: ${b} → ${a} ${unit} (${delta === 0 ? "no change" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`})`;
      };
      return {
        lines: [
          `Comparing ${formatDate(before.date)} with ${formatDate(now.date)}:`,
          `Right eye (OD) — ${line("sphere", now.right_eye.sphere, before.right_eye.sphere)}; ${line("cylinder", now.right_eye.cylinder, before.right_eye.cylinder)}; acuity ${before.right_eye.acuity ?? "—"} → ${now.right_eye.acuity ?? "—"}.`,
          `Left eye (OS) — ${line("sphere", now.left_eye.sphere, before.left_eye.sphere)}; ${line("cylinder", now.left_eye.cylinder, before.left_eye.cylinder)}; acuity ${before.left_eye.acuity ?? "—"} → ${now.left_eye.acuity ?? "—"}.`,
          "These are the recorded values only. Whether a change is clinically meaningful is for your clinician to say.",
        ],
        citations: [
          { label: `Prescription — ${formatDate(before.date)}${before.provider ? ` (${before.provider})` : ""}`, route: "my-eyes" },
          { label: `Prescription — ${formatDate(now.date)}${now.provider ? ` (${now.provider})` : ""}`, route: "my-eyes" },
        ],
        found: true,
        interpretation: "Comparison of the two most recent prescriptions",
      };
    }
    return {
      lines: [
        `${rx.length} prescription${rx.length === 1 ? "" : "s"} stored. Most recent: ${formatDate(rx[0].date)}${
          rx[0].provider ? ` (${rx[0].provider})` : ""
        }.`,
        `OD sphere ${rx[0].right_eye.sphere ?? "—"}, cylinder ${rx[0].right_eye.cylinder ?? "—"}, acuity ${rx[0].right_eye.acuity ?? "—"}.`,
        `OS sphere ${rx[0].left_eye.sphere ?? "—"}, cylinder ${rx[0].left_eye.cylinder ?? "—"}, acuity ${rx[0].left_eye.acuity ?? "—"}.`,
      ],
      citations: [{ label: `Prescription — ${formatDate(rx[0].date)}`, route: "my-eyes" }],
      found: true,
      interpretation: "Prescription history",
    };
  }

  // ---- 6. Questions carried into an appointment ---------------------------
  if (/question/.test(q)) {
    const past = data.appointments
      .filter((a) => a.date_time.slice(0, 10) <= new Date().toISOString().slice(0, 10))
      .sort((a, b) => b.date_time.localeCompare(a.date_time));
    const target = past[0];
    const qs = data.questions.filter((x) =>
      target ? x.created_at.slice(0, 10) <= target.date_time.slice(0, 10) : true,
    );
    if (!qs.length) return notFound("Questions for your doctor");
    return {
      lines: [
        target
          ? `Questions on your list before your ${target.reason || "appointment"} on ${formatDate(target.date_time.slice(0, 10))}:`
          : "Questions on your list:",
        ...qs.map((x) => `• ${x.text}${x.status === "answered" && x.answer ? ` — recorded answer: "${x.answer}"` : ` (${x.status})`}`),
      ],
      citations: [{ label: "Questions for my doctor", route: "appointments" }],
      found: true,
      interpretation: "Questions for your doctor",
    };
  }

  // ---- 7. "Summarize what changed since my last review" --------------------
  if (/(summar|what changed|changes)/.test(q)) {
    const past = data.appointments
      .filter((a) => a.date_time.slice(0, 10) <= new Date().toISOString().slice(0, 10))
      .sort((a, b) => b.date_time.localeCompare(a.date_time));
    const start = past[0]?.date_time.slice(0, 10);
    if (!start) return notFound("Changes since your last review");
    const end = new Date().toISOString().slice(0, 10);
    const payload = generateBrief(data, { range_start: start, range_end: end });
    const section = (eyeKey: "right" | "left") => {
      const p = payload.perEye[eyeKey];
      const parts: string[] = [];
      if (p.new.length) parts.push(`new — ${p.new.join("; ")}`);
      if (p.worse.length) parts.push(`worse — ${p.worse.join("; ")}`);
      if (p.improved.length) parts.push(`improved — ${p.improved.join("; ")}`);
      if (p.unchanged.length) parts.push(`unchanged — ${p.unchanged.join("; ")}`);
      return `${EYE_SHORT[eyeKey]}: ${parts.length ? parts.join(" · ") : "nothing recorded."}`;
    };
    return {
      lines: [
        `Since your ${past[0].reason || "appointment"} on ${formatDate(start)}:`,
        section("right"),
        section("left"),
        payload.clinicalEvents.length
          ? `Clinical events: ${payload.clinicalEvents.map((e) => `${formatDate(e.date)} ${e.kind}`).join(", ")}.`
          : "No clinical events recorded in this period.",
        "This is an organisational summary of what you recorded — not a clinical assessment.",
      ],
      citations: [
        { label: `Appointment — ${formatDate(start)}`, route: "appointments" },
        { label: `Records ${formatDate(start)} to ${formatDate(end)}`, route: "timeline" },
      ],
      found: true,
      interpretation: "Changes since your last review",
    };
  }

  // ---- 8. Measurement trends ("what is my eye pressure") ------------------
  if (/(pressure|iop|acuity|thickness|measurement)/.test(q)) {
    const kind = /pressure|iop/.test(q) ? "iop" : /acuity/.test(q) ? "visual_acuity" : /thickness|cct/.test(q) ? "cct" : undefined;
    const list = data.measurements
      .filter((m) => (kind ? m.kind === kind : true))
      .filter((m) => (eye ? m.eye === eye || m.eye === "both" : true))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!list.length) return notFound(`${kind ? MEASUREMENT_LABELS[kind] : "Measurement"} history`);
    return {
      lines: [
        `${list.length} ${kind ? MEASUREMENT_LABELS[kind].toLowerCase() : "measurement"} record${list.length === 1 ? "" : "s"} stored, most recent first:`,
        ...list.slice(0, 8).map(
          (m) => `• ${formatDate(m.date)} — ${eyeWord(m.eye)}: ${m.value}${m.unit ? ` ${m.unit}` : ""}${m.note ? ` (${m.note})` : ""}`,
        ),
      ],
      citations: list.slice(0, 4).map((m) => ({
        label: `${MEASUREMENT_LABELS[m.kind]} — ${formatDate(m.date)} (${SOURCE_LABELS[m.source_type]})`,
        route: "my-eyes" as Route,
      })),
      found: true,
      interpretation: `${kind ? MEASUREMENT_LABELS[kind] : "Measurement"} history`,
    };
  }

  // ---- 9. Counts over a period ---------------------------------------------
  if (/\bhow many\b/.test(q)) {
    const answer = countIntent(data, q, parsed);
    if (answer) return answer;
  }

  // ---- 10. Last time something happened -------------------------------------
  if (/\b(last|latest|most recent)\b/.test(q)) {
    const answer = lastIntent(data, q, parsed);
    if (answer) return answer;
  }

  // ---- 11. Trends in a recorded number --------------------------------------
  if (/\b(trend|over time|changed|history of)\b/.test(q)) {
    const answer = trendIntent(data, q, parsed);
    if (answer) return answer;
  }

  // ---- Fallback: keyword search over the whole record ----------------------
  const hits = searchRecords(data, rawQuestion, 8);
  if (!hits.length) return notFound("Keyword search across all records");
  return {
    lines: [
      `I could not answer that directly, but ${hits.length} record${hits.length === 1 ? "" : "s"} in your history match those words:`,
      ...hits.map((h) => `• ${formatDate(h.date)} — ${h.kind}: ${h.title}${h.snippet ? ` (${h.snippet})` : ""}`),
    ],
    citations: hits.map((h) => ({
      label: `${h.kind} — ${formatDate(h.date)} (${SOURCE_LABELS[h.source_type]})`,
      route: h.route,
    })),
    found: true,
    interpretation: "Keyword search across all records",
  };
}

/* --------------------------------------------------------- intent grammar */

/**
 * The remaining intents are built over `query.ts` rather than by scanning arrays: entity, filter,
 * aggregation. Everything they emit is a value from the record or a count of records — the
 * property test asserts that no answer contains a string the data does not support.
 */

const ENTITY_WORDS: { words: RegExp; entity: Entity; noun: string }[] = [
  { words: /\bsymptom|entr(y|ies)\b/, entity: "symptoms", noun: "symptom entries" },
  { words: /\bdrawing|sketch\b/, entity: "drawings", noun: "drawings" },
  { words: /\bappointment|visit|review\b/, entity: "appointments", noun: "appointments" },
  { words: /\bscan|oct|imaging|photo\b/, entity: "imaging", noun: "imaging records" },
  { words: /\bletter|document|report\b/, entity: "documents", noun: "documents" },
  { words: /\bcheck|self.?test|amsler\b/, entity: "selfTests", noun: "checks you did yourself" },
  { words: /\bmeasurement|pressure|acuity|reading\b/, entity: "measurements", noun: "measurements" },
  { words: /\bprocedure|surgery|operation\b/, entity: "procedures", noun: "procedures" },
  { words: /\bfloater\b/, entity: "floaters", noun: "floaters" },
  { words: /\bquestion\b/, entity: "questions", noun: "questions" },
];

function entityFor(q: string): { entity: Entity; noun: string } | null {
  const hit = ENTITY_WORDS.find((e) => e.words.test(q));
  return hit ? { entity: hit.entity, noun: hit.noun } : null;
}

/** A date window named in words: "this year", "last 30 days", "since my last appointment". */
function windowFor(data: AllData, q: string, parsed: ReturnType<typeof parseQuery>) {
  const today = todayLocal();
  if (parsed.year) return { start: `${parsed.year}-01-01`, end: `${parsed.year}-12-31`, label: parsed.year };
  if (parsed.monthPrefix) {
    return { start: `${parsed.monthPrefix}-01`, end: `${parsed.monthPrefix}-31`, label: parsed.monthPrefix };
  }
  const days = q.match(/last (\d+) days?/);
  if (days) return { start: addDays(today, -Number(days[1])), end: today, label: `the last ${days[1]} days` };
  if (/this year/.test(q)) return { start: `${today.slice(0, 4)}-01-01`, end: today, label: "this year" };
  if (/this month/.test(q)) return { start: `${today.slice(0, 7)}-01`, end: today, label: "this month" };
  if (/since my last (appointment|review|visit)/.test(q)) {
    const appointment = select(data, "appointments").before(today).order("desc").first();
    if (appointment) {
      const start = isoToDateOnly(appointment.date_time);
      return { start, end: today, label: `since ${formatDate(start)}` };
    }
  }
  return { start: "0000-01-01", end: today, label: "in your whole record" };
}

function countIntent(data: AllData, q: string, parsed: ReturnType<typeof parseQuery>): AskAnswer | null {
  const target = entityFor(q);
  if (!target) return null;
  const window = windowFor(data, q, parsed);

  let query = select(data, target.entity).between(window.start, window.end);
  if (parsed.eye) query = query.eye(parsed.eye);

  const types = matchedSymptomTypes(data, q);
  if (target.entity === "symptoms" && types.length) query = query.type(types[0]);

  const count = query.count();
  if (count === 0) return notFound(`Count of ${target.noun} ${window.label}`);

  const eyeText = parsed.eye ? ` for the ${EYE_SHORT[parsed.eye].toLowerCase()}` : "";
  const typeText = types.length ? ` of ${types[0]}` : "";
  return {
    lines: [`${count} ${target.noun}${typeText}${eyeText}, ${window.label}.`],
    citations: [{ label: `${target.noun} — ${window.label}`, route: "timeline" }],
    found: true,
    interpretation: `Count of ${target.noun} ${window.label}`,
  };
}

function lastIntent(data: AllData, q: string, parsed: ReturnType<typeof parseQuery>): AskAnswer | null {
  const target = entityFor(q);
  if (!target) return null;

  let query = select(data, target.entity).order("desc");
  if (parsed.eye) query = query.eye(parsed.eye);
  const row = query.first();
  if (!row) return notFound(`Most recent ${target.noun}`);

  const date = dateOf(target.entity, row);
  const described = describeRow(target.entity, row);
  return {
    lines: [`The most recent was ${formatDate(date)}${described ? ` — ${described}` : ""}.`],
    citations: [{ label: `${target.noun} — ${formatDate(date)}`, route: "timeline" }],
    found: true,
    interpretation: `Most recent ${target.noun}`,
  };
}

function trendIntent(data: AllData, q: string, parsed: ReturnType<typeof parseQuery>): AskAnswer | null {
  const kind = /pressure|iop/.test(q)
    ? "iop"
    : /acuity|vision/.test(q)
      ? "visual_acuity"
      : /thickness|cst|oct/.test(q)
        ? "oct_cst"
        : null;
  if (!kind) return null;

  const eye = parsed.eye ?? "right";
  const series = seriesFor(data, kind as MeasurementKind, eye);
  if (series.points.length === 0) return notFound(`${MEASUREMENT_LABELS[kind as MeasurementKind]} history`);

  const described = describeSeries(series);
  return {
    lines: [described.summary, ...described.notes],
    citations: series.points.slice(-4).map((p) => ({
      label: `${series.label} — ${formatDate(p.date)} (${SOURCE_LABELS[p.source]})`,
      route: "my-eyes" as Route,
    })),
    found: true,
    interpretation: `${series.label} over time, ${EYE_SHORT[eye]}`,
  };
}

/** A one-line description of any row, using only what it stores. */
function describeRow(_entity: Entity, row: unknown): string {
  const r = row as Record<string, unknown>;
  const parts = [r.symptom_type, r.modality, r.title, r.reason, r.procedure_type, r.name, r.kind]
    .filter((v): v is string => typeof v === "string");
  if (typeof r.value === "string") parts.push(r.value);
  return parts.slice(0, 2).join(", ");
}
