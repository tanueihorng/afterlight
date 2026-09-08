import { useState } from "react";
import { CARD_WIDTH_MM, calibrationFromCardWidth, type Calibration } from "../../lib/selftest";

/**
 * Sizes on a screen mean nothing without knowing how big a pixel is. A bank card is 85.6 mm wide
 * and almost everyone has one, so it is the ruler.
 */
export default function ScreenCalibration({
  calibration,
  onChange,
}: {
  calibration: Calibration | null;
  onChange: (c: Calibration | null) => void;
}) {
  const [widthPx, setWidthPx] = useState(calibration ? calibration.px_per_mm * CARD_WIDTH_MM : 320);

  return (
    <div className="card">
      <h3 className="card-title">First, size the screen</h3>
      <p style={{ color: "var(--text-2)", marginTop: 0 }}>
        Hold a bank card flat against the screen and drag the slider until the box is exactly the
        width of the card. Everything after this depends on it, so it is worth doing carefully.
      </p>

      <div
        className="calibration-card"
        style={{ width: `${widthPx}px` }}
        aria-hidden
      />

      <label className="field">
        <span className="field-label">Box width</span>
        <input
          type="range"
          min={160}
          max={640}
          step={1}
          value={widthPx}
          onChange={(e) => {
            const px = Number(e.target.value);
            setWidthPx(px);
            onChange(calibrationFromCardWidth(px));
          }}
        />
      </label>

      <p className="muted" style={{ marginBottom: 0 }}>
        {calibration
          ? `Sized. Keep this device and this setting for future checks, or the results will not be comparable.`
          : "Not sized yet."}
      </p>
    </div>
  );
}
