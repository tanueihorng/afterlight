import { useEffect, useRef, useState } from "react";
import type { DrawingMark } from "../../lib/models";
import { describeMark } from "../../lib/describe";

const SIZE = 420;
const CELLS = 20;

/**
 * An Amsler grid with a drawable overlay: the point is not "did you see something", it is *where*
 * and *what shape*, which is exactly what a patient cannot describe in words at an appointment.
 *
 * Marks are the same `DrawingMark` shape the visual-field canvas uses, so they store, render,
 * describe and export through the existing machinery rather than a second copy of it.
 */
export default function AmslerGrid({
  marks,
  onChange,
  eye,
}: {
  marks: DrawingMark[];
  onChange: (marks: DrawingMark[]) => void;
  eye: "right" | "left";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const stroke = useRef<DrawingMark | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1;
    const step = SIZE / CELLS;
    ctx.beginPath();
    for (let i = 0; i <= CELLS; i++) {
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, SIZE);
      ctx.moveTo(0, i * step);
      ctx.lineTo(SIZE, i * step);
    }
    ctx.stroke();

    // The fixation dot: the whole test depends on looking only at this.
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // What the person marked.
    ctx.strokeStyle = "#c62828";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const all = stroke.current ? [...marks, stroke.current] : marks;
    for (const mark of all) {
      if (!mark.points?.length) continue;
      ctx.beginPath();
      mark.points.forEach((p, i) => {
        const x = p.x * SIZE;
        const y = p.y * SIZE;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [marks, drawing]);

  const toNorm = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="amsler"
        style={{ width: SIZE, maxWidth: "100%", aspectRatio: "1 / 1", touchAction: "none" }}
        role="img"
        aria-label={`Amsler grid for the ${eye} eye, with ${marks.length} area${marks.length === 1 ? "" : "s"} marked.`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrawing(true);
          stroke.current = {
            id: crypto.randomUUID(),
            tool: "pen",
            points: [toNorm(e)],
            size: 3,
            opacity: 1,
            ink: "dark",
          };
        }}
        onPointerMove={(e) => {
          if (!drawing || !stroke.current) return;
          stroke.current.points = [...(stroke.current.points ?? []), toNorm(e)];
          setDrawing(true);
          // Force a repaint through the effect's dependency on `drawing`.
          setDrawing((d) => d);
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (!ctx || !stroke.current.points) return;
          ctx.strokeStyle = "#c62828";
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          const pts = stroke.current.points;
          const a = pts[pts.length - 2];
          const b = pts[pts.length - 1];
          if (!a) return;
          ctx.beginPath();
          ctx.moveTo(a.x * SIZE, a.y * SIZE);
          ctx.lineTo(b.x * SIZE, b.y * SIZE);
          ctx.stroke();
        }}
        onPointerUp={() => {
          if (stroke.current && (stroke.current.points?.length ?? 0) > 1) {
            onChange([...marks, stroke.current]);
          }
          stroke.current = null;
          setDrawing(false);
        }}
        onPointerCancel={() => {
          stroke.current = null;
          setDrawing(false);
        }}
      />

      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn subtle" onClick={() => onChange(marks.slice(0, -1))} disabled={marks.length === 0}>
          Undo last mark
        </button>
        <button className="btn subtle" onClick={() => onChange([])} disabled={marks.length === 0}>
          Clear
        </button>
      </div>

      <details className="draw-described">
        <summary>What you marked, in words ({marks.length})</summary>
        <ul>
          {marks.length === 0 ? (
            <li className="muted">Nothing marked.</li>
          ) : (
            marks.map((m) => <li key={m.id}>{describeMark(m)}</li>)
          )}
        </ul>
      </details>
    </div>
  );
}
