import { describe, expect, it } from "vitest";
import {
  SIMULATION_BOUNDARY,
  SIMULATION_LABELS,
  retinalToField,
  simulate,
  type SimulationKind,
} from "./vision";

/**
 * jsdom has no canvas backend, so these test the parts that decide *what* is drawn — the geometry
 * and the wording — rather than the pixels. The pixels are checked in the browser suite.
 */

describe("retinal to field inversion", () => {
  it("puts a superior retinal problem in the LOWER field", () => {
    // This is the one that must not be backwards: telling a patient to expect a shadow at the top
    // when a superior detachment produces one at the bottom teaches them the opposite of what to
    // report.
    expect(retinalToField("superior").y).toBeGreaterThan(0.5);
  });

  it("puts an inferior retinal problem in the UPPER field", () => {
    expect(retinalToField("inferior").y).toBeLessThan(0.5);
  });

  it("swaps nasal and temporal", () => {
    expect(retinalToField("nasal").x).toBeGreaterThan(0.5);
    expect(retinalToField("temporal").x).toBeLessThan(0.5);
  });

  it("inverts both axes, never just one", () => {
    expect(retinalToField("superior").y + retinalToField("inferior").y).toBeCloseTo(1, 5);
    expect(retinalToField("nasal").x + retinalToField("temporal").x).toBeCloseTo(1, 5);
  });
});

describe("wording", () => {
  it("names every simulation in plain words", () => {
    for (const [kind, label] of Object.entries(SIMULATION_LABELS)) {
      expect(label.length, kind).toBeGreaterThan(3);
      expect(label, kind).not.toMatch(/scotoma|metamorphopsia|hemianopia/i);
    }
  });

  it("carries a boundary that refuses to be read as a measurement", () => {
    expect(SIMULATION_BOUNDARY).toMatch(/not a measurement/i);
    expect(SIMULATION_BOUNDARY).toMatch(/cannot show what you or anyone else actually sees/i);
  });
});

describe("the drawing rules", () => {
  /** A recording context, so the drawing calls can be inspected without a canvas backend. */
  function recorder() {
    const calls: { method: string; args: unknown[] }[] = [];
    const colours: string[] = [];
    const gradientStops: string[] = [];

    const gradient = {
      addColorStop: (_offset: number, colour: string) => gradientStops.push(colour),
    };

    const ctx = new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === "canvas") return { width: 100, height: 100 };
          if (prop === "createRadialGradient" || prop === "createLinearGradient") {
            return () => gradient;
          }
          if (prop === "getImageData") {
            return () => ({ data: new Uint8ClampedArray(100 * 100 * 4), width: 100, height: 100 });
          }
          if (prop === "createImageData") {
            return () => ({ data: new Uint8ClampedArray(100 * 100 * 4), width: 100, height: 100 });
          }
          return (...args: unknown[]) => {
            calls.push({ method: prop, args });
            return undefined;
          };
        },
        set(_target, prop: string, value: unknown) {
          if (typeof value === "string" && (prop === "fillStyle" || prop === "strokeStyle")) {
            colours.push(value);
          }
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;

    return { ctx, calls, colours, gradientStops };
  }

  it("never paints pure black for field loss — real scotomas are not black holes", () => {
    for (const kind of ["peripheral_loss", "arcuate_loss", "central_scotoma", "curtain"] as SimulationKind[]) {
      const r = recorder();
      simulate(r.ctx, 100, 100, { kind, severity: 1 });
      const painted = [...r.colours, ...r.gradientStops];
      for (const colour of painted) {
        expect(colour, `${kind} painted ${colour}`).not.toMatch(/^#000|rgba?\(0,\s*0,\s*0/);
      }
    }
  });

  it("fades field loss out rather than ending it at an edge", () => {
    for (const kind of ["peripheral_loss", "arcuate_loss", "central_scotoma", "curtain"] as SimulationKind[]) {
      const r = recorder();
      simulate(r.ctx, 100, 100, { kind, severity: 0.8 });
      // A gradient that reaches zero alpha is what a soft edge looks like in canvas terms.
      expect(r.gradientStops.some((c) => /,\s*0\)$/.test(c)), `${kind} has no soft edge`).toBe(true);
    }
  });

  it("does nothing at all when there is nothing to show", () => {
    const r = recorder();
    simulate(r.ctx, 100, 100, { kind: "none", severity: 1 });
    simulate(r.ctx, 100, 100, { kind: "central_scotoma", severity: 0 });
    expect(r.calls).toHaveLength(0);
  });

  it("grows with severity rather than switching on", () => {
    const light = recorder();
    const heavy = recorder();
    simulate(light.ctx, 100, 100, { kind: "floaters", severity: 0.2 });
    simulate(heavy.ctx, 100, 100, { kind: "floaters", severity: 1 });
    expect(heavy.calls.length).toBeGreaterThan(light.calls.length);
  });
});
