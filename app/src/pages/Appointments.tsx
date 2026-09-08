import { useEffect, useMemo, useState } from "react";
import { useStore, newRecord, toAllData } from "../lib/store";
import { defaultBriefRange, changesSince, generateBrief } from "../lib/brief";
import type { Appointment, BriefPayload, DoctorQuestion } from "../lib/models";
import { ConfirmButton, DemoBadge, EmptyState, Field, Modal, PageHeader } from "../components/ui";
import { addDays, formatDate, formatLongDate, nowISO, todayLocal } from "../lib/util";

export default function Appointments() {
  const store = useStore();
  const [briefForId, setBriefForId] = useState<string | null>(null);
  const [editAppt, setEditAppt] = useState<Appointment | "new" | null>(null);
  const [qOpen, setQOpen] = useState(false);

  const nowIso = new Date().toISOString();
  const upcoming = store.appointments.list
    .filter((a) => a.date_time >= nowIso)
    .sort((a, b) => (a.date_time > b.date_time ? 1 : -1));
  const past = store.appointments.list
    .filter((a) => a.date_time < nowIso)
    .sort((a, b) => (a.date_time < b.date_time ? 1 : -1));
  const next = upcoming[0];

  const changeCounts = useMemo(() => {
    if (!next) return null;
    const range = defaultBriefRange(toAllData(store), { beforeApptId: next.id });
    return changesSince(toAllData(store), range.range_start, range.range_end);
  }, [store, next]);

  if (briefForId) {
    return (
      <BriefView
        appointmentId={briefForId}
        onBack={() => setBriefForId(null)}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Appointments"
        sub="Connect everyday changes to clinical visits — and walk in with the whole story prepared."
        actions={
          <>
            <button className="btn" onClick={() => setQOpen(true)}>✎ Questions for my doctor</button>
            <button className="btn primary" onClick={() => setEditAppt("new")}>＋ Add appointment</button>
          </>
        }
      />

      {next ? (
        <section className="card" style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)" }}>
          <div className="card-title">Next appointment</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-lg)" }}>
            {formatLongDate(next.date_time.slice(0, 10))} · {next.reason || "Appointment"}
          </div>
          <div className="muted" style={{ marginBottom: 12 }}>
            {[next.clinic, next.clinician, next.specialty].filter(Boolean).join(" · ")}
          </div>
          {changeCounts && (
            <div className="btn-row" style={{ marginBottom: 14 }}>
              <span className="badge">{changeCounts.newSymptoms} new symptom{changeCounts.newSymptoms === 1 ? "" : "s"}</span>
              <span className="badge">{changeCounts.updates} symptom update{changeCounts.updates === 1 ? "" : "s"}</span>
              <span className="badge">{changeCounts.drawings} drawing{changeCounts.drawings === 1 ? "" : "s"}</span>
              <span className="badge">{changeCounts.imaging} imaging added</span>
              <span className="muted">since the previous visit</span>
            </div>
          )}
          <div className="btn-row">
            <button className="btn primary" onClick={() => setBriefForId(next.id)}>Prepare appointment brief</button>
            <button className="btn subtle" onClick={() => setQOpen(true)}>Questions for doctor</button>
            <button className="btn subtle" onClick={() => setEditAppt(next)}>Edit</button>
          </div>
        </section>
      ) : (
        <EmptyState title="Connect everyday changes to clinical visits.">
          Add your next ophthalmology appointment and Afterlight can summarise what changed
          beforehand.
        </EmptyState>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Upcoming</div>
        {upcoming.length === 0 ? (
          <p className="muted">No upcoming appointments recorded.</p>
        ) : (
          upcoming.map((a) => <ApptRow key={a.id} a={a} onEdit={() => setEditAppt(a)} />)
        )}
        <div className="card-title" style={{ marginTop: 18 }}>Past</div>
        {past.length === 0 ? (
          <p className="muted">No past appointments recorded.</p>
        ) : (
          past.map((a) => <ApptRow key={a.id} a={a} onEdit={() => setEditAppt(a)} />)
        )}
      </section>

      {editAppt && <AppointmentModal appt={editAppt === "new" ? null : editAppt} onClose={() => setEditAppt(null)} />}
      {qOpen && <QuestionsModal onClose={() => setQOpen(false)} />}
    </>
  );
}

function ApptRow({ a, onEdit }: { a: Appointment; onEdit: () => void }) {
  const store = useStore();
  return (
    <div className="tl-event" style={{ alignItems: "center" }}>
      <span className="tl-icon" aria-hidden>✚</span>
      <span style={{ minWidth: 0 }}>
        <span className="tl-title">
          {formatDate(a.date_time.slice(0, 10))} · {a.reason || "Appointment"}
        </span>
        <br />
        <span className="tl-summary">
          {[a.clinic, a.clinician, a.specialty].filter(Boolean).join(" · ") || "—"}
        </span>
      </span>
      <span className="tl-meta">
        <DemoBadge demo={a.demo} />
        <button className="btn subtle" style={{ minHeight: "var(--target)" }} onClick={onEdit}>Edit</button>
        <ConfirmButton label="Delete" onConfirm={() => store.appointments.del(a.id)} className="btn danger" />
      </span>
    </div>
  );
}

/* ---------------- appointment form ---------------- */

function AppointmentModal({ appt, onClose }: { appt: Appointment | null; onClose: () => void }) {
  const store = useStore();
  const [f, setF] = useState({
    date: appt ? appt.date_time.slice(0, 10) : todayLocal(),
    time: appt ? appt.date_time.slice(11, 16) : "10:00",
    clinic: appt?.clinic ?? "",
    clinician: appt?.clinician ?? "",
    specialty: appt?.specialty ?? "",
    reason: appt?.reason ?? "",
    notes: appt?.notes ?? "",
    follow_up_date: appt?.follow_up_date ?? "",
  });
  return (
    <Modal title={appt ? "Edit appointment" : "Add appointment"} onClose={onClose}>
      <div className="grid-2">
        <Field label="Date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Time"><input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
      </div>
      <div className="grid-2">
        <Field label="Clinic"><input type="text" value={f.clinic} onChange={(e) => setF({ ...f, clinic: e.target.value })} /></Field>
        <Field label="Clinician"><input type="text" value={f.clinician} onChange={(e) => setF({ ...f, clinician: e.target.value })} /></Field>
      </div>
      <div className="grid-2">
        <Field label="Specialty"><input type="text" value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} placeholder="e.g. Medical retina" /></Field>
        <Field label="Reason"><input type="text" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Retina follow-up" /></Field>
      </div>
      <Field label="Notes from the visit"><textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <Field label="Follow-up date (if given)"><input type="date" value={f.follow_up_date} onChange={(e) => setF({ ...f, follow_up_date: e.target.value })} /></Field>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          onClick={async () => {
            const rec: Appointment = appt
              ? {
                  ...appt,
                  date_time: `${f.date}T${f.time || "09:00"}:00`,
                  clinic: f.clinic || undefined,
                  clinician: f.clinician || undefined,
                  specialty: f.specialty || undefined,
                  reason: f.reason || undefined,
                  notes: f.notes || undefined,
                  follow_up_date: f.follow_up_date || undefined,
                  updated_at: nowISO(),
                }
              : newRecord({
                  date_time: `${f.date}T${f.time || "09:00"}:00`,
                  clinic: f.clinic || undefined,
                  clinician: f.clinician || undefined,
                  specialty: f.specialty || undefined,
                  reason: f.reason || undefined,
                  notes: f.notes || undefined,
                  follow_up_date: f.follow_up_date || undefined,
                  linked_document_ids: [],
                  linked_imaging_ids: [],
                });
            await store.appointments.put(rec);
            onClose();
          }}
        >
          Save appointment
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- questions ---------------- */

const STATUS_LABELS: Record<DoctorQuestion["status"], string> = {
  pending: "Pending",
  asked: "Asked",
  answered: "Answered",
  follow_up: "Follow-up needed",
};

function QuestionsModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [text, setText] = useState("");
  const [openQ, setOpenQ] = useState<DoctorQuestion | null>(null);
  const list = [...store.questions.list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return (
    <Modal title="Questions for my doctor" onClose={onClose} wide>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <input
          type="text"
          value={text}
          placeholder="e.g. Is the retina fully attached?"
          onChange={(e) => setText(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
          aria-label="New question"
          onKeyDown={async (e) => {
            if (e.key === "Enter" && text.trim()) {
              await store.questions.put(newRecord({ text: text.trim(), status: "pending" as const }));
              setText("");
            }
          }}
        />
        <button
          className="btn primary"
          disabled={!text.trim()}
          onClick={async () => {
            await store.questions.put(newRecord({ text: text.trim(), status: "pending" as const }));
            setText("");
          }}
        >
          Add question
        </button>
      </div>
      {list.length === 0 ? (
        <p className="muted">
          Keep a running list between visits — Afterlight will carry pending questions into every
          appointment brief.
        </p>
      ) : (
        list.map((q) => (
          <div key={q.id} className="tl-event" style={{ alignItems: "center" }}>
            <span className="badge">{STATUS_LABELS[q.status]}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              {q.text}
              {q.answer && <div className="tl-summary">Answer: {q.answer}</div>}
            </span>
            <span className="tl-meta">
              <DemoBadge demo={q.demo} />
              <button className="btn subtle" style={{ minHeight: "var(--target)" }} onClick={() => setOpenQ(q)}>Update</button>
              <ConfirmButton label="Delete" onConfirm={() => store.questions.del(q.id)} className="btn danger" />
            </span>
          </div>
        ))
      )}
      {openQ && <QuestionUpdateModal q={openQ} onClose={() => setOpenQ(null)} />}
    </Modal>
  );
}

function QuestionUpdateModal({ q, onClose }: { q: DoctorQuestion; onClose: () => void }) {
  const store = useStore();
  const [status, setStatus] = useState<DoctorQuestion["status"]>(q.status);
  const [answer, setAnswer] = useState(q.answer ?? "");
  return (
    <Modal title="Update question" onClose={onClose}>
      <p style={{ color: "var(--text-2)" }}>{q.text}</p>
      <Field label="Status">
        <select value={status} onChange={(e) => setStatus(e.target.value as DoctorQuestion["status"])}>
          {(Object.keys(STATUS_LABELS) as DoctorQuestion["status"][]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </Field>
      <Field label="Answer / note from the appointment"><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} /></Field>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          onClick={async () => {
            await store.questions.put({ ...q, status, answer: answer || undefined, updated_at: nowISO() });
            onClose();
          }}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- appointment brief ---------------- */

function BriefView({ appointmentId, onBack }: { appointmentId: string; onBack: () => void }) {
  const store = useStore();
  const allData = useMemo(() => toAllData(store), [store]);
  const appt = store.appointments.list.find((a) => a.id === appointmentId);
  const [range, setRange] = useState(() => defaultBriefRange(allData, { beforeApptId: appointmentId }));
  const [saved, setSaved] = useState(false);
  const [present, setPresent] = useState(false);
  const [sections, setSections] = useState<{ trends: boolean; selfTests: boolean }>({
    trends: false,
    selfTests: false,
  });
  const payload = useMemo(
    () => generateBrief(allData, { ...range, sections }),
    [allData, range, sections],
  );

  const printBrief = () => {
    const el = document.createElement("div");
    el.className = "print-only print-doc";
    el.innerHTML = briefHTML(payload, appt ? `${formatLongDate(appt.date_time.slice(0, 10))} · ${appt.reason || "Appointment"}` : "Appointment brief");
    document.body.appendChild(el);
    window.print();
    setTimeout(() => el.remove(), 1000);
  };

  return (
    <>
      <PageHeader
        kicker="Prepare for appointment"
        title={appt ? `Brief for ${formatLongDate(appt.date_time.slice(0, 10))}` : "Appointment brief"}
        sub="An organisational summary of your records for the chosen period — what was recorded, drawn, scanned and asked. It is not a medical interpretation."
        actions={
          <button className="btn subtle" onClick={onBack}>← Back to appointments</button>
        }
      />

      <div className="card no-print" style={{ marginBottom: 16 }}>
        <div className="card-title">Period covered</div>
        <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="btn subtle"
            style={{ minHeight: "var(--target)", padding: "3px 12px", fontSize: "var(--fs-sm)" }}
            onClick={() => setRange(defaultBriefRange(allData, { beforeApptId: appointmentId }))}
          >
            Since previous appointment
          </button>
          <button
            className="btn subtle"
            style={{ minHeight: "var(--target)", padding: "3px 12px", fontSize: "var(--fs-sm)" }}
            onClick={() => setRange({ range_start: addDays(todayLocal(), -7), range_end: todayLocal() })}
          >
            Last 7 days
          </button>
          <button
            className="btn subtle"
            style={{ minHeight: "var(--target)", padding: "3px 12px", fontSize: "var(--fs-sm)" }}
            onClick={() => setRange({ range_start: addDays(todayLocal(), -30), range_end: todayLocal() })}
          >
            Last 30 days
          </button>
          <input
            type="date"
            value={range.range_start}
            onChange={(e) => setRange({ ...range, range_start: e.target.value })}
            aria-label="Start date"
            style={{ width: 160 }}
          />
          <span className="muted">→</span>
          <input
            type="date"
            value={range.range_end}
            onChange={(e) => setRange({ ...range, range_end: e.target.value })}
            aria-label="End date"
            style={{ width: 160 }}
          />
        </div>
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        Brief generated for {formatDate(range.range_start)} to {formatDate(range.range_end)}.
      </p>

      <div className="card no-print" style={{ marginBottom: 16 }}>
      <div className="card-title">Extra sections</div>
      <p className="muted" style={{ marginTop: 0 }}>
        The brief stays to one page by default, because that is what gets read. Add these only if
        they are what this appointment is about.
      </p>
      <div className="check-row">
        <input
          id="brief-trends"
          type="checkbox"
          checked={sections.trends}
          onChange={(e) => setSections({ ...sections, trends: e.target.checked })}
        />
        <label htmlFor="brief-trends">Recorded numbers over this period</label>
      </div>
      <div className="check-row">
        <input
          id="brief-selftests"
          type="checkbox"
          checked={sections.selfTests}
          onChange={(e) => setSections({ ...sections, selfTests: e.target.checked })}
        />
        <label htmlFor="brief-selftests">Checks I did myself</label>
      </div>
      </div>

      <BriefDocument payload={payload} title={appt ? `${formatLongDate(appt.date_time.slice(0, 10))} · ${appt.reason || "Appointment"}` : "Appointment brief"} />

      <div className="btn-row no-print" style={{ marginTop: 18 }}>
        <button className="btn primary" onClick={printBrief}>⎙ Print / save as PDF</button>
        <button className="btn" onClick={() => setPresent(true)}>⛶ Present fullscreen</button>
        <button
          className="btn"
          onClick={async () => {
            await store.briefs.put(newRecord({ appointment_id: appointmentId, range_start: range.range_start, range_end: range.range_end, payload }));
            setSaved(true);
          }}
        >
          {saved ? "✓ Saved to timeline" : "Save brief into timeline"}
        </button>
        <span className="muted">Saved briefs appear on your timeline and in My Records.</span>
      </div>

      {present && (
        <PresentMode
          payload={payload}
          title={appt ? `${formatLongDate(appt.date_time.slice(0, 10))} · ${appt.reason || "Appointment"}` : "Appointment brief"}
          onPrint={printBrief}
          onClose={() => setPresent(false)}
        />
      )}
    </>
  );
}

/** Fullscreen, large-type view of the brief — for showing a clinician in the room (§28). */
function PresentMode({
  payload,
  title,
  onPrint,
  onClose,
}: {
  payload: BriefPayload;
  title: string;
  onPrint: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="present" role="dialog" aria-modal="true" aria-label="Appointment brief, presentation view">
      <div className="present-bar no-print">
        <span className="muted" style={{ marginRight: "auto" }}>
          Presentation view · esc to exit
        </span>
        <button className="btn subtle" onClick={onPrint}>⎙ Print</button>
        <button className="btn" onClick={onClose}>Exit</button>
      </div>
      <div className="present-doc">
      <BriefDocument payload={payload} title={title} />
      </div>
    </div>
  );
}

function BriefSectionBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: "var(--fs-xs)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent-strong)", fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {items.map((t, i) => (
          <li key={i} style={{ fontSize: "var(--fs-base)", color: "var(--text-2)", marginBottom: 3 }}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function BriefDocument({ payload, title }: { payload: BriefPayload; title: string }) {
  return (
    <div className="card print-doc">
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-xl)" }}>AFTERLIGHT — APPOINTMENT BRIEF</div>
        <div className="muted">{title}</div>
        <div className="muted">
          Period: {formatDate(payload.range_start)} → {formatDate(payload.range_end)} · generated {formatDate(payload.generated_at.slice(0, 10))}
        </div>
      </div>
      <div className="grid-2">
        {(["right", "left"] as const).map((eye) => (
          <div key={eye} className={`eye-panel ${eye}`} style={{ padding: "12px 14px", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)" }}>
            <div className="eye-heading">
              <span className="eye-name">{eye === "right" ? "Right Eye (OD)" : "Left Eye (OS)"}</span>
            </div>
            <BriefSectionBlock title="New" items={payload.perEye[eye].new} />
            <BriefSectionBlock title="Unchanged" items={payload.perEye[eye].unchanged} />
            <BriefSectionBlock title="Improved" items={payload.perEye[eye].improved} />
            <BriefSectionBlock title="Worse" items={payload.perEye[eye].worse} />
          </div>
        ))}
      </div>

      {payload.drawings.length > 0 && (
        <>
          <hr className="divider" />
          <div className="card-title">Visual field history</div>
          <div className="btn-row">
            {payload.drawings.slice(0, 8).map((d) => (
              <figure key={d.id} style={{ margin: 0, textAlign: "center" }}>
                {d.thumbnail && (
                  <img src={d.thumbnail} alt={`${formatDate(d.date_time.slice(0, 10))}. ${d.description ?? "Patient drawing of the field of view."}`} style={{ width: 130, borderRadius: 8, border: "1px solid var(--border)" }} />
                )}
                <figcaption className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                  {formatDate(d.date_time.slice(0, 10))} · {d.eye === "right" ? "OD" : d.eye === "left" ? "OS" : "OU"}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="draw-disclaimer">Patient-drawn representations of perceived vision — not clinical retinal images.</p>
        </>
      )}

      <hr className="divider" />
      <div className="card-title">Clinical events in this period</div>
      {payload.clinicalEvents.length === 0 ? (
        <p className="muted">None recorded in this period.</p>
      ) : (
        payload.clinicalEvents.map((e, i) => (
          <div key={i} style={{ fontSize: "var(--fs-base)", marginBottom: 4 }}>
            <strong>{formatDate(e.date)}</strong> — {e.kind}: {e.title}
          </div>
        ))
      )}

      <hr className="divider" />
      <div className="card-title">Current treatment</div>
      {payload.treatment.length === 0 ? (
        <p className="muted">No active treatment recorded.</p>
      ) : (
        payload.treatment.map((t, i) => (
          <div key={i} style={{ fontSize: "var(--fs-base)", marginBottom: 4 }}>• {t}</div>
        ))
      )}

      {payload.trends && payload.trends.length > 0 && (
        <>
          <hr className="divider" />
          <div className="card-title">Recorded numbers in this period</div>
          {payload.trends.map((line, i) => (
            <div key={i} style={{ fontSize: "var(--fs-sm)", marginBottom: 4 }}>
              {line}
            </div>
          ))}
          <p className="muted" style={{ fontSize: "var(--fs-xs)" }}>
            Values as recorded. Afterlight does not interpret them.
          </p>
        </>
      )}

      {payload.selfTestNotes && payload.selfTestNotes.length > 0 && (
        <>
          <hr className="divider" />
          <div className="card-title">Checks the patient did at home</div>
          {payload.selfTestNotes.map((line, i) => (
            <div key={i} style={{ fontSize: "var(--fs-sm)", marginBottom: 4 }}>
              {line}
            </div>
          ))}
          <p className="muted" style={{ fontSize: "var(--fs-xs)" }}>
            Patient-performed checks under home conditions — not clinical measurements.
          </p>
        </>
      )}

      <hr className="divider" />
      <div className="card-title">Questions for my doctor</div>
      {payload.questions.length === 0 ? (
        <p className="muted">No pending questions.</p>
      ) : (
        payload.questions.map((q, i) => (
          <div key={i} style={{ fontSize: "var(--fs-base)", marginBottom: 4 }}>• {q}</div>
        ))
      )}

      <hr className="divider" />
      <p className="muted" style={{ fontSize: "var(--fs-xs)" }}>
        Generated by Afterlight from this patient's own records. Patient-reported items are
        subjective descriptions; clinician-documented items are recorded as documented. This brief
        is not a diagnosis and does not replace clinical assessment.
      </p>
    </div>
  );
}

/** Plain-HTML render of the brief for printing. */
function briefHTML(payload: BriefPayload, title: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "<p><em>None recorded.</em></p>");
  const eyeBlock = (eye: "right" | "left") => `
    <h3>${eye === "right" ? "Right Eye (OD)" : "Left Eye (OS)"}</h3>
    <h4>New</h4>${list(payload.perEye[eye].new)}
    <h4>Unchanged</h4>${list(payload.perEye[eye].unchanged)}
    <h4>Improved</h4>${list(payload.perEye[eye].improved)}
    <h4>Worse</h4>${list(payload.perEye[eye].worse)}`;
  return `
    <div style="font-family: Georgia, serif; color:#111; max-width: 800px; margin: 0 auto; padding: 24px;">
      <h1 style="text-align:center;">AFTERLIGHT — APPOINTMENT BRIEF</h1>
      <p style="text-align:center;">${esc(title)}</p>
      <p style="text-align:center;">Period: ${esc(formatDate(payload.range_start))} → ${esc(formatDate(payload.range_end))}</p>
      <div style="display:flex; gap:24px;">
        <div style="flex:1;">${eyeBlock("right")}</div>
        <div style="flex:1;">${eyeBlock("left")}</div>
      </div>
      <h2>Clinical events</h2>
      ${payload.clinicalEvents.length ? `<ul>${payload.clinicalEvents.map((e) => `<li><strong>${esc(formatDate(e.date))}</strong> — ${esc(e.kind)}: ${esc(e.title)}</li>`).join("")}</ul>` : "<p><em>None recorded.</em></p>"}
      <h2>Current treatment</h2>
      ${list(payload.treatment)}
      <h2>Questions for my doctor</h2>
      ${list(payload.questions)}
      <p style="font-size:12px; margin-top:24px;">Generated by Afterlight from the patient's own records. Patient-reported items are subjective descriptions. This brief is not a diagnosis and does not replace clinical assessment.</p>
    </div>`;
}
