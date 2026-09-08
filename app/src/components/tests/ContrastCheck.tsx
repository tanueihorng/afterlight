import { useState } from "react";

/** Michelson-ish steps from obvious to very faint. Not a clinical contrast chart. */
export const CONTRAST_STEPS = [0.9, 0.6, 0.4, 0.25, 0.15, 0.1, 0.06, 0.035, 0.02];

/**
 * A contrast check: the same shapes, the same screen, the same brightness, on different days.
 * The only meaningful reading is against the person's own earlier attempts.
 */
export default function ContrastCheck({
  onResult,
}: {
  onResult: (stepIndex: number, contrast: number) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const contrast = CONTRAST_STEPS[stepIndex];
  const shade = Math.round(255 * (1 - contrast));

  return (
    <div className="card">
      <h3 className="card-title">Can you see the circle?</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Each step is fainter than the last. Stop when you cannot see it any more.
      </p>

      <div className="contrast-field">
        <div
          className="contrast-target"
          style={{ background: `rgb(${shade}, ${shade}, ${shade})` }}
          aria-hidden
        />
      </div>

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button
          className="btn primary"
          disabled={stepIndex >= CONTRAST_STEPS.length - 1}
          onClick={() => setStepIndex((i) => Math.min(i + 1, CONTRAST_STEPS.length - 1))}
        >
          I can see it
        </button>
        <button className="btn" onClick={() => onResult(stepIndex, contrast)}>
          I cannot see it — stop here
        </button>
      </div>

      <p className="muted" style={{ marginBottom: 0 }}>
        Step {stepIndex + 1} of {CONTRAST_STEPS.length}.
      </p>
    </div>
  );
}
