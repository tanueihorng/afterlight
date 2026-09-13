import { useEffect, useRef, useState } from "react";
import { EyeScene, GENERIC_MODEL_BOUNDARY, probeCapability, type EyeSceneOptions } from "../engine";
import { t } from "../lib/i18n";

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
  onPick,
  focusRequest,
  resetSignal,
}: {
  options: Partial<EyeSceneOptions>;
  height?: number;
  onFallback?: (reason: string) => void;
  onPick?: (structure: string | null) => void;
  focusRequest?: { id: string; nonce: number };
  resetSignal?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<EyeScene | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  // Serialised so a new object literal with the same values does not rebuild the scene.
  // Appearance changes retune materials in place; the scene is built once per mount.
  const { view, slice, separation, zoom, ...appearance } = options;
  const key = JSON.stringify(appearance);
  const keyRef = useRef(key);
  keyRef.current = key;

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
      scene = new EyeScene(canvas, {
        ...JSON.parse(key),
        reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : "The 3D view could not start.";
      setUnavailable(reason);
      onFallback?.(reason);
      return;
    }

    sceneRef.current = scene;
    // diagnostics hook: e2e resource tests read renderer.info through it (no page API surface)
    (window as unknown as { __eyeScene?: EyeScene }).__eyeScene = scene;
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
    const onUp = (e: PointerEvent) => {
      if (dragging && onPick) {
        const moved = Math.hypot(e.clientX - last.x, e.clientY - last.y);
        if (moved < 4) {
          const rect = canvas.getBoundingClientRect();
          onPick(scene?.pick(e.clientX - rect.left, e.clientY - rect.top) ?? null);
        }
      }
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
      else if (e.key === "+" || e.key === "=") {
        const current = scene?.currentZoom ?? 1;
        scene?.setZoom(Math.min(1.6, current + 0.15));
      } else if (e.key === "-" || e.key === "_") {
        const current = scene?.currentZoom ?? 1;
        scene?.setZoom(Math.max(0.7, current - 0.15));
      } else return;
      e.preventDefault();
    };
    canvas.addEventListener("keydown", onKey);

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) scene.renderOnce();
    else scene.start();

    return () => {
      delete (window as unknown as { __eyeScene?: EyeScene }).__eyeScene;
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

  useEffect(() => {
    if (view) sceneRef.current?.setView(view);
    if (slice !== undefined) sceneRef.current?.setSlice(slice);
    if (separation !== undefined) sceneRef.current?.setSeparation(separation);
    if (zoom !== undefined) sceneRef.current?.setZoom(zoom);
  }, [view, slice, separation, zoom]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setAppearance(JSON.parse(key));
    }
  }, [key]);

  // camera moves to a structure only on an explicit request from the layer list
  useEffect(() => {
    if (focusRequest && sceneRef.current) {
      sceneRef.current.focusStructure(focusRequest.id);
    }
  }, [focusRequest]);

  // the studio's layer magnification (illustrative) — applied live
  useEffect(() => {
    if (sceneRef.current && typeof options.layerMagnification === "number") {
      sceneRef.current.setLayerMagnification(options.layerMagnification);
    }
  }, [options.layerMagnification]);

  // reset restores state on the mounted scene — never a remount
  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false;
      return;
    }
    if (sceneRef.current) {
      sceneRef.current.setSelected(null);
      sceneRef.current.reset();
    }
  }, [resetSignal]);

  const shellRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shellRef.current?.requestFullscreen();
  };

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
    <figure className="eye-shell" ref={shellRef} style={{ margin: 0, position: "relative" }}>
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
      <button
        type="button"
        className="eye-full-btn"
        aria-pressed={fullscreen}
        aria-label={fullscreen ? t("eye.fullscreen.exit") : t("eye.fullscreen")}
        onClick={toggleFullscreen}
      >
        {fullscreen ? "⤡" : "⛶"}
      </button>
      <figcaption className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 8 }}>
        {GENERIC_MODEL_BOUNDARY}
      </figcaption>
    </figure>
  );
}
