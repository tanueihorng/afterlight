import { useState } from "react";
import { useStore, newRecord } from "../lib/store";
import {
  EYE_LABELS,
  MEASUREMENT_LABELS,
  type Diagnosis,
  type Eye,
  type Measurement,
  type Medication,
  type Procedure,
} from "../lib/models";
import { ConfirmButton, Field, Modal, PageHeader, StatusBadge } from "../components/ui";
import Trends from "../components/Trends";
import { formatDate, isoToDateOnly, todayLocal } from "../lib/util";

type EyeSide = "right" | "left";
type ModalKind = "baseline" | "diagnosis" | "procedure" | "medication" | "measurement" | "prescription" | null;

export default function MyEyes() {
  const [modal, setModal] = useState<ModalKind>(null);
  const [editEye, setEditEye] = useState<EyeSide>("right");

  return (
    <>
      <PageHeader
        title="My Eyes"
        sub="A longitudinal profile for each eye: your baseline, what clinicians documented, and what treatment happened. Missing values are shown as “Not recorded” — never as normal."
      />
      <div className="grid-2">
        <EyeProfile eye="right" onEditBaseline={() => { setEditEye("right"); setModal("baseline"); }} onAdd={(k) => setModal(k)} />
        <EyeProfile eye="left" onEditBaseline={() => { setEditEye("left"); setModal("baseline"); }} onAdd={(k) => setModal(k)} />
      </div>
      <Trends />
      <PrescriptionsCard onAdd={() => setModal("prescription")} />
      {modal === "baseline" && <BaselineModal eye={editEye} onClose={() => setModal(null)} />}
      {modal === "diagnosis" && <DiagnosisModal onClose={() => setModal(null)} />}
      {modal === "procedure" && <ProcedureModal onClose={() => setModal(null)} />}
      {modal === "medication" && <MedicationModal onClose={() => setModal(null)} />}
      {modal === "measurement" && <MeasurementModal onClose={() => setModal(null)} />}
      {modal === "prescription" && <PrescriptionModal onClose={() => setModal(null)} />}
    </>
  );
}

/* ---------------- profile column ---------------- */

function EyeProfile({
  eye,
  onEditBaseline,
  onAdd,
}: {
  eye: EyeSide;
  onEditBaseline: () => void;
  onAdd: (k: Exclude<ModalKind, "baseline" | "prescription">) => void;
}) {
  const store = useStore();
  const baseline = store.baselines.list.find((b) => b.id === eye);
  const diagnoses = store.diagnoses.list
    .filter((d) => d.eye === eye || d.eye === "both")
    .sort((a, b) => (a.first_documented < b.first_documented ? 1 : -1));
  const procedures = store.procedures.list
    .filter((p) => p.eye === eye || p.eye === "both")
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const meds = store.medications.list
    .filter((m) => (m.eye === eye || m.eye === "both") && (!m.end_date || m.end_date >= todayLocal()))
    .sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
  const recentSymptoms = store.symptoms.list
    .filter((s) => (s.eye === eye || s.eye === "both") && isoToDateOnly(s.date_time) >= daysBack(14))
    .sort((a, b) => (a.date_time < b.date_time ? 1 : -1));
  const lastImaging = store.imaging.list
    .filter((i) => i.eye === eye || i.eye === "both")
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const lastAcuity = store.measurements.list
    .filter((m) => (m.eye === eye || m.eye === "both") && m.kind === "visual_acuity")
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const lastIop = store.measurements.list
    .filter((m) => (m.eye === eye || m.eye === "both") && m.kind === "iop")
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const nextAppt = store.appointments.list
    .filter((a) => a.date_time >= new Date().toISOString())
    .sort((a, b) => (a.date_time > b.date_time ? 1 : -1))[0];

  return (
    <section className={`card eye-panel ${eye}`} aria-label={EYE_LABELS[eye]}>
      <div className="eye-heading">
        <span className="eye-name">{eye === "right" ? "Right Eye" : "Left Eye"}</span>
        <span className="eye-clinical">{eye === "right" ? "OD" : "OS"}</span>
      </div>

      <div className="card-title">Your baseline</div>
      {baseline ? (
        <p style={{ color: "var(--text-2)", fontSize: "var(--fs-base)" }}>
          {baseline.text}
          <span className="muted"> · established {formatDate(baseline.established_date)}</span>
        </p>
      ) : (
        <p className="muted">No baseline recorded yet.</p>
      )}
      <div className="btn-row" style={{ marginBottom: 6 }}>
        <button className="btn subtle" style={{ minHeight: "var(--target)", fontSize: "var(--fs-sm)" }} onClick={onEditBaseline}>
          Edit baseline
        </button>
      </div>

      <hr className="divider" />
      <div className="card-title">Recent symptoms (14 days)</div>
      {recentSymptoms.length === 0 ? (
        <p className="muted">Nothing recorded in the last two weeks.</p>
      ) : (
        recentSymptoms.slice(0, 6).map((s) => (
          <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 6, fontSize: "var(--fs-sm)" }}>
            <StatusBadge status={s.status} />
            <span>
              <strong>{s.symptom_type}</strong>
              {s.description ? ` — ${s.description}` : ""}
              <span className="muted"> · {formatDate(isoToDateOnly(s.date_time))}</span>
            </span>
          </div>
        ))
      )}

      <hr className="divider" />
      <div className="card-title">Key clinical values</div>
      <dl className="kv">
        <dt>Last visual acuity</dt>
        <dd>{lastAcuity ? `${lastAcuity.value} · ${formatDate(lastAcuity.date)}` : "Not recorded"}</dd>
        <dt>Last eye pressure</dt>
        <dd>{lastIop ? `${lastIop.value}${lastIop.unit ?? " mmHg"} · ${formatDate(lastIop.date)}` : "Not recorded"}</dd>
        <dt>Last imaging</dt>
        <dd>
          {lastImaging ? (
            <>
              {lastImaging.modality.toUpperCase()} · {formatDate(lastImaging.date)}
              {lastImaging.thumb && (
                <img src={lastImaging.thumb} alt={`${lastImaging.modality} thumbnail`} style={{ display: "block", marginTop: 6, maxWidth: 190, borderRadius: 8, border: "1px solid var(--border-soft)" }} />
              )}
            </>
          ) : (
            "Not recorded"
          )}
        </dd>
        <dt>Next appointment</dt>
        <dd>
          {nextAppt ? `${formatDate(nextAppt.date_time.slice(0, 10))}${nextAppt.reason ? ` · ${nextAppt.reason}` : ""}` : "Not recorded"}
        </dd>
      </dl>

      <hr className="divider" />
      <div className="card-title">Diagnoses</div>
      {diagnoses.length === 0 ? (
        <p className="muted">No diagnoses recorded.</p>
      ) : (
        diagnoses.map((d) => (
          <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 6, fontSize: "var(--fs-sm)" }}>
            <StatusBadge status={d.status === "active" ? "new" : d.status === "monitored" ? "same" : d.status === "resolved" || d.status === "historical" ? "resolved" : "same"} />
            <span>
              <strong>{d.name}</strong>
              <span className="muted"> · first documented {formatDate(d.first_documented)}</span>
              {!d.confirmed && <span className="muted"> · unconfirmed</span>}
            </span>
          </div>
        ))
      )}

      <hr className="divider" />
      <div className="card-title">Procedures</div>
      {procedures.length === 0 ? (
        <p className="muted">No procedures recorded.</p>
      ) : (
        procedures.map((p) => (
          <div key={p.id} style={{ marginBottom: 6, fontSize: "var(--fs-sm)" }}>
            <strong>{p.procedure_type}</strong>
            <span className="muted"> · {formatDate(p.date)}</span>
            {p.outcome && <div className="muted">{p.outcome}</div>}
          </div>
        ))
      )}

      <hr className="divider" />
      <div className="card-title">Current medication</div>
      {meds.length === 0 ? (
        <p className="muted">No active medication recorded.</p>
      ) : (
        meds.map((m) => (
          <div key={m.id} style={{ marginBottom: 6, fontSize: "var(--fs-sm)" }}>
            <strong>{m.name}</strong>
            <span className="muted"> · {[m.dose, m.frequency].filter(Boolean).join(", ")}</span>
            <span className="badge" style={{ marginLeft: 6 }}>{m.kind === "prescription" ? "Prescription" : "Self-care"}</span>
          </div>
        ))
      )}

      <hr className="divider" />
      <div className="btn-row">
        <button className="btn subtle" style={{ minHeight: "var(--target)", fontSize: "var(--fs-sm)" }} onClick={() => onAdd("diagnosis")}>+ Diagnosis</button>
        <button className="btn subtle" style={{ minHeight: "var(--target)", fontSize: "var(--fs-sm)" }} onClick={() => onAdd("procedure")}>+ Procedure</button>
        <button className="btn subtle" style={{ minHeight: "var(--target)", fontSize: "var(--fs-sm)" }} onClick={() => onAdd("medication")}>+ Medication</button>
        <button className="btn subtle" style={{ minHeight: "var(--target)", fontSize: "var(--fs-sm)" }} onClick={() => onAdd("measurement")}>+ Measurement</button>
      </div>
    </section>
  );
}

function daysBack(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------------- prescriptions card ---------------- */

function PrescriptionsCard({ onAdd }: { onAdd: () => void }) {
  const store = useStore();
  const list = [...store.prescriptions.list].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="eye-heading">
        <span className="card-title" style={{ marginBottom: 0 }}>Glasses & contact prescription history</span>
        <button className="btn subtle" style={{ minHeight: "var(--target)", fontSize: "var(--fs-sm)" }} onClick={onAdd}>
          + Add prescription
        </button>
      </div>
      {list.length === 0 ? (
        <p className="muted">No prescriptions recorded.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Right (OD) SPH / CYL / AXIS</th>
                <th>Left (OS) SPH / CYL / AXIS</th>
                <th>Provider</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.date)}</td>
                  <td className="mono">{fmtRx(p.right_eye)}</td>
                  <td className="mono">{fmtRx(p.left_eye)}</td>
                  <td>{p.provider ?? "—"}</td>
                  <td>
                    <ConfirmButton label="Delete" onConfirm={() => store.prescriptions.del(p.id)} className="btn danger" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function fmtRx(e: { sphere?: number; cylinder?: number; axis?: number; acuity?: string }): string {
  const parts = [
    e.sphere != null ? (e.sphere > 0 ? `+${e.sphere}` : `${e.sphere}`) : "—",
    e.cylinder != null ? (e.cylinder > 0 ? `+${e.cylinder}` : `${e.cylinder}`) : "—",
    e.axis != null ? `×${e.axis}` : "—",
  ];
  return parts.join(" ");
}

/* ---------------- modals ---------------- */

function BaselineModal({ eye, onClose }: { eye: EyeSide; onClose: () => void }) {
  const store = useStore();
  const existing = store.baselines.list.find((b) => b.id === eye);
  const [text, setText] = useState(existing?.text ?? "");
  return (
    <Modal title={`Baseline — ${EYE_LABELS[eye]}`} onClose={onClose}>
      <p className="muted">
        Describe what this eye is <em>normally</em> like: usual floaters, glare, anything persistent.
        Daily logging compares against this. Missing values are never treated as normal.
      </p>
      <Field label="Baseline description">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      </Field>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          onClick={async () => {
            const base = {
              id: eye as "right" | "left",
              text,
              established_date: existing?.established_date ?? todayLocal(),
              revisions: [...(existing?.revisions ?? []), { date: todayLocal(), text }],
              demo: undefined,
              updated_at: new Date().toISOString(),
            };
            await store.baselines.put(existing ? { ...base, drawing_ref: existing.drawing_ref } : base);
            onClose();
          }}
          disabled={!text.trim()}
        >
          Save baseline
        </button>
      </div>
    </Modal>
  );
}

function DiagnosisModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [d, setD] = useState({ name: "", eye: "right" as Eye, first_documented: todayLocal(), status: "active", clinician: "", clinic: "", notes: "", confirmed: true, source_type: "clinician_reported" });
  return (
    <Modal title="Add diagnosis" onClose={onClose}>
      <Field label="Diagnosis"><input type="text" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
      <div className="grid-2">
        <Field label="Eye">
          <select value={d.eye} onChange={(e) => setD({ ...d, eye: e.target.value as Eye })}>
            <option value="right">Right Eye (OD)</option>
            <option value="left">Left Eye (OS)</option>
            <option value="both">Both Eyes (OU)</option>
          </select>
        </Field>
        <Field label="First documented"><input type="date" value={d.first_documented} onChange={(e) => setD({ ...d, first_documented: e.target.value })} /></Field>
      </div>
      <div className="grid-2">
        <Field label="Status">
          <select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })}>
            {["active", "resolved", "monitored", "historical", "uncertain"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <select value={d.source_type} onChange={(e) => setD({ ...d, source_type: e.target.value })}>
            <option value="clinician_reported">Clinician documented</option>
            <option value="document_extracted">Extracted from document</option>
            <option value="patient_reported">Patient reported</option>
          </select>
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Clinician"><input type="text" value={d.clinician} onChange={(e) => setD({ ...d, clinician: e.target.value })} /></Field>
        <Field label="Clinic"><input type="text" value={d.clinic} onChange={(e) => setD({ ...d, clinic: e.target.value })} /></Field>
      </div>
      <Field label="Notes"><textarea value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} /></Field>
      <label className="check-row">
        <input type="checkbox" checked={d.confirmed} onChange={(e) => setD({ ...d, confirmed: e.target.checked })} />
        Confirmed by a clinician (unchecked = unconfirmed)
      </label>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          disabled={!d.name.trim()}
          onClick={async () => {
            const rec: Diagnosis = {
              ...newRecord({
                name: d.name.trim(),
                eye: d.eye,
                first_documented: d.first_documented,
                status: d.status as Diagnosis["status"],
                clinician: d.clinician || undefined,
                clinic: d.clinic || undefined,
                notes: d.notes || undefined,
                source_type: d.source_type as Diagnosis["source_type"],
                confirmed: d.confirmed,
              }),
            };
            await store.diagnoses.put(rec);
            onClose();
          }}
        >
          Save diagnosis
        </button>
      </div>
    </Modal>
  );
}

function ProcedureModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [p, setP] = useState({ procedure_type: "", date: todayLocal(), eye: "right" as Eye, surgeon: "", facility: "", indication: "", outcome: "" });
  return (
    <Modal title="Add procedure" onClose={onClose}>
      <Field label="Procedure"><input type="text" value={p.procedure_type} onChange={(e) => setP({ ...p, procedure_type: e.target.value })} placeholder="e.g. vitrectomy, scleral buckle, laser photocoagulation…" /></Field>
      <div className="grid-2">
        <Field label="Date"><input type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} /></Field>
        <Field label="Eye">
          <select value={p.eye} onChange={(e) => setP({ ...p, eye: e.target.value as Eye })}>
            <option value="right">Right Eye (OD)</option>
            <option value="left">Left Eye (OS)</option>
            <option value="both">Both Eyes (OU)</option>
          </select>
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Surgeon"><input type="text" value={p.surgeon} onChange={(e) => setP({ ...p, surgeon: e.target.value })} /></Field>
        <Field label="Facility"><input type="text" value={p.facility} onChange={(e) => setP({ ...p, facility: e.target.value })} /></Field>
      </div>
      <Field label="Indication"><textarea value={p.indication} onChange={(e) => setP({ ...p, indication: e.target.value })} /></Field>
      <Field label="Outcome"><textarea value={p.outcome} onChange={(e) => setP({ ...p, outcome: e.target.value })} /></Field>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          disabled={!p.procedure_type.trim()}
          onClick={async () => {
            const rec: Procedure = newRecord({
              procedure_type: p.procedure_type.trim(),
              date: p.date,
              eye: p.eye,
              surgeon: p.surgeon || undefined,
              facility: p.facility || undefined,
              indication: p.indication || undefined,
              outcome: p.outcome || undefined,
              linked_document_ids: [],
            });
            await store.procedures.put(rec);
            onClose();
          }}
        >
          Save procedure
        </button>
      </div>
    </Modal>
  );
}

function MedicationModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [m, setM] = useState({ name: "", kind: "prescription", eye: "right" as Eye, dose: "", frequency: "", start_date: todayLocal(), end_date: "", prescribed_by: "", reason: "" });
  return (
    <Modal title="Add medication" onClose={onClose}>
      <div className="grid-2">
        <Field label="Name"><input type="text" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} /></Field>
        <Field label="Type">
          <select value={m.kind} onChange={(e) => setM({ ...m, kind: e.target.value })}>
            <option value="prescription">Prescription</option>
            <option value="self_care">Self-care routine</option>
          </select>
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Eye">
          <select value={m.eye} onChange={(e) => setM({ ...m, eye: e.target.value as Eye })}>
            <option value="right">Right Eye (OD)</option>
            <option value="left">Left Eye (OS)</option>
            <option value="both">Both Eyes (OU)</option>
          </select>
        </Field>
        <Field label="Dose"><input type="text" value={m.dose} onChange={(e) => setM({ ...m, dose: e.target.value })} placeholder="e.g. 1 drop" /></Field>
      </div>
      <div className="grid-2">
        <Field label="Frequency"><input type="text" value={m.frequency} onChange={(e) => setM({ ...m, frequency: e.target.value })} placeholder="e.g. 4× daily" /></Field>
        <Field label="Start date"><input type="date" value={m.start_date} onChange={(e) => setM({ ...m, start_date: e.target.value })} /></Field>
      </div>
      {m.kind === "prescription" && (
        <div className="grid-2">
          <Field label="Prescribed by"><input type="text" value={m.prescribed_by} onChange={(e) => setM({ ...m, prescribed_by: e.target.value })} /></Field>
          <Field label="Stop date (if ended)"><input type="date" value={m.end_date} onChange={(e) => setM({ ...m, end_date: e.target.value })} /></Field>
        </div>
      )}
      <Field label="Reason / notes"><textarea value={m.reason} onChange={(e) => setM({ ...m, reason: e.target.value })} /></Field>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          disabled={!m.name.trim()}
          onClick={async () => {
            const rec: Medication = newRecord({
              name: m.name.trim(),
              kind: m.kind as Medication["kind"],
              eye: m.eye,
              dose: m.dose || undefined,
              frequency: m.frequency || undefined,
              start_date: m.start_date,
              end_date: m.end_date || undefined,
              prescribed_by: m.prescribed_by || undefined,
              reason: m.reason || undefined,
            });
            await store.medications.put(rec);
            onClose();
          }}
        >
          Save medication
        </button>
      </div>
    </Modal>
  );
}

function MeasurementModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [m, setM] = useState({ kind: "visual_acuity", eye: "right" as Eye, date: todayLocal(), value: "", unit: "", note: "", source_type: "clinician_reported" });
  return (
    <Modal title="Add measurement" onClose={onClose}>
      <div className="grid-2">
        <Field label="Type">
          <select value={m.kind} onChange={(e) => setM({ ...m, kind: e.target.value })}>
            {(Object.keys(MEASUREMENT_LABELS) as (keyof typeof MEASUREMENT_LABELS)[]).map((k) => (
              <option key={k} value={k}>{MEASUREMENT_LABELS[k]}</option>
            ))}
          </select>
        </Field>
        <Field label="Eye">
          <select value={m.eye} onChange={(e) => setM({ ...m, eye: e.target.value as Eye })}>
            <option value="right">Right Eye (OD)</option>
            <option value="left">Left Eye (OS)</option>
            <option value="both">Both Eyes (OU)</option>
          </select>
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Date"><input type="date" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} /></Field>
        <Field label="Value"><input type="text" value={m.value} onChange={(e) => setM({ ...m, value: e.target.value })} placeholder={m.kind === "iop" ? "e.g. 14" : "e.g. 20/25"} /></Field>
      </div>
      <Field label="Unit (optional)"><input type="text" value={m.unit} onChange={(e) => setM({ ...m, unit: e.target.value })} placeholder="e.g. mmHg" /></Field>
      <Field label="Source">
        <select value={m.source_type} onChange={(e) => setM({ ...m, source_type: e.target.value })}>
          <option value="clinician_reported">Clinician documented</option>
          <option value="device_measurement">Device measurement</option>
          <option value="patient_reported">Patient reported</option>
        </select>
      </Field>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          disabled={!m.value.trim()}
          onClick={async () => {
            const rec: Measurement = newRecord({
              date: m.date,
              eye: m.eye,
              kind: m.kind as Measurement["kind"],
              value: m.value.trim(),
              unit: m.unit || undefined,
              note: m.note || undefined,
              source_type: m.source_type as Measurement["source_type"],
            });
            await store.measurements.put(rec);
            onClose();
          }}
        >
          Save measurement
        </button>
      </div>
    </Modal>
  );
}

function PrescriptionModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const num = (v: string) => (v === "" ? undefined : Number(v));
  const [p, setP] = useState({
    date: todayLocal(),
    rs: "", rc: "", ra: "", rAcuity: "",
    ls: "", lc: "", la: "", lAcuity: "",
    provider: "",
  });
  return (
    <Modal title="Add glasses / contact prescription" onClose={onClose}>
      <Field label="Date"><input type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} /></Field>
      <div className="grid-2">
        <div>
          <div className="card-title">Right eye (OD)</div>
          <Field label="Sphere"><input type="number" step="0.25" value={p.rs} onChange={(e) => setP({ ...p, rs: e.target.value })} /></Field>
          <Field label="Cylinder"><input type="number" step="0.25" value={p.rc} onChange={(e) => setP({ ...p, rc: e.target.value })} /></Field>
          <Field label="Axis"><input type="number" step="1" value={p.ra} onChange={(e) => setP({ ...p, ra: e.target.value })} /></Field>
          <Field label="Acuity"><input type="text" value={p.rAcuity} onChange={(e) => setP({ ...p, rAcuity: e.target.value })} placeholder="e.g. 20/25" /></Field>
        </div>
        <div>
          <div className="card-title">Left eye (OS)</div>
          <Field label="Sphere"><input type="number" step="0.25" value={p.ls} onChange={(e) => setP({ ...p, ls: e.target.value })} /></Field>
          <Field label="Cylinder"><input type="number" step="0.25" value={p.lc} onChange={(e) => setP({ ...p, lc: e.target.value })} /></Field>
          <Field label="Axis"><input type="number" step="1" value={p.la} onChange={(e) => setP({ ...p, la: e.target.value })} /></Field>
          <Field label="Acuity"><input type="text" value={p.lAcuity} onChange={(e) => setP({ ...p, lAcuity: e.target.value })} placeholder="e.g. 20/20" /></Field>
        </div>
      </div>
      <Field label="Provider"><input type="text" value={p.provider} onChange={(e) => setP({ ...p, provider: e.target.value })} /></Field>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          onClick={async () => {
            const rec = newRecord({
              date: p.date,
              right_eye: { sphere: num(p.rs), cylinder: num(p.rc), axis: num(p.ra), acuity: p.rAcuity || undefined },
              left_eye: { sphere: num(p.ls), cylinder: num(p.lc), axis: num(p.la), acuity: p.lAcuity || undefined },
              provider: p.provider || undefined,
            });
            await store.prescriptions.put(rec);
            onClose();
          }}
        >
          Save prescription
        </button>
      </div>
    </Modal>
  );
}
