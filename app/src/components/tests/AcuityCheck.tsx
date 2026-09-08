import { useMemo, useState } from "react";
import { letterHeightPx, stepIsRenderable, type Calibration } from "../../lib/selftest";

/** logMAR steps, coarse enough that a home check is not pretending to clinical precision. */
export const ACUITY_STEPS = [1.0, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0];

const DIRECTIONS = ["up", "right", "down", "left"] as const;
type Direction = (typeof DIRECTIONS)[number];

const ROTATION: Record<Direction, number> = { up: -90, right: 0, down: 90, left: 180 };

function seededDirection(step: number, index: number): Direction {
  // Deterministic per step and position, so the same check is the same each time it is opened.
  return DIRECTIONS[Math.floor(Math.abs(Math.sin((step + 1) * (index + 3)) * 1000)) % 4];
}

/**
 * A tumbling-E check. The person says which way the E points; nothing is scored, and the result
 * is only ever the smallest step they could read at the distance and brightness they recorded.
 */
export default function AcuityCheck({
  calibration,
  distanceCm,
  onResult,
}: {
  calibration: Calibration;
  distanceCm: number;
  onResult: (smallestStepIndex: number, logmar: number) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = ACUITY_STEPS[stepIndex];
  const letters = useMemo(
    () => Array.from({ length: 5 }, (_, i) => seededDirection(step, i)),
    [step],
  );

  const sizePx = letterHeightPx(step, distanceCm, calibration);
  const renderable = stepIsRenderable(step, distanceCm, calibration);

  return (
    <div className="card">
      <h3 className="card-title">Which way do the Es point?</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Cover the other eye. Read the row out loud, then say whether you could read it. Stop when
        you cannot.
      </p>

      {renderable ? (
        <div className="acuity-row" aria-label={`Row ${stepIndex + 1} of ${ACUITY_STEPS.length}`}>
          {letters.map((direction, i) => (
            <span
              key={i}
              className="tumbling-e"
              style={{ fontSize: `${sizePx}px`, transform: `rotate(${ROTATION[direction]}deg)` }}
              aria-hidden
            >
              E
            </span>
          ))}
        </div>
      ) : (
        <p className="muted">
          This row would be smaller than this screen can show honestly at {distanceCm} cm. The
          check stops here rather than showing something that is not the right size.
        </p>
      )}

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button
          className="btn primary"
          disabled={!renderable || stepIndex >= ACUITY_STEPS.length - 1}
          onClick={() => setStepIndex((i) => Math.min(i + 1, ACUITY_STEPS.length - 1))}
        >
          I could read that row
        </button>
        <button className="btn" onClick={() => onResult(stepIndex, step)}>
          I could not read this row — stop here
        </button>
      </div>

      <p className="muted" style={{ marginBottom: 0 }}>
        Row {stepIndex + 1} of {ACUITY_STEPS.length}.
      </p>
    </div>
  );
}
