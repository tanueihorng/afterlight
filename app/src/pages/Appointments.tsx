import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore, newRecord, toAllData } from "../lib/store";
import { defaultBriefRange, changesSince, generateBrief } from "../lib/brief";
import {
  CLINICIAN_NOTE_URL,
  HOW_TO_READ,
  PATIENT_GENERATED_FOOTER,
  itemsForEye,
} from "../lib/briefpdf";
import { downloadBriefPdf } from "../lib/briefexport";
import type {
  Appointment,
  BriefBucket,
  BriefItem,
  BriefPayload,
  DoctorQuestion,
} from "../lib/models";
import {
  ConfirmButton,
  DemoBadge,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  ProvenanceBadge,
} from "../components/ui";
import { ShareBrief } from "../components/ShareBrief";
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
    return <BriefView appointmentId={briefForId} onBack={() => setBriefForId(null)} />;
  }

  return (
    <>
      <PageHeader
        title="Appointments"
        sub="Connect everyday changes to clinical visits — and walk in with the whole story prepared."
        actions={
          <>
            <button className="btn" onClick={() => setQOpen(true)}>
              ✎ Questions for my doctor
            </button>
            <button className="btn primary" onClick={() => setEditAppt("new")}>
              ＋ Add appointment
            </button>
          </>
        }
      />

      {next ? (
        <section
          className="card"
          style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)" }}
        >
          <div className="card-title">Next appointment</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-lg)" }}>
            {formatLongDate(next.date_time.slice(0, 10))} · {next.reason || "Appointment"}
          </div>
          <div className="muted" style={{ marginBottom: 12 }}>
            {[next.clinic, next.clinician, next.specialty].filter(Boolean).join(" · ")}
          </div>
          {changeCounts && (
            <div className="btn-row" style={{ marginBottom: 14 }}>
              <span className="badge">
                {changeCounts.newSymptoms} new symptom{changeCounts.newSymptoms === 1 ? "" : "s"}
              </span>
              <span className="badge">
                {changeCounts.updates} symptom update{changeCounts.updates === 1 ? "" : "s"}
              </span>
              <span className="badge">
                {changeCounts.drawings} drawing{changeCounts.drawings === 1 ? "" : "s"}
              </span>
              <span className="badge">{changeCounts.imaging} imaging added</span>
              <span className="muted">since the previous visit</span>
            </div>
          )}
          <div className="btn-row">
            <button className="btn primary" onClick={() => setBriefForId(next.id)}>
              Prepare appointment brief
            </button>
            <button className="btn subtle" onClick={() => setQOpen(true)}>
              Questions for doctor
            </button>
            <button className="btn subtle" onClick={() => setEditAppt(next)}>
              Edit
            </button>
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
        <div className="card-title" style={{ marginTop: 18 }}>
          Past
        </div>
        {past.length === 0 ? (
          <p className="muted">No past appointments recorded.</p>
        ) : (
          past.map((a) => <ApptRow key={a.id} a={a} onEdit={() => setEditAppt(a)} />)
        )}
      </section>

      {editAppt && (
        <AppointmentModal
          appt={editAppt === "new" ? null : editAppt}
          onClose={() => setEditAppt(null)}
        />
      )}
      {qOpen && <QuestionsModal onClose={() => setQOpen(false)} />}
    </>
  );
}

function ApptRow({ a, onEdit }: { a: Appointment; onEdit: () => void }) {
  const store = useStore();
  return (
    <div className="tl-event" style={{ alignItems: "center" }}>
      <span className="tl-icon" aria-hidden>
        ✚
      </span>
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
        <button className="btn subtle" style={{ minHeight: "var(--target)" }} onClick={onEdit}>
          Edit
        </button>
        <ConfirmButton
          label="Delete"
          onConfirm={() => store.appointments.del(a.id)}
          className="btn danger"
        />
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
        <Field label="Date">
          <input
            type="date"
            value={f.date}
            onChange={(e) => setF({ ...f, date: e.target.value })}
          />
        </Field>
        <Field label="Time">
          <input
            type="time"
            value={f.time}
            onChange={(e) => setF({ ...f, time: e.target.value })}
          />
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Clinic">
          <input
            type="text"
            value={f.clinic}
            onChange={(e) => setF({ ...f, clinic: e.target.value })}
          />
        </Field>
        <Field label="Clinician">
          <input
            type="text"
            value={f.clinician}
            onChange={(e) => setF({ ...f, clinician: e.target.value })}
          />
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Specialty">
          <input
            type="text"
            value={f.specialty}
            onChange={(e) => setF({ ...f, specialty: e.target.value })}
            placeholder="e.g. Medical retina"
          />
        </Field>
        <Field label="Reason">
          <input
            type="text"
            value={f.reason}
            onChange={(e) => setF({ ...f, reason: e.target.value })}
            placeholder="e.g. Retina follow-up"
          />
        </Field>
      </div>
      <Field label="Notes from the visit">
        <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
      <Field label="Follow-up date (if given)">
        <input
          type="date"
          value={f.follow_up_date}
          onChange={(e) => setF({ ...f, follow_up_date: e.target.value })}
        />
      </Field>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
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
              await store.questions.put(
                newRecord({ text: text.trim(), status: "pending" as const }),
              );
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
              <button
                className="btn subtle"
                style={{ minHeight: "var(--target)" }}
                onClick={() => setOpenQ(q)}
              >
                Update
              </button>
              <ConfirmButton
                label="Delete"
                onConfirm={() => store.questions.del(q.id)}
                className="btn danger"
              />
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
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as DoctorQuestion["status"])}
        >
          {(Object.keys(STATUS_LABELS) as DoctorQuestion["status"][]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Answer / note from the appointment">
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </Field>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          onClick={async () => {
            await store.questions.put({
              ...q,
              status,
              answer: answer || undefined,
              updated_at: nowISO(),
            });
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
  const [range, setRange] = useState(() =>
    defaultBriefRange(allData, { beforeApptId: appointmentId }),
  );
  const [saved, setSaved] = useState(false);
  const [present, setPresent] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [exported, setExported] = useState("");
  const [sections, setSections] = useState<{ trends: boolean; selfTests: boolean }>({
    trends: false,
    selfTests: false,
  });
  const payload = useMemo(
    () => generateBrief(allData, { ...range, sections }),
    [allData, range, sections],
  );

  const title = appt
    ? `${formatLongDate(appt.date_time.slice(0, 10))} · ${appt.reason || "Appointment"}`
    : "Appointment brief";

  const header = store.meta?.brief_header ?? "";
  const pageSize = store.meta?.brief_page_size ?? "A4";

  const drawings = useMemo(
    () =>
      payload.drawings
        .map((d) => store.drawings.list.find((row) => row.id === d.id))
        .filter((d): d is NonNullable<typeof d> => !!d)
        .slice(0, 6),
    [payload.drawings, store.drawings.list],
  );

  const savePdf = () => {
    const filename = downloadBriefPdf(payload, {
      title,
      pageSize,
      header: header || undefined,
      drawings,
    });
    setExported(`Saved ${filename}.`);
  };

  return (
    <>
      <PageHeader
        kicker="Prepare for appointment"
        title={
          appt ? `Brief for ${formatLongDate(appt.date_time.slice(0, 10))}` : "Appointment brief"
        }
        sub="An organisational summary of your records for the chosen period — what was recorded, drawn, scanned and asked. It is not a medical interpretation."
        actions={
          <button className="btn subtle" onClick={onBack}>
            ← Back to appointments
          </button>
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
            onClick={() =>
              setRange({ range_start: addDays(todayLocal(), -7), range_end: todayLocal() })
            }
          >
            Last 7 days
          </button>
          <button
            className="btn subtle"
            style={{ minHeight: "var(--target)", padding: "3px 12px", fontSize: "var(--fs-sm)" }}
            onClick={() =>
              setRange({ range_start: addDays(todayLocal(), -30), range_end: todayLocal() })
            }
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

      <div className="card no-print" style={{ marginBottom: 16 }}>
        <div className="card-title">How the printed copy is headed</div>
        <div className="grid-2">
          <Field label="Top of every page (optional)">
            <input
              type="text"
              value={header}
              placeholder="e.g. your name, date of birth, hospital number"
              onChange={(e) => store.setMeta({ brief_header: e.target.value })}
            />
          </Field>
          <Field label="Paper size">
            <select
              value={pageSize}
              onChange={(e) =>
                store.setMeta({ brief_page_size: e.target.value as "A4" | "Letter" })
              }
            >
              <option value="A4">A4</option>
              <option value="Letter">US Letter</option>
            </select>
          </Field>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Afterlight will not put your name on anything you did not type here.
        </p>
      </div>

      <BriefDocument payload={payload} title={title} header={header} />

      <div className="btn-row no-print" style={{ marginTop: 18 }}>
        <button className="btn primary" onClick={savePdf}>
          Save as PDF
        </button>
        <button className="btn" onClick={() => window.print()}>
          Print
        </button>
        <button className="btn" onClick={() => setShareOpen(true)}>
          Share…
        </button>
        <button className="btn" onClick={() => setPresent(true)}>
          Present fullscreen
        </button>
        <button
          className="btn subtle"
          onClick={async () => {
            await store.briefs.put(
              newRecord({
                appointment_id: appointmentId,
                range_start: range.range_start,
                range_end: range.range_end,
                payload,
              }),
            );
            setSaved(true);
          }}
        >
          {saved ? "Saved to timeline" : "Save brief into timeline"}
        </button>
      </div>
      <p className="muted no-print" role="status">
        {exported || "Saved briefs appear on your timeline and in My Records."}
      </p>

      {present && (
        <PresentMode
          payload={payload}
          title={title}
          onPrint={() => window.print()}
          onClose={() => setPresent(false)}
        />
      )}
      {shareOpen && (
        <ShareBrief
          data={allData}
          payload={payload}
          title={title}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}

/* ---------------- present mode ---------------- */

/**
 * Sections of the brief, in the order they are shown across a desk.
 *
 * Present mode pages rather than scrolls. Handing someone a phone and asking them to scroll a
 * long document is how a brief gets skimmed and put down; one section at a time, in large type,
 * is how it gets read.
 */
function presentSections(payload: BriefPayload): { key: string; title: string }[] {
  const sections = [
    { key: "right", title: "Right eye (OD)" },
    { key: "left", title: "Left eye (OS)" },
    { key: "questions", title: "Questions for my doctor" },
  ];
  if (payload.drawings.length > 0) sections.push({ key: "drawings", title: "What I drew" });
  sections.push({ key: "events", title: "Clinical events in this period" });
  sections.push({ key: "treatment", title: "Current treatment" });
  if (payload.trends?.length) sections.push({ key: "trends", title: "Recorded numbers" });
  if (payload.selfTestNotes?.length)
    sections.push({ key: "selfTests", title: "Checks I did at home" });
  return sections;
}

/** Keep the screen awake while a brief is being shown. Released on exit, and on every failure. */
function useWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!active) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      const wakeLock = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock;
      if (!wakeLock) return;
      try {
        sentinel = await wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release();
          return;
        }
        setHeld(true);
        sentinel.addEventListener("release", () => setHeld(false));
      } catch {
        // A wake lock is a courtesy; a locking screen is not a reason to stop presenting.
      }
    };
    // The browser drops the lock when the tab is hidden, so take it again on return.
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => undefined);
      setHeld(false);
    };
  }, [active]);
  return held;
}

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
  const sections = useMemo(() => presentSections(payload), [payload]);
  const [at, setAt] = useState(0);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const awake = useWakeLock(true);

  const go = useCallback(
    (delta: number) => setAt((i) => Math.min(sections.length - 1, Math.max(0, i + delta))),
    [sections.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zoomed) setZoomed(null);
        else onClose();
      } else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") {
        setAt(0);
      } else if (e.key === "End") {
        setAt(sections.length - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // The audited high-contrast light palette, not a second set of colours invented for this
    // screen: a brief shown across a desk under clinic lighting needs black on white.
    const root = document.documentElement;
    const previousTheme = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "hc-light");

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (previousTheme) root.setAttribute("data-theme", previousTheme);
      else root.removeAttribute("data-theme");
    };
  }, [go, onClose, sections.length, zoomed]);

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    // Horizontal, and clearly so: a diagonal drag while reading is not a page turn.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(dx < 0 ? 1 : -1);
  };

  const section = sections[at];

  return (
    <div
      className="present"
      role="dialog"
      aria-modal="true"
      aria-label="Appointment brief, presentation view"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="present-bar no-print">
        <span className="muted" style={{ marginRight: "auto" }}>
          {title} · {at + 1} of {sections.length}
          {awake ? " · screen staying awake" : ""}
        </span>
        <button
          className="btn subtle"
          onClick={() => go(-1)}
          disabled={at === 0}
          aria-label="Previous section"
        >
          ‹ Back
        </button>
        <button
          className="btn subtle"
          onClick={() => go(1)}
          disabled={at === sections.length - 1}
          aria-label="Next section"
        >
          Next ›
        </button>
        <button className="btn subtle" onClick={onPrint}>
          Print
        </button>
        <button className="btn" onClick={onClose}>
          Exit
        </button>
      </div>

      <div className="present-doc">
        <h2 className="present-heading">{section.title}</h2>
        <p className="muted">
          {formatDate(payload.range_start)} to {formatDate(payload.range_end)}
        </p>
        <PresentSection payload={payload} which={section.key} onZoom={setZoomed} />
        <p className="muted present-hint no-print">
          Swipe, or use the arrow keys, to move between sections. Esc to exit.
        </p>
      </div>

      {zoomed && (
        <button
          className="present-zoom"
          onClick={() => setZoomed(null)}
          aria-label="Close enlarged drawing"
        >
          <img src={zoomed} alt="Enlarged patient drawing of the field of view." />
        </button>
      )}
    </div>
  );
}

function PresentSection({
  payload,
  which,
  onZoom,
}: {
  payload: BriefPayload;
  which: string;
  onZoom: (src: string) => void;
}) {
  if (which === "right" || which === "left") {
    return <EyePanel payload={payload} eye={which} />;
  }
  if (which === "questions") {
    return payload.questions.length === 0 ? (
      <p className="muted">No pending questions.</p>
    ) : (
      <ul className="present-list">
        {payload.questions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>
    );
  }
  if (which === "drawings") {
    return (
      <>
        <div className="btn-row" style={{ flexWrap: "wrap" }}>
          {payload.drawings.map((d) =>
            d.thumbnail ? (
              <figure key={d.id} style={{ margin: 0, textAlign: "center" }}>
                <button
                  className="btn subtle"
                  style={{ padding: 4 }}
                  onClick={() => onZoom(d.thumbnail!)}
                  aria-label={`Show the drawing from ${formatDate(d.date_time.slice(0, 10))} large`}
                >
                  <img
                    src={d.thumbnail}
                    alt={d.description ?? "Patient drawing of the field of view."}
                    style={{ width: 200, borderRadius: 8 }}
                  />
                </button>
                <figcaption className="muted">{formatDate(d.date_time.slice(0, 10))}</figcaption>
              </figure>
            ) : null,
          )}
        </div>
        <p className="draw-disclaimer">
          Patient-drawn representations of perceived vision — not clinical retinal images.
        </p>
      </>
    );
  }
  if (which === "events") {
    return payload.clinicalEvents.length === 0 ? (
      <p className="muted">None recorded in this period.</p>
    ) : (
      <ul className="present-list">
        {payload.clinicalEvents.map((e, i) => (
          <li key={i}>
            <strong>{formatDate(e.date)}</strong> — {e.kind}: {e.title}
          </li>
        ))}
      </ul>
    );
  }
  if (which === "treatment") {
    return payload.treatment.length === 0 ? (
      <p className="muted">No active treatment recorded.</p>
    ) : (
      <ul className="present-list">
        {payload.treatment.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    );
  }
  if (which === "trends") {
    return (
      <ul className="present-list">
        {(payload.trends ?? []).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    );
  }
  return (
    <>
      <ul className="present-list">
        {(payload.selfTestNotes ?? []).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <p className="draw-disclaimer">
        Patient-performed checks under home conditions — not clinical measurements.
      </p>
    </>
  );
}

/* ---------------- the document itself ---------------- */

const BUCKET_HEADINGS: Record<BriefBucket, string> = {
  new: "New",
  worse: "More than usual",
  unchanged: "Unchanged",
  improved: "Less than usual",
};

const BUCKET_ORDER: BriefBucket[] = ["new", "worse", "unchanged", "improved"];

function BucketList({ bucket, items }: { bucket: BriefBucket; items: BriefItem[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="brief-bucket">{BUCKET_HEADINGS[bucket]}</div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {items.map((item, i) => (
          <li key={i} className="brief-line">
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One eye.
 *
 * The patient's own reports and anything copied out of a clinic document are separately headed
 * and never share a list. Blending them is the specific failure this brief exists to prevent: a
 * reader takes a bulleted list under one heading as one kind of claim.
 */
function EyePanel({ payload, eye }: { payload: BriefPayload; eye: "right" | "left" }) {
  const items = itemsForEye(payload, eye);
  const own = items.filter(
    (i) => i.source_type === "patient_reported" || i.source_type === "patient_drawn",
  );
  const documented = items.filter((i) => !own.includes(i));

  return (
    <div
      className={`eye-panel ${eye}`}
      style={{
        padding: "12px 14px",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--radius)",
      }}
    >
      <div className="eye-heading">
        <span className="eye-name">{eye === "right" ? "Right Eye (OD)" : "Left Eye (OS)"}</span>
      </div>

      <div className="brief-source-heading">
        <ProvenanceBadge source="patient_reported" />
      </div>
      {own.length === 0 ? (
        <p className="muted">Nothing recorded for this eye in this period.</p>
      ) : (
        BUCKET_ORDER.map((bucket) => (
          <BucketList key={bucket} bucket={bucket} items={own.filter((i) => i.bucket === bucket)} />
        ))
      )}

      {documented.length > 0 && (
        <>
          <div className="brief-source-heading">
            <ProvenanceBadge source={documented[0].source_type} />
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {documented.map((item, i) => (
              <li key={i} className="brief-line">
                {item.text} <ProvenanceBadge source={item.source_type} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function BriefDocument({
  payload,
  title,
  header,
}: {
  payload: BriefPayload;
  title: string;
  header?: string;
}) {
  return (
    <div className="card print-doc">
      {header && <div className="brief-identifier">{header}</div>}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-xl)" }}>
          AFTERLIGHT — APPOINTMENT BRIEF
        </div>
        <div className="muted">{title}</div>
        <div className="muted">
          Period: {formatDate(payload.range_start)} → {formatDate(payload.range_end)} · generated{" "}
          {formatDate(payload.generated_at.slice(0, 10))}
        </div>
      </div>

      <p className="brief-how-to-read">
        {HOW_TO_READ}
        <br />
        A one-page explanation of this document for a clinician:{" "}
        <a href={`https://${CLINICIAN_NOTE_URL}`} target="_blank" rel="noreferrer">
          {CLINICIAN_NOTE_URL}
        </a>
      </p>

      <div className="print-section grid-2">
        <EyePanel payload={payload} eye="right" />
        <EyePanel payload={payload} eye="left" />
      </div>

      <hr className="divider" />
      <div className="print-section">
        <div className="card-title">Questions for my doctor</div>
        {payload.questions.length === 0 ? (
          <p className="muted">No pending questions.</p>
        ) : (
          payload.questions.map((q, i) => (
            <div key={i} style={{ fontSize: "var(--fs-base)", marginBottom: 4 }}>
              • {q}
            </div>
          ))
        )}
      </div>

      {payload.drawings.length > 0 && (
        <>
          <hr className="divider" />
          <div className="print-section">
            <div className="card-title">Visual field history</div>
            <div className="btn-row">
              {payload.drawings.slice(0, 8).map((d) => (
                <figure key={d.id} style={{ margin: 0, textAlign: "center" }}>
                  {d.thumbnail && (
                    <img
                      src={d.thumbnail}
                      alt={`${formatDate(d.date_time.slice(0, 10))}. ${d.description ?? "Patient drawing of the field of view."}`}
                      style={{ width: 130, borderRadius: 8, border: "1px solid var(--border)" }}
                    />
                  )}
                  <figcaption className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                    {formatDate(d.date_time.slice(0, 10))} ·{" "}
                    {d.eye === "right" ? "OD" : d.eye === "left" ? "OS" : "OU"}
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="draw-disclaimer">
              Patient-drawn representations of perceived vision — not clinical retinal images.
            </p>
          </div>
        </>
      )}

      <hr className="divider" />
      <div className="print-section">
        <div className="card-title">From clinic records and scans I hold</div>
        {payload.clinicalEvents.length === 0 ? (
          <p className="muted">None recorded in this period.</p>
        ) : (
          payload.clinicalEvents.map((e, i) => (
            <div key={i} style={{ fontSize: "var(--fs-base)", marginBottom: 4 }}>
              <strong>{formatDate(e.date)}</strong> — {e.kind}: {e.title}{" "}
              {e.source_type && e.source_type !== "clinician_reported" && (
                <ProvenanceBadge source={e.source_type} />
              )}
            </div>
          ))
        )}
      </div>

      <hr className="divider" />
      <div className="print-section">
        <div className="card-title">Current treatment</div>
        {payload.treatment.length === 0 ? (
          <p className="muted">No active treatment recorded.</p>
        ) : (
          payload.treatment.map((t, i) => (
            <div key={i} style={{ fontSize: "var(--fs-base)", marginBottom: 4 }}>
              • {t}
            </div>
          ))
        )}
      </div>

      {payload.trends && payload.trends.length > 0 && (
        <>
          <hr className="divider" />
          <div className="print-section">
            <div className="card-title">Recorded numbers in this period</div>
            {payload.trends.map((line, i) => (
              <div key={i} style={{ fontSize: "var(--fs-sm)", marginBottom: 4 }}>
                {line}
              </div>
            ))}
            <p className="muted" style={{ fontSize: "var(--fs-xs)" }}>
              Values as recorded. Afterlight does not interpret them.
            </p>
          </div>
        </>
      )}

      {payload.selfTestNotes && payload.selfTestNotes.length > 0 && (
        <>
          <hr className="divider" />
          <div className="print-section">
            <div className="card-title">Checks the patient did at home</div>
            {payload.selfTestNotes.map((line, i) => (
              <div key={i} style={{ fontSize: "var(--fs-sm)", marginBottom: 4 }}>
                {line}
              </div>
            ))}
            <p className="muted" style={{ fontSize: "var(--fs-xs)" }}>
              Patient-performed checks under home conditions — not clinical measurements.
            </p>
          </div>
        </>
      )}

      <div className="print-footer">{PATIENT_GENERATED_FOOTER}</div>
    </div>
  );
}
