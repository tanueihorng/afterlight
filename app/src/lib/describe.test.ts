import { describe, expect, it } from "vitest";
import {
  describeDrawing,
  describeDrawingInDetail,
  describeMark,
  positionName,
  sizeName,
} from "./describe";
import type { DrawingMark } from "./models";

const mark = (over: Partial<DrawingMark> = {}): DrawingMark => ({
  id: "m1",
  tool: "dot",
  x: 0.5,
  y: 0.5,
  size: 4,
  opacity: 1,
  ink: "dark",
  ...over,
});

describe("sizeName", () => {
  it("covers the whole stroke range in plain words", () => {
    expect(sizeName(1)).toBe("very small");
    expect(sizeName(5)).toBe("medium");
    expect(sizeName(10)).toBe("very large");
  });
});

describe("positionName", () => {
  it("names the centre without repeating itself", () => {
    expect(positionName(0.5, 0.5)).toBe("in the centre");
  });

  it("names each quadrant", () => {
    expect(positionName(0.1, 0.1)).toBe("upper left");
    expect(positionName(0.9, 0.9)).toBe("lower right");
    expect(positionName(0.9, 0.5)).toBe("right of centre");
    expect(positionName(0.5, 0.1)).toBe("upper centre");
  });
});

describe("describeMark", () => {
  it("describes size, tone, kind and position", () => {
    expect(describeMark(mark({ size: 2, ink: "dark", tool: "dot", x: 0.8, y: 0.2 }))).toBe(
      "very small dark dot upper right",
    );
  });

  it("mentions faintness, which is clinically part of what the patient sees", () => {
    expect(describeMark(mark({ opacity: 0.2 }))).toContain("faint");
  });

  it("quotes a note's own words", () => {
    expect(describeMark(mark({ tool: "label", text: "worse in bright light" }))).toContain(
      '"worse in bright light"',
    );
  });

  it("averages a freehand stroke to describe where it sits", () => {
    const stroke = mark({
      tool: "pen",
      points: [
        { x: 0.05, y: 0.05 },
        { x: 0.15, y: 0.15 },
      ],
      x: undefined,
      y: undefined,
    });
    expect(describeMark(stroke)).toContain("upper left");
  });
});

describe("describeDrawing", () => {
  it("says plainly when nothing has been drawn", () => {
    expect(describeDrawing([], "left")).toMatch(/nothing marked/);
  });

  it("counts each kind of mark and names the eye", () => {
    const text = describeDrawing([mark(), mark(), mark({ tool: "shadow" })], "right");
    expect(text).toContain("Right (OD)");
    expect(text).toContain("2 dots");
    expect(text).toContain("1 shadow");
  });

  it("always identifies itself as a patient drawing, never as an image of the eye", () => {
    expect(describeDrawing([mark()], "left")).toMatch(/^Patient drawing/);
  });
});

describe("describeDrawingInDetail", () => {
  it("leads with the summary then lists every mark", () => {
    const lines = describeDrawingInDetail([mark(), mark({ tool: "flash" })], "left");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^Patient drawing/);
  });
});
