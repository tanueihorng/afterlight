import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import type { DrawingMark, Eye, VisualFieldDrawing } from "../lib/models";
import { DARK_PALETTE, drawingToDataURL, renderDrawing, renderMark } from "../lib/render";
import { describeDrawing, describeMark } from "../lib/describe";
import { conditionById } from "../engine/conditions";
import { ConfirmButton, DemoBadge, EyeBadge, EmptyState, Field, Modal, PageHeader, ProvenanceBadge } from "../components/ui";
import { formatDate, formatTime, nowISO } from "../lib/util";

const CANVAS_W = 800;
const CANVAS_H = 740;
const DPR = 2;

type Tool = DrawingMark["tool"] | "eraser";

const TOOLS: { id: Tool; glyph: string; label: string }[] = [
  { id: "pen", glyph: "✎", label: "Pen" },
  { id: "dot", glyph: "•", label: "Dot" },
  { id: "strand", glyph: "∿", label: "Strand" },
  { id: "ring", glyph: "○", label: "Ring" },
  { id: "blob", glyph: "⬤", label: "Blob" },
  { id: "shadow", glyph: "◑", label: "Shadow" },
  { id: "flash", glyph: "✦", label: "Flash" },
  { id: "blur", glyph: "◌", label: "Blur" },
  { id: "label", glyph: "T", label: "Label" },
];

const INKS: { id: DrawingMark["ink"]; label: string; css: string }[] = [
  { id: "dark", label: "Dark marks (floaters, shadows)", css: "#94a3b8" },
  { id: "soft", label: "Faint", css: "#64748b" },
  { id: "light", label: "Bright / pale", css: "#e2e8f0" },
  { id: "amber", label: "Light & glare", css: "#f2c078" },
];

/**
 * A starting point handed over from the condition atlas: the person pressed "is this like what
 * you see?" on an illustration. It pre-fills a description and nothing else — a generic picture
 * must never become a record of what someone saw without them saying so.
 */
function takeDraft(): { conditionId: string } | null {
  try {
    const raw = sessionStorage.getItem("afterlight.draft-drawing");
    if (!raw) return null;
    sessionStorage.removeItem("afterlight.draft-drawing");
    return JSON.parse(raw) as { conditionId: string };
  } catch {
    return null;
  }
}

export default function WhatISee() {
  const [tab, setTab] = useState<"draw" | "history" | "compare">("draw");
  return (
    <>
      <PageHeader
        title="What I See"
        sub="Draw floaters, flashes, shadows, blur or anything else you notice. Each drawing becomes a dated snapshot you can compare later."
      />
      <div className="pill-tabs" role="tablist" aria-label="What I See sections">
        {(
          [
            ["draw", "Draw"],
            ["history", "Visual history"],
            ["compare", "Compare two dates"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>
            {label}
          </button>
        ))}
      </div>
      {tab === "draw" && <DrawTab onSaved={() => setTab("history")} />}
      {tab === "history" && <HistoryTab onCompare={() => setTab("compare")} />}
      {tab === "compare" && <CompareTab />}
    </>
  );
}

/* ---------------- Draw ---------------- */

function DrawTab({ onSaved }: { onSaved: () => void }) {
  const store = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("dot");
  const [ink, setInk] = useState<DrawingMark["ink"]>("dark");
  const [size, setSize] = useState(4);
  const [opacity, setOpacity] = useState(0.75);
  const [eye, setEye] = useState<Eye>("left");
  const [description, setDescription] = useState(() => {
    const draft = takeDraft();
    if (!draft) return "";
    const condition = conditionById(draft.conditionId);
    // Their words to finish, not ours to assert. Nothing is saved until they save it.
    return condition
      ? `Comparing with the illustration of ${condition.name}: `
      : "";
  });
  const [draftNotice, setDraftNotice] = useState(() => description.length > 0);
  const [labelText, setLabelText] = useState("");
  const [marks, setMarks] = useState<DrawingMark[]>([]);
  const past = useRef<DrawingMark[][]>([]);
  const future = useRef<DrawingMark[][]>([]);
  const pending = useRef<DrawingMark | null>(null);
  const [count, setCount] = useState(0); // bump to trigger redraw

  const redraw = () => {
    const c = canvasRef.current;
    if (!c) return;
    // A browser can refuse a 2D context. Losing the drawing surface must not take the page down.
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    renderDrawing(ctx, marks, CANVAS_W, CANVAS_H, DARK_PALETTE, { fieldOutline: true });
  };

  useEffect(redraw, [marks, count]);

  const snapshot = () => {
    past.current = [...past.current.slice(-40), marks];
    future.current = [];
  };

  const commit = (m: DrawingMark) => {
    setMarks((prev) => [...prev, m]);
    setCount((c) => c + 1);
  };

  const toNorm = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  /** Pointers currently down, so a pinch is never mistaken for a stroke. */
  const activePointers = useRef<Set<number>>(new Set());
  /** Once a stylus has been used, treat touches as the resting hand. */
  const stylusSeen = useRef(false);

  const baseMark = (): DrawingMark => ({
    id: crypto.randomUUID(),
    tool: tool === "eraser" ? "pen" : tool,
    size,
    opacity,
    ink,
  });

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Palm rejection: once a stylus is in use, ignore the broad touches that come from the hand
    // resting on the screen. Without this, drawing on a tablet produces stray blobs.
    if (e.pointerType === "pen") stylusSeen.current = true;
    if (e.pointerType === "touch" && stylusSeen.current) return;
    if (e.pointerType === "touch" && (e.width > 45 || e.height > 45)) return;

    // A second finger is a pinch, not a second stroke.
    activePointers.current.add(e.pointerId);
    if (activePointers.current.size > 1) {
      pending.current = null;
      redraw();
      return;
    }

    const p = toNorm(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === "eraser") {
      snapshot();
      eraseAt(p);
      return;
    }
    if (tool === "dot") {
      snapshot();
      commit({ ...baseMark(), x: p.x, y: p.y, r: 1 });
      return;
    }
    if (tool === "label") {
      if (!labelText.trim()) return;
      snapshot();
      commit({ ...baseMark(), ink: "light", opacity: 0.9, x: p.x, y: p.y, text: labelText.trim() });
      return;
    }
    snapshot();
    const m = baseMark();
    if (tool === "pen" || tool === "strand") {
      pending.current = { ...m, points: [p] };
    } else {
      pending.current = { ...m, x: p.x, y: p.y, w: 0.01, h: 0.01 };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointers.current.size > 1) return;
    if (e.pointerType === "touch" && stylusSeen.current) return;
    const p = toNorm(e);
    if (tool === "eraser" && e.buttons > 0) {
      eraseAt(p);
      return;
    }
    const m = pending.current;
    if (!m) return;
    if (m.points) {
      m.points = [...m.points, p];
    } else {
      m.w = Math.abs(p.x - (m.x ?? 0)) * 2;
      m.h = Math.abs(p.y - (m.y ?? 0)) * 2;
    }
    redraw();
    const c = canvasRef.current!;
    // A browser can refuse a 2D context. Losing the drawing surface must not take the page down.
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    renderMark(ctx, m, CANVAS_W, CANVAS_H, DARK_PALETTE);
  };

  const onPointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e) activePointers.current.delete(e.pointerId);
    const m = pending.current;
    if (!m) return;
    pending.current = null;
    if (m.points && m.points.length < 2) {
      // treat a tap with pen/strand as a small dot
      commit({ ...m, tool: "dot", points: undefined, x: m.points?.[0].x ?? 0.5, y: m.points?.[0].y ?? 0.5, r: 0.6 });
      return;
    }
    if (!m.points && (m.w ?? 0) < 0.015) {
      commit({ ...m, w: 0.08, h: 0.08 });
      return;
    }
    commit(m);
  };

  const eraseAt = (p: { x: number; y: number }) => {
    const threshold = 0.035;
    setMarks((prev) => {
      const next = prev.filter((m) => {
        if (m.points) {
          return !m.points.some((pt) => Math.hypot(pt.x - p.x, pt.y - p.y) < threshold);
        }
        const r = m.tool === "ring" || m.tool === "blob" || m.tool === "shadow" || m.tool === "flash" || m.tool === "blur" ? (m.w ?? 0.05) : 0.03;
        return Math.hypot((m.x ?? 0) - p.x, (m.y ?? 0) - p.y) > threshold + r;
      });
      return next.length === prev.length ? prev : next;
    });
    setCount((c) => c + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const undo = () => {
    if (past.current.length === 0) return;
    const prev = past.current[past.current.length - 1];
    future.current = [...future.current, marks];
    past.current = past.current.slice(0, -1);
    setMarks(prev);
    setCount((c) => c + 1);
  };

  const redo = () => {
    if (future.current.length === 0) return;
    const next = future.current[future.current.length - 1];
    past.current = [...past.current, marks];
    future.current = future.current.slice(0, -1);
    setMarks(next);
    setCount((c) => c + 1);
  };

  const save = async () => {
    if (marks.length === 0) return;
    const record: VisualFieldDrawing = {
      id: crypto.randomUUID(),
      date_time: nowISO(),
      eye,
      canvas_data: { marks },
      thumbnail: drawingToDataURL(marks, 320, 300, "#0b0f17"),
      description: description || undefined,
      linked_symptoms: [],
      source_type: "patient_drawn",
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    await store.drawings.put(record);
    setMarks([]);
    past.current = [];
    future.current = [];
    setDescription("");
    setCount((c) => c + 1);
    onSaved();
  };

  return (
    <div className="draw-layout">
      <div>
        <div className="draw-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={CANVAS_W * DPR}
            height={CANVAS_H * DPR}
            role="img"
            aria-label={describeDrawing(marks, eye)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerUp}
            // The canvas owns its gestures; the page must not scroll or zoom under the stroke.
            style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, touchAction: "none" }}
          />
        </div>
        {/* The canvas is invisible to a screen reader, so the same content exists as text. It is
            visible to everyone — reading back what you drew is useful sighted too. */}
        <details className="draw-described">
          <summary>What this drawing says, in words ({marks.length})</summary>
          <ul>
            {marks.length === 0 ? (
              <li className="muted">Nothing marked yet.</li>
            ) : (
              marks.map((m) => <li key={m.id}>{describeMark(m)}</li>)
            )}
          </ul>
          <p className="muted">
            Prefer not to draw? Describe what you see in the notes field instead — a written
            description is a first-class entry, not a lesser one.
          </p>
        </details>
        <p className="draw-disclaimer">
          Patient-drawn representation of perceived vision — not a clinical retinal image.
        </p>
      </div>

      <div>
        {draftNotice && (
          <div className="card" role="status">
            <p style={{ color: "var(--text-2)", margin: 0 }}>
              Started from an illustration you were reading about. Draw what <em>you</em> see and
              adjust the description — nothing has been recorded yet, and nothing from the atlas has
              been added to your record.
            </p>
            <button
              className="btn subtle"
              style={{ marginTop: 10 }}
              onClick={() => {
                setDescription("");
                setDraftNotice(false);
              }}
            >
              Start from blank instead
            </button>
          </div>
        )}

        <div className="card">
          <div className="card-title">Tools</div>
          <div className="tool-grid" role="toolbar" aria-label="Drawing tools">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                className={`tool-btn ${tool === t.id ? "selected" : ""}`}
                onClick={() => setTool(t.id)}
                aria-pressed={tool === t.id}
              >
                <span className="tool-glyph" aria-hidden>
                  {t.glyph}
                </span>
                {t.label}
              </button>
            ))}
            <button
              className={`tool-btn ${tool === "eraser" ? "selected" : ""}`}
              onClick={() => setTool("eraser")}
              aria-pressed={tool === "eraser"}
            >
              <span className="tool-glyph" aria-hidden>
                ⌫
              </span>
              Eraser
            </button>
          </div>

          {tool === "label" && (
            <div style={{ marginTop: 12 }}>
              <Field label="Label text">
                <input type="text" value={labelText} onChange={(e) => setLabelText(e.target.value)} placeholder="e.g. shadow when blinking…" />
              </Field>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <span className="field-label">Ink</span>
            <div className="btn-row">
              {INKS.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setInk(i.id)}
                  aria-pressed={ink === i.id}
                  title={i.label}
                  className={`tool-btn ${ink === i.id ? "selected" : ""}`}
                  style={{ width: 42, minHeight: "var(--target)" }}
                >
                  <span style={{ display: "block", width: 16, height: 16, borderRadius: "50%", background: i.css }} aria-hidden />
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <span className="field-label">Size</span>
            <input type="range" min={1} max={10} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Mark size" />
          </div>
          <div style={{ marginTop: 10 }}>
            <span className="field-label">Opacity</span>
            <input type="range" min={10} max={100} value={opacity * 100} onChange={(e) => setOpacity(Number(e.target.value) / 100)} aria-label="Mark opacity" />
          </div>

          <hr className="divider" />
          <div className="btn-row">
            <button className="btn subtle" onClick={undo} disabled={past.current.length === 0}>
              ↶ Undo
            </button>
            <button className="btn subtle" onClick={redo} disabled={future.current.length === 0}>
              ↷ Redo
            </button>
            <button
              className="btn subtle"
              onClick={() => {
                snapshot();
                setMarks([]);
                setCount((c) => c + 1);
              }}
              disabled={marks.length === 0}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Save this snapshot</div>
          <Field label="Eye">
            <select value={eye} onChange={(e) => setEye(e.target.value as Eye)} aria-label="Eye for this drawing">
              <option value="right">Right Eye (OD)</option>
              <option value="left">Left Eye (OS)</option>
              <option value="both">Both Eyes (OU)</option>
            </select>
          </Field>
          <Field label="Describe what you drew (optional)">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. dark dot slightly right of centre…"
            />
          </Field>
          <button className="btn primary" onClick={save} disabled={marks.length === 0} style={{ width: "100%", justifyContent: "center" }}>
            Save drawing · {formatDate(new Date().toISOString().slice(0, 10))}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- History ---------------- */

function HistoryTab({ onCompare }: { onCompare: () => void }) {
  const store = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const drawings = useMemo(
    () => [...store.drawings.list].sort((a, b) => (a.date_time < b.date_time ? 1 : -1)),
    [store.drawings.list]
  );
  const open = drawings.find((d) => d.id === openId) ?? null;

  if (drawings.length === 0) {
    return (
      <EmptyState title="Your visual history starts here.">
        Draw floaters, flashes, shadows, blur, or anything else you notice. Each drawing becomes a
        dated snapshot you can compare later.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="btn-row" style={{ marginBottom: 14 }}>
        <button className="btn" onClick={onCompare}>
          ⇆ Compare two dates
        </button>
        <span className="muted">{drawings.length} drawings, newest first</span>
      </div>
      <div className="gallery">
        {drawings.map((d) => (
          <button key={d.id} className="gallery-item" onClick={() => setOpenId(d.id)}>
            {d.thumbnail ? (
              <img src={d.thumbnail} alt={`${formatDate(d.date_time.slice(0, 10))}. ${describeDrawing(d.canvas_data.marks, d.eye)}`} />
            ) : (
              <div className="img-ph" aria-hidden />
            )}
            <div className="gallery-meta">
              <span>{formatDate(d.date_time.slice(0, 10))}</span>
              <EyeBadge eye={d.eye} />
            </div>
          </button>
        ))}
      </div>
      {open && <DrawingDetail drawing={open} onClose={() => setOpenId(null)} />}
    </>
  );
}

function DrawingDetail({ drawing, onClose }: { drawing: VisualFieldDrawing; onClose: () => void }) {
  const store = useStore();
  const big = useMemo(() => drawingToDataURL(drawing.canvas_data.marks, 800, 740, "#0b0f17"), [drawing]);
  return (
    <Modal title={`Visual field drawing — ${formatDate(drawing.date_time.slice(0, 10))}`} onClose={onClose} wide>
      <img
        src={big}
        alt={describeDrawing(drawing.canvas_data.marks, drawing.eye)}
        style={{ width: "100%", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}
      />
      <p className="draw-disclaimer">Patient-drawn representation of perceived vision — not a clinical retinal image.</p>
      <div className="btn-row" style={{ margin: "12px 0" }}>
        <EyeBadge eye={drawing.eye} />
        <ProvenanceBadge source={drawing.source_type} />
        <DemoBadge demo={drawing.demo} />
        <span className="muted">{formatTime(drawing.date_time)}</span>
      </div>
      {drawing.description && <p style={{ color: "var(--text-2)" }}>{drawing.description}</p>}
      <dl className="kv" style={{ margin: "10px 0" }}>
        <dt>Marks</dt>
        <dd>{drawing.canvas_data.marks.length}</dd>
        <dt>First recorded</dt>
        <dd>{formatDate(drawing.created_at.slice(0, 10))}</dd>
      </dl>
      <div className="modal-actions">
        <ConfirmButton
          label="Delete drawing"
          onConfirm={async () => {
            await store.drawings.del(drawing.id);
            onClose();
          }}
        />
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- Compare ---------------- */

function CompareTab() {
  const store = useStore();
  const drawings = useMemo(
    () => [...store.drawings.list].sort((a, b) => (a.date_time < b.date_time ? 1 : -1)),
    [store.drawings.list]
  );
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const [pos, setPos] = useState(50);

  const a = drawings.find((d) => d.id === aId) ?? null;
  const b = drawings.find((d) => d.id === bId) ?? null;

  const toggle = (id: string) => {
    if (aId === id) return setAId(null);
    if (bId === id) return setBId(null);
    if (!aId) return setAId(id);
    if (!bId) return setBId(id);
    setAId(bId);
    setBId(id);
  };

  if (drawings.length < 2) {
    return (
      <EmptyState title="Compare two dates.">
        Save at least two drawings and you can overlay them here, or place them side by side, to
        see what changed between dates.
      </EmptyState>
    );
  }

  return (
    <>
      <p className="muted" style={{ marginBottom: 12 }}>
        Pick two drawings: first the earlier date, then the later one.
      </p>
      <div className="gallery" style={{ marginBottom: 20 }}>
        {drawings.map((d) => (
          <button
            key={d.id}
            className={`gallery-item ${aId === d.id || bId === d.id ? "selected" : ""}`}
            onClick={() => toggle(d.id)}
            aria-pressed={aId === d.id || bId === d.id}
          >
            {d.thumbnail ? <img src={d.thumbnail} alt="" /> : <div className="img-ph" aria-hidden />}
            <div className="gallery-meta">
              <span>
                {aId === d.id ? "A · " : bId === d.id ? "B · " : ""}
                {formatDate(d.date_time.slice(0, 10))}
              </span>
              <EyeBadge eye={d.eye} />
            </div>
          </button>
        ))}
      </div>

      {a && b && (
        <>
          <div className="card">
            <div className="card-title">
              Overlay — slider reveals the later drawing over the earlier one
            </div>
            <div className="compare-wrap">
              <img src={drawingToDataURL(b.canvas_data.marks, 800, 740, "#0b0f17")} alt={`Later, ${formatDate(b.date_time.slice(0, 10))}. ${describeDrawing(b.canvas_data.marks, b.eye)}`} />
              <div className="compare-overlay" style={{ width: `${pos}%` }}>
                <img
                  src={drawingToDataURL(a.canvas_data.marks, 800, 740, "#0b0f17")}
                  alt={`Earlier, ${formatDate(a.date_time.slice(0, 10))}. ${describeDrawing(a.canvas_data.marks, a.eye)}`}
                  style={{ width: `${(100 / pos) * 100}%`, maxWidth: "none", position: "absolute", inset: 0, height: "100%", objectFit: "cover" }}
                />
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={pos}
              onChange={(e) => setPos(Number(e.target.value))}
              aria-label="Overlay position"
              style={{ marginTop: 12 }}
            />
            <div className="muted">
              Left: {formatDate(a.date_time.slice(0, 10))} · Right: {formatDate(b.date_time.slice(0, 10))}
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: 16 }}>
            {[a, b].map((d, i) => (
              <div className="card" key={d.id}>
                <div className="card-title">
                  {i === 0 ? "Earlier" : "Later"} · {formatDate(d.date_time.slice(0, 10))} <EyeBadge eye={d.eye} />
                </div>
                <img src={d.thumbnail} alt={`${formatDate(d.date_time.slice(0, 10))}. ${describeDrawing(d.canvas_data.marks, d.eye)}`} style={{ width: "100%", borderRadius: "var(--radius-sm)" }} />
                {d.description && <p className="muted" style={{ marginTop: 8 }}>{d.description}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
