// Putting a drawing into words.
//
// A canvas is invisible to a screen reader, and "patient drawing" as alt text says nothing. These
// descriptions are generated from the marks themselves, so what a sighted person sees and what a
// screen-reader user hears are the same record — including in the appointment brief.

import type { DrawingMark, Eye } from "./models";
import { EYE_SHORT } from "./models";

/** Nine-cell description of where a mark sits in the field of view. */
export function positionName(x: number, y: number): string {
  const col = x < 0.34 ? "left" : x > 0.66 ? "right" : "centre";
  const row = y < 0.34 ? "upper" : y > 0.66 ? "lower" : "middle";
  if (row === "middle" && col === "centre") return "in the centre";
  if (row === "middle") return `${col} of centre`;
  if (col === "centre") return `${row} centre`;
  return `${row} ${col}`;
}

export function sizeName(size: number): string {
  if (size <= 2) return "very small";
  if (size <= 4) return "small";
  if (size <= 6) return "medium";
  if (size <= 8) return "large";
  return "very large";
}

const TOOL_NOUNS: Record<DrawingMark["tool"], string> = {
  pen: "freehand line",
  dot: "dot",
  strand: "strand",
  ring: "ring",
  blob: "blob",
  shadow: "shadow",
  flash: "flash",
  blur: "blurred area",
  label: "note",
};

const INK_WORDS: Record<DrawingMark["ink"], string> = {
  dark: "dark",
  light: "pale",
  amber: "amber",
  soft: "faint",
};

/** Centre of a mark in normalised coordinates, whatever kind of mark it is. */
function centreOf(m: DrawingMark): { x: number; y: number } | null {
  if (m.points?.length) {
    const sx = m.points.reduce((n, p) => n + p.x, 0) / m.points.length;
    const sy = m.points.reduce((n, p) => n + p.y, 0) / m.points.length;
    return { x: sx, y: sy };
  }
  if (m.x !== undefined && m.y !== undefined) return { x: m.x, y: m.y };
  return null;
}

export function describeMark(m: DrawingMark): string {
  const noun = TOOL_NOUNS[m.tool] ?? "mark";
  const centre = centreOf(m);
  const where = centre ? ` ${positionName(centre.x, centre.y)}` : "";
  if (m.tool === "label") {
    return m.text ? `Note "${m.text}"${where}` : `Note${where}`;
  }
  const faint = m.opacity <= 0.35 ? ", faint" : "";
  return `${sizeName(m.size)} ${INK_WORDS[m.ink]} ${noun}${where}${faint}`;
}

/** One sentence summarising the whole drawing, for alt text and briefs. */
export function describeDrawing(marks: DrawingMark[], eye: Eye): string {
  if (marks.length === 0) {
    return `A drawing of the ${EYE_SHORT[eye]} field of view with nothing marked on it.`;
  }
  const counts = new Map<string, number>();
  for (const m of marks) {
    const noun = TOOL_NOUNS[m.tool] ?? "mark";
    counts.set(noun, (counts.get(noun) ?? 0) + 1);
  }
  const parts = [...counts.entries()].map(
    ([noun, n]) => `${n} ${noun}${n === 1 ? "" : noun.endsWith("s") ? "" : "s"}`,
  );
  return `Patient drawing of the ${EYE_SHORT[eye]} field of view: ${parts.join(", ")}.`;
}

/** Every mark, in words — the text equivalent of looking at the canvas. */
export function describeDrawingInDetail(marks: DrawingMark[], eye: Eye): string[] {
  return [describeDrawing(marks, eye), ...marks.map(describeMark)];
}
