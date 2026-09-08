import { useMemo } from "react";
import Chart from "./Chart";
import { allSeries, describe } from "../lib/trends";
import { toAllData, useStore } from "../lib/store";
import { EyeBadge } from "./ui";

/**
 * Recorded numbers over time, described and not judged.
 *
 * There is no threshold anywhere here, no colour that means good or bad, and no arrow. The values
 * and the dates are the content; what they mean is a clinician's judgement.
 */
export default function Trends() {
  const store = useStore();
  const series = useMemo(() => allSeries(toAllData(store)), [store]);

  if (series.length === 0) return null;

  return (
    <section className="card">
      <h2 className="card-title">Recorded numbers over time</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Values as they were recorded, with how each was taken. Afterlight does not interpret these
        or say whether a change matters — that is for your clinician.
      </p>

      {series.map((s) => {
        const described = describe(s);
        return (
          <div key={`${s.kind}-${s.eye}`} className="selftest-series">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <strong>{s.label}</strong>
              <EyeBadge eye={s.eye} />
            </div>
            <p style={{ color: "var(--text-2)", margin: "6px 0" }}>{described.summary}</p>
            <Chart series={s} />
            {described.notes.map((note, i) => (
              <p key={i} className="muted" style={{ fontSize: "var(--fs-sm)", margin: "4px 0" }}>
                {note}
              </p>
            ))}
          </div>
        );
      })}
    </section>
  );
}
