import { useMemo, useState } from "react";
import { priorInstances } from "../lib/trends";
import { toAllData, useStore } from "../lib/store";
import { BASELINE_LABELS, type SymptomEntry } from "../lib/models";
import { EyeBadge, Field, Modal } from "./ui";
import { formatDate, isoToDateOnly, nowISO } from "../lib/util";

/**
 * "Is this the same as last time?"
 *
 * The question a clinician actually asks, and the one the record could not answer in one step.
 * This lays every earlier instance side by side; the answer is the patient's to give, and it is
 * recorded as their own note rather than inferred by the app.
 */
export default function SameAsLastTime({
  entry,
  onClose,
}: {
  entry: SymptomEntry;
  onClose: () => void;
}) {
  const store = useStore();
  const [note, setNote] = useState(entry.description ?? "");
  const [verdict, setVerdict] = useState<"same" | "different" | null>(null);
  const [comparedTo, setComparedTo] = useState<string | null>(null);

  const prior = useMemo(
    () => priorInstances(toAllData(store), entry.symptom_type, entry.eye, isoToDateOnly(entry.date_time)),
    [store, entry],
  );

  const save = async () => {
    const target = prior.find((p) => p.record.id === comparedTo);
    const sentence =
      verdict && target
        ? `${verdict === "same" ? "Same as" : "Different from"} ${formatDate(target.date)}.`
        : "";
    await store.symptoms.put({
      ...entry,
      description: [note, sentence].filter(Boolean).join(" ").trim() || undefined,
      updated_at: nowISO(),
    });
    onClose();
  };

  return (
    <Modal title={`Is this the same as last time? — ${entry.symptom_type}`} onClose={onClose} wide>
      <p style={{ color: "var(--text-2)", marginTop: 0 }}>
        Every earlier time you recorded {entry.symptom_type} in this eye. Afterlight does not decide
        whether they are the same — you do, and your answer is saved in your own words.
      </p>

      {prior.length === 0 ? (
        <p className="muted">This is the first time you have recorded it in this eye.</p>
      ) : (
        <table className="table">
          <caption className="visually-hidden">Earlier recordings of this symptom</caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">How it compared then</th>
              <th scope="col">What you wrote</th>
              <th scope="col">
                <span className="visually-hidden">Choose</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {prior.map((p) => (
              <tr key={p.record.id}>
                <td>
                  {formatDate(p.date)}
                  <br />
                  <span className="muted">{p.daysBefore} days before</span>
                </td>
                <td>
                  {p.record.baseline_comparison
                    ? BASELINE_LABELS[p.record.baseline_comparison]
                    : "not recorded"}
                  {p.record.severity !== undefined && ` · severity ${p.record.severity}/10`}
                </td>
                <td>{p.record.description ?? <span className="muted">nothing written</span>}</td>
                <td>
                  <button
                    className={`btn subtle ${comparedTo === p.record.id ? "primary" : ""}`}
                    aria-pressed={comparedTo === p.record.id}
                    onClick={() => setComparedTo(p.record.id)}
                  >
                    Compare with this
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {comparedTo && (
        <fieldset className="pref-group">
          <legend className="field-label">Compared with that one, today is</legend>
          <div className="btn-row">
            <button
              className={`btn ${verdict === "same" ? "primary" : "subtle"}`}
              aria-pressed={verdict === "same"}
              onClick={() => setVerdict("same")}
            >
              The same
            </button>
            <button
              className={`btn ${verdict === "different" ? "primary" : "subtle"}`}
              aria-pressed={verdict === "different"}
              onClick={() => setVerdict("different")}
            >
              Different
            </button>
          </div>
        </fieldset>
      )}

      <Field label="In your own words (optional)">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <EyeBadge eye={entry.eye} />
        <span className="muted">Recorded {formatDate(isoToDateOnly(entry.date_time))}</span>
      </div>

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" onClick={save}>
          Save my answer
        </button>
      </div>
    </Modal>
  );
}
