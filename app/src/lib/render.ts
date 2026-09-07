// Shared renderer for visual-field drawings. Coordinates are normalised (0–1) so a
// drawing renders identically at any canvas size.

import type { DrawingMark } from "./models";

export interface Palette {
  bg: string;
  vignette: string;
  fieldEdge: string;
  dark: string;
  light: string;
  amber: string;
  soft: string;
}

export const DARK_PALETTE: Palette = {
  bg: "transparent",
  vignette: "rgba(13, 18, 28, 0)",
  fieldEdge: "rgba(148, 163, 184, 0.25)",
  dark: "#94a3b8",
  light: "#e2e8f0",
  amber: "#f2c078",
  soft: "#64748b",
};

export const LIGHT_PALETTE: Palette = {
  bg: "transparent",
  vignette: "rgba(255,255,255,0)",
  fieldEdge: "rgba(100, 116, 139, 0.35)",
  dark: "#334155",
  light: "#1e293b",
  amber: "#b45309",
  soft: "#94a3b8",
};

function inkColor(ink: DrawingMark["ink"], p: Palette): string {
  switch (ink) {
    case "dark":
      return p.dark;
    case "light":
      return p.light;
    case "amber":
      return p.amber;
    default:
      return p.soft;
  }
}

export function renderMark(ctx: CanvasRenderingContext2D, m: DrawingMark, w: number, h: number, p: Palette) {
  const color = inkColor(m.ink, p);
  const px = (nx: number) => nx * w;
  const py = (ny: number) => ny * h;
  const size = (m.size / 10) * Math.min(w, h) * 0.06 + 1.5;

  ctx.save();
  ctx.globalAlpha = m.opacity;

  switch (m.tool) {
    case "pen": {
      if (!m.points || m.points.length < 2) break;
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(px(m.points[0].x), py(m.points[0].y));
      for (const pt of m.points.slice(1)) ctx.lineTo(px(pt.x), py(pt.y));
      ctx.stroke();
      break;
    }
    case "strand": {
      if (!m.points || m.points.length < 2) break;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, size * 0.55);
      ctx.lineCap = "round";
      ctx.beginPath();
      // wavy strand along the drag path
      ctx.moveTo(px(m.points[0].x), py(m.points[0].y));
      for (let i = 1; i < m.points.length; i++) {
        const prev = m.points[i - 1];
        const cur = m.points[i];
        const mx = (prev.x + cur.x) / 2 + Math.sin(i * 1.7) * 0.012;
        const my = (prev.y + cur.y) / 2 + Math.cos(i * 2.1) * 0.012;
        ctx.quadraticCurveTo(px(prev.x), py(prev.y), px(mx), py(my));
      }
      const last = m.points[m.points.length - 1];
      ctx.lineTo(px(last.x), py(last.y));
      ctx.stroke();
      break;
    }
    case "dot": {
      const r = Math.max(2, size * (m.r ?? 1));
      const g = ctx.createRadialGradient(px(m.x ?? 0), py(m.y ?? 0), 0, px(m.x ?? 0), py(m.y ?? 0), r);
      g.addColorStop(0, color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px(m.x ?? 0), py(m.y ?? 0), r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "ring": {
      const r = (m.w ?? 0.1) * w;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, size * 0.5);
      ctx.beginPath();
      ctx.arc(px(m.x ?? 0), py(m.y ?? 0), r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "blob": {
      const rw = (m.w ?? 0.1) * w;
      const rh = (m.h ?? 0.08) * h;
      const g = ctx.createRadialGradient(px(m.x ?? 0), py(m.y ?? 0), 0, px(m.x ?? 0), py(m.y ?? 0), Math.max(rw, rh));
      g.addColorStop(0, color);
      g.addColorStop(0.7, color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(px(m.x ?? 0), py(m.y ?? 0));
      ctx.scale(1, rh / Math.max(rw, 0.001));
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(rw, 0.001), 0, Math.PI * 2);
      ctx.restore();
      ctx.fill();
      break;
    }
    case "shadow": {
      const x = px(m.x ?? 0);
      const y = py(m.y ?? 0);
      const wpx = (m.w ?? 0.2) * w;
      const hpx = (m.h ?? 0.25) * h;
      const g = ctx.createLinearGradient(x - wpx / 2, y - hpx / 2, x + wpx / 2, y + hpx / 2);
      g.addColorStop(0, color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, wpx / 2, hpx / 2, 0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "flash": {
      const cx = px(m.x ?? 0);
      const cy = py(m.y ?? 0);
      const r = (m.w ?? 0.08) * w + size * 2;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(255, 240, 200, 0.95)");
      g.addColorStop(0.4, p.amber);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      // rays
      ctx.strokeStyle = p.amber;
      ctx.lineWidth = Math.max(1, size * 0.3);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.35, cy + Math.sin(a) * r * 0.35);
        ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
        ctx.stroke();
      }
      break;
    }
    case "blur": {
      const r = (m.w ?? 0.1) * w;
      const g = ctx.createRadialGradient(px(m.x ?? 0), py(m.y ?? 0), 0, px(m.x ?? 0), py(m.y ?? 0), r);
      g.addColorStop(0, "rgba(203, 213, 225, 0.35)");
      g.addColorStop(0.6, "rgba(148, 163, 184, 0.18)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px(m.x ?? 0), py(m.y ?? 0), r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "label": {
      ctx.fillStyle = color;
      ctx.font = `600 ${Math.max(11, size * 2.2)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(m.text ?? "label", px(m.x ?? 0), py(m.y ?? 0));
      break;
    }
  }
  ctx.restore();
}

export function renderDrawing(
  ctx: CanvasRenderingContext2D,
  marks: DrawingMark[],
  w: number,
  h: number,
  p: Palette,
  opts?: { fieldOutline?: boolean }
) {
  ctx.clearRect(0, 0, w, h);
  if (opts?.fieldOutline) {
    ctx.save();
    ctx.strokeStyle = p.fieldEdge;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.46, h * 0.44, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  for (const m of marks) renderMark(ctx, m, w, h, p);
}

/** Render marks to a standalone canvas and return a PNG data URL (thumbnails, demo data). */
export function drawingToDataURL(marks: DrawingMark[], w: number, h: number, bg: string): string {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  renderDrawing(ctx, marks, w, h, DARK_PALETTE, { fieldOutline: true });
  return c.toDataURL("image/png");
}
