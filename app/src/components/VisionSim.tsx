import { useEffect, useRef, useState } from "react";
import {
  SIMULATION_BOUNDARY,
  SIMULATION_LABELS,
  simulate,
  type SimulationKind,
} from "../engine/simulate/vision";

/**
 * "Here is roughly what someone with this describes seeing."
 *
 * This is the view a patient cannot get anywhere else — the one that lets someone say *yes, that,
 * that is what I have been trying to describe*, and lets a family member finally understand. It is
 * also the one most easily misread, so the boundary travels with it everywhere.
 */
export default function VisionSim({
  kind,
  severity,
  retinalQuadrant,
  eye = "right",
  onAskIfLikeThis,
}: {
  kind: SimulationKind;
  severity: number;
  retinalQuadrant?: "superior" | "inferior" | "nasal" | "temporal";
  eye?: "right" | "left";
  onAskIfLikeThis?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [customImage, setCustomImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    if (customImage) {
      // Cover-fit whatever the person chose.
      const scale = Math.max(width / customImage.width, height / customImage.height);
      const w = customImage.width * scale;
      const h = customImage.height * scale;
      ctx.drawImage(customImage, (width - w) / 2, (height - h) / 2, w, h);
    } else {
      drawNeutralScene(ctx, width, height);
    }

    simulate(ctx, width, height, { kind, severity, retinalQuadrant, eye });
  }, [kind, severity, retinalQuadrant, eye, customImage]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={640}
        height={420}
        style={{ width: "100%", height: "auto", borderRadius: "var(--radius-sm)", display: "block" }}
        role="img"
        aria-label={`${SIMULATION_LABELS[kind]}. ${SIMULATION_BOUNDARY}`}
      />
      <p className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 8 }}>
        {SIMULATION_BOUNDARY}
      </p>

      <div className="btn-row">
        <label className="btn subtle" style={{ display: "inline-flex", alignItems: "center" }}>
          Use my own photo
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const image = new Image();
              // Processed here on the device and never stored unless the person saves it.
              image.onload = () => setCustomImage(image);
              image.src = URL.createObjectURL(file);
              e.target.value = "";
            }}
          />
        </label>
        {customImage && (
          <button className="btn subtle" onClick={() => setCustomImage(null)}>
            Back to the default scene
          </button>
        )}
        {onAskIfLikeThis && (
          <button className="btn" onClick={onAskIfLikeThis}>
            Is this like what you see?
          </button>
        )}
      </div>
      {customImage && (
        <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>
          Your photo stays on this device and is not saved into your record.
        </p>
      )}
    </div>
  );
}

/** A neutral scene with straight lines and text, because those are what distortion shows up in. */
function drawNeutralScene(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#cfe0ef");
  sky.addColorStop(1, "#eef2f5");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // A building front: straight lines and regular windows.
  ctx.fillStyle = "#8e9aa6";
  ctx.fillRect(width * 0.08, height * 0.2, width * 0.38, height * 0.62);
  ctx.fillStyle = "#dfe7ee";
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      ctx.fillRect(
        width * (0.12 + col * 0.11),
        height * (0.26 + row * 0.14),
        width * 0.07,
        height * 0.09,
      );
    }
  }

  // A doorway and a path, to give depth.
  ctx.fillStyle = "#6d7a86";
  ctx.fillRect(width * 0.2, height * 0.66, width * 0.09, height * 0.16);
  ctx.fillStyle = "#b9b1a4";
  ctx.beginPath();
  ctx.moveTo(width * 0.5, height);
  ctx.lineTo(width * 0.62, height * 0.62);
  ctx.lineTo(width * 0.78, height * 0.62);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#4a5560";
  ctx.font = `${Math.round(height * 0.062)}px Georgia, serif`;
  ctx.fillText("Reading a line of text", width * 0.5, height * 0.28);
  ctx.font = `${Math.round(height * 0.04)}px Georgia, serif`;
  ctx.fillText("and then a smaller line", width * 0.5, height * 0.36);
  ctx.font = `${Math.round(height * 0.026)}px Georgia, serif`;
  ctx.fillText("and smaller still, like a label on a box", width * 0.5, height * 0.43);

  // A light source, so glare and haloes have something to work on.
  const lamp = ctx.createRadialGradient(width * 0.5, height * 0.42, 0, width * 0.5, height * 0.42, height * 0.09);
  lamp.addColorStop(0, "rgba(255, 250, 235, 0.95)");
  lamp.addColorStop(1, "rgba(255, 250, 235, 0)");
  ctx.fillStyle = lamp;
  ctx.beginPath();
  ctx.arc(width * 0.5, height * 0.42, height * 0.09, 0, Math.PI * 2);
  ctx.fill();
}
