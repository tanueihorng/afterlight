import { useMemo } from "react";
import { DEFAULT_FUNDUS, paintFundus, type FundusParams } from "../engine";
import type { ConditionEntry } from "../engine/conditions";

/**
 * One fundus, painted from a condition at a severity. Rendered to a data URL rather than a live
 * canvas so two of them can sit side by side cheaply in compare mode.
 */
export function fundusDataURL(params: FundusParams, size = 480): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  paintFundus(ctx, size, params);
  return canvas.toDataURL("image/png");
}

export function paramsFor(
  condition: ConditionEntry | null,
  severity: number,
  eye: "right" | "left",
): FundusParams {
  const state = condition?.at(severity) ?? {};
  const delta = state.delta ?? {};
  return {
    ...DEFAULT_FUNDUS,
    eye,
    pigmentation: delta.pigmentation ?? DEFAULT_FUNDUS.pigmentation,
    macularPigment: delta.macularPigment ?? DEFAULT_FUNDUS.macularPigment,
    cupDisc: delta.cupDisc ?? DEFAULT_FUNDUS.cupDisc,
    vessels: {
      calibre: delta.vesselCalibre ?? 1,
      tortuosity: delta.vesselTortuosity ?? 1,
    },
    lesions: state.lesions,
  };
}

export default function FundusFigure({
  condition,
  severity,
  eye,
  caption,
  size = 420,
}: {
  condition: ConditionEntry | null;
  severity: number;
  eye: "right" | "left";
  caption?: string;
  size?: number;
}) {
  const src = useMemo(
    () => fundusDataURL(paramsFor(condition, severity, eye), size),
    [condition, severity, eye, size],
  );

  if (!src) return null;

  const alt = condition
    ? `Generic illustration of ${condition.name} as it appears inside a ${eye === "right" ? "right" : "left"} eye. Not anyone's retina.`
    : `Generic illustration of the inside of a healthy ${eye === "right" ? "right" : "left"} eye. Not anyone's retina.`;

  return (
    <figure style={{ margin: 0 }}>
      <img src={src} alt={alt} style={{ width: "100%", borderRadius: "50%", border: "1px solid var(--border)" }} />
      {caption && (
        <figcaption className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 6, textAlign: "center" }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
