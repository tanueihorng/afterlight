// The add and edit forms for clinical history records. They live outside the My Eyes page because
// the Timeline offers them too, and importing them from the page pulled the whole of My Eyes into
// the first download.

import { useState } from "react";
import { useStore, newRecord } from "../lib/store";
import { medicationSource, type Diagnosis, type Eye, type Medication, type Procedure } from "../lib/models";
import { Field, Modal } from "./ui";
import { nowISO, todayLocal } from "../lib/util";

export function DiagnosisModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [d, setD] = useState({ name: "", eye: "right" as Eye, first_documented: todayLocal(), status: "active", clinician: "", clinic: "", notes: "", confirmed: false, source_type: "clinician_reported" });
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

export function ProcedureModal({ existing, onClose }: { existing?: Procedure; onClose: () => void }) {
  const store = useStore();
  const [p, setP] = useState({
    procedure_type: existing?.procedure_type ?? "",
    date: existing?.date ?? todayLocal(),
    eye: existing?.eye ?? ("right" as Eye),
    surgeon: existing?.surgeon ?? "",
    facility: existing?.facility ?? "",
    indication: existing?.indication ?? "",
    outcome: existing?.outcome ?? "",
    source_type: existing?.source_type ?? ("clinician_reported" as Procedure["source_type"]),
  });
  return (
    <Modal title={existing ? "Edit procedure" : "Add procedure"} onClose={onClose}>
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
      <Field label="Source">
        <select value={p.source_type} onChange={(e) => setP({ ...p, source_type: e.target.value as Procedure["source_type"] })}>
          <option value="clinician_reported">Clinician documented</option>
          <option value="patient_reported">Patient reported</option>
        </select>
      </Field>
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
            const fields = {
              procedure_type: p.procedure_type.trim(),
              date: p.date,
              eye: p.eye,
              surgeon: p.surgeon || undefined,
              facility: p.facility || undefined,
              indication: p.indication || undefined,
              outcome: p.outcome || undefined,
              source_type: p.source_type,
            };
            // An edit keeps the record's identity, operative note and links. It drops the demo flag:
            // once someone has typed their own values in, removing demo data must not delete them.
            const rec: Procedure = existing
              ? { ...existing, ...fields, demo: undefined, updated_at: nowISO() }
              : newRecord({ ...fields, linked_document_ids: [] });
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

export function MedicationModal({ onClose }: { onClose: () => void }) {
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
              source_type: medicationSource(m.kind as Medication["kind"]),
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
