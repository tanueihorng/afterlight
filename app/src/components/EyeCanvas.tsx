import { useEffect, useRef, useState } from "react";
import {
  EyeScene,
  GENERIC_MODEL_BOUNDARY,
  probeCapability,
  type EyeSceneOptions,
} from "../engine";

/**
 * React wrapper around the engine: mount, resize, dispose, and an honest fallback.
 *
 * If WebGL2 is unavailable the user is told why rather than shown a black rectangle, and the 2D
 * diagrams elsewhere on the page remain the way to understand the same anatomy.
 */
export default function EyeCanvas({
  options,
  height = 420,
  onFallback,
}: {
  options: Partial<EyeSceneOptions>;
  height?: number;
  onFallback?: (reason: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<EyeScene | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  // Serialised so a new object literal with the same values does not rebuild the scene.
  const key = JSON.stringify(options);

  useEffect(() => {
    const capability = probeCapability();
    if (!capability.webgl2) {
      setUnavailable(capability.reason);
      onFallback?.(capability.reason);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    let scene: EyeScene | null = null;
    try {
      scene = new EyeScene(canvas, JSON.parse(key) as Partial<EyeSceneOptions>);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "The 3D view could not start.";
      setUnavailable(reason);
      onFallback?.(reason);
      return;
    }

    sceneRef.current = scene;
    scene.onContextLoss(() =>
      setUnavailable("The 3D view lost its graphics context. Reload the page to bring it back."),
    );

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      scene?.resize(rect.width, rect.height);
      scene?.renderOnce();
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // Drag to turn the model, the way you would turn one in your hand.
    let dragging = false;
    let last = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      last = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      scene?.rotate((e.clientX - last.x) * 0.006, (e.clientY - last.y) * 0.006);
      last = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => {
      dragging = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    // Keyboard equivalent, because a mouse-only control is not a control.
    const onKey = (e: KeyboardEvent) => {
      const step = 0.12;
      if (e.key === "ArrowLeft") scene?.rotate(-step, 0);
      else if (e.key === "ArrowRight") scene?.rotate(step, 0);
      else if (e.key === "ArrowUp") scene?.rotate(0, -step);
      else if (e.key === "ArrowDown") scene?.rotate(0, step);
      else return;
      e.preventDefault();
    };
    canvas.addEventListener("keydown", onKey);

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) scene.renderOnce();
    else scene.start();

    return () => {
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("keydown", onKey);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [key, onFallback]);

  if (unavailable) {
    return (
      <div className="card" role="status">
        <p style={{ color: "var(--text-2)", margin: 0 }}>{unavailable}</p>
        <p className="muted" style={{ marginBottom: 0 }}>
          The labelled diagrams on this page show the same anatomy and work everywhere.
        </p>
      </div>
    );
  }

  return (
    <figure style={{ margin: 0 }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height,
          display: "block",
          borderRadius: "var(--radius-sm)",
          touchAction: "none",
          cursor: "grab",
        }}
        tabIndex={0}
        role="img"
        aria-label={`${GENERIC_MODEL_BOUNDARY} Drag, or use the arrow keys, to turn it.`}
      />
      <figcaption className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 8 }}>
        {GENERIC_MODEL_BOUNDARY}
      </figcaption>
    </figure>
  );
}
