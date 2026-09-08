import { useState } from "react";
import { useStore } from "../lib/store";
import { Field } from "./ui";
import { todayLocal } from "../lib/util";
import type { Eye } from "../lib/models";

// First-run onboarding: welcome → history → baseline → start today. Every step skippable.
export default function Onboarding() {
  const store = useStore();
  const [step, setStep] = useState(0);
  const [hadSurgery, setHadSurgery] = useState<"yes" | "no" | null>(null);
  const [surgeryEye, setSurgeryEye] = useState<Eye>("right");
  const [surgeryDate, setSurgeryDate] = useState("");
  const [surgeryType, setSurgeryType] = useState("");
  const [dxText, setDxText] = useState("");
  const [baselineRight, setBaselineRight] = useState("");
  const [baselineLeft, setBaselineLeft] = useState("");

  const finish = async () => {
    if (hadSurgery === "yes" && surgeryType) {
      await store.procedures.put({
        id: crypto.randomUUID(),
        procedure_type: surgeryType,
        date: surgeryDate || todayLocal(),
        eye: surgeryEye,
        indication: dxText || undefined,
        linked_document_ids: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    if (dxText) {
      await store.diagnoses.put({
        id: crypto.randomUUID(),
        name: dxText,
        eye: surgeryEye,
        first_documented: surgeryDate || todayLocal(),
        status: "monitored",
        source_type: "patient_reported",
        confirmed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    if (baselineRight) {
      await store.baselines.put({
        id: "right",
        text: baselineRight,
        established_date: todayLocal(),
        revisions: [{ date: todayLocal(), text: "Baseline established." }],
        updated_at: new Date().toISOString(),
      });
    }
    if (baselineLeft) {
      await store.baselines.put({
        id: "left",
        text: baselineLeft,
        established_date: todayLocal(),
        revisions: [{ date: todayLocal(), text: "Baseline established." }],
        updated_at: new Date().toISOString(),
      });
    }
    await store.setMeta({ onboarded: true });
  };

  return (
    <div
      className="modal-backdrop"
      style={{ background: "rgba(4,6,10,0.88)", zIndex: 100 }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Afterlight"
    >
      <div className="modal" style={{ maxWidth: 560 }}>
        {step === 0 && (
          <>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-xl)" }}>Afterlight</h2>
            <p style={{ color: "var(--text-2)" }}>
              Your vision changes every day. Your medical record usually doesn't.
            </p>
            <p style={{ color: "var(--text-2)" }}>
              Afterlight helps you keep a continuous record of what you see, what your doctors
              observe, and what happens over time — so nothing important depends on memory alone.
            </p>
            <p className="muted">
              Everything stays on this device. Afterlight is a personal record, not a diagnostic
              tool.
            </p>
            <div className="modal-actions">
              <button className="btn subtle" onClick={() => finish()}>
                Skip setup
              </button>
              <button className="btn primary" onClick={() => setStep(1)}>
                Begin
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2>Your eye history</h2>
            <p className="muted">Optional — you can add this later in My Eyes.</p>
            <div className="radio-grid" style={{ margin: "12px 0" }}>
              {(
                [
                  ["yes", "I've had eye surgery"],
                  ["no", "No surgery"],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className={`radio-chip ${hadSurgery === v ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="surgery"
                    checked={hadSurgery === v}
                    onChange={() => setHadSurgery(v)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {hadSurgery === "yes" && (
              <>
                <Field label="Which eye?">
                  <select value={surgeryEye} onChange={(e) => setSurgeryEye(e.target.value as Eye)}>
                    <option value="right">Right Eye (OD)</option>
                    <option value="left">Left Eye (OS)</option>
                    <option value="both">Both Eyes (OU)</option>
                  </select>
                </Field>
                <Field label="Approximate date">
                  <input type="date" value={surgeryDate} onChange={(e) => setSurgeryDate(e.target.value)} />
                </Field>
                <Field label="Procedure">
                  <input
                    type="text"
                    placeholder="e.g. vitrectomy, scleral buckle…"
                    value={surgeryType}
                    onChange={(e) => setSurgeryType(e.target.value)}
                  />
                </Field>
              </>
            )}
            <Field label={hadSurgery === "yes" ? "Known diagnosis" : "Known diagnosis (optional)"}>
              <input
                type="text"
                placeholder="e.g. retinal detachment, lattice degeneration…"
                value={dxText}
                onChange={(e) => setDxText(e.target.value)}
              />
            </Field>
            <div className="modal-actions">
              <button className="btn subtle" onClick={() => setStep(0)}>
                Back
              </button>
              <button className="btn primary" onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Your baseline</h2>
            <p className="muted">
              What does your vision <em>normally</em> look like? Daily logging will focus on
              changes from this, so describe your usual — not today.
            </p>
            <Field label="Right eye (OD) — usual vision">
              <textarea
                placeholder="e.g. 2–3 small dark dots, one translucent strand, no flashes…"
                value={baselineRight}
                onChange={(e) => setBaselineRight(e.target.value)}
              />
            </Field>
            <Field label="Left eye (OS) — usual vision">
              <textarea
                placeholder="e.g. occasional tiny dots, nothing persistent…"
                value={baselineLeft}
                onChange={(e) => setBaselineLeft(e.target.value)}
              />
            </Field>
            <div className="modal-actions">
              <button className="btn subtle" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn primary" onClick={() => setStep(3)}>
                Continue
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2>Start today</h2>
            <p style={{ color: "var(--text-2)" }}>
              You're ready. On the Today page you can log your vision in seconds — or simply tap
              <strong> “No change today”</strong> on ordinary days.
            </p>
            <p className="muted">
              If something is sudden or severe, Afterlight will remind you that urgent changes
              deserve prompt professional assessment — it will never try to diagnose you.
            </p>
            <div className="modal-actions">
              <button className="btn subtle" onClick={() => setStep(2)}>
                Back
              </button>
              <button className="btn primary" onClick={() => finish()}>
                Open Afterlight
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
