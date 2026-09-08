import { describe, expect, it } from "vitest";
import { EYE, discDirection, mm } from "./anatomy/dimensions";
import {
  DEFAULT_IRIS,
  IRIS_PRESETS,
  irisBaseColour,
  pupilForLight,
  pupilRadiusMm,
  toHex,
} from "./anatomy/iris";
import {
  DEFAULT_VESSELS,
  calibreRatio,
  growVessels,
  violatesFAV,
} from "./anatomy/vessels";
import { DEFAULT_FUNDUS, fundusBackground, fundusLayout } from "./anatomy/fundus";
import { GENERIC_MODEL_BOUNDARY } from "./index";
import { TIERS } from "./core/capability";

describe("dimensions", () => {
  it("uses real ocular measurements, not invented ones", () => {
    expect(EYE.axialLength).toBeCloseTo(24, 1);
    expect(EYE.cornea.anteriorRadius).toBeCloseTo(7.8, 1);
    expect(EYE.limbus.diameter).toBeCloseTo(11.7, 1);
    expect(EYE.anteriorChamber.depth).toBeCloseTo(3.1, 1);
    expect(EYE.retina.discWidth).toBeCloseTo(1.8, 1);
  });

  it("keeps the globe wider than it is tall, as a real one is", () => {
    expect(EYE.horizontalDiameter).toBeGreaterThan(EYE.verticalDiameter);
  });

  it("scales millimetres into scene units consistently", () => {
    expect(mm(24)).toBeCloseTo(2.4, 5);
    expect(mm(0)).toBe(0);
  });

  it("puts the optic disc nasal to the fovea, and mirrors it between the eyes", () => {
    const right = discDirection("right");
    const left = discDirection("left");
    expect(Math.sign(right.x)).toBe(1);
    expect(Math.sign(left.x)).toBe(-1);
    expect(right.y).toBeGreaterThan(0); // slightly superior
    expect(right.x).toBeCloseTo(-left.x, 5);
  });
});

describe("the iris colour model", () => {
  it("produces blue from low melanin without any blue pigment", () => {
    const blue = irisBaseColour({ melanin: 0.08, warmth: 0.3 });
    expect(blue.b).toBeGreaterThan(blue.r);
    expect(blue.b).toBeGreaterThan(blue.g);
  });

  it("produces brown from high melanin", () => {
    const brown = irisBaseColour({ melanin: 0.9, warmth: 0.7 });
    expect(brown.r).toBeGreaterThan(brown.b);
    expect(brown.g).toBeGreaterThan(brown.b);
  });

  it("moves continuously between them — one model, not four textures", () => {
    const steps = Array.from({ length: 11 }, (_, i) => irisBaseColour({ melanin: i / 10, warmth: 0.6 }));
    for (let i = 1; i < steps.length; i++) {
      // Blue falls away monotonically as melanin rises.
      expect(steps[i].b).toBeLessThanOrEqual(steps[i - 1].b + 0.001);
    }
  });

  it("keeps every preset inside the representable colour range", () => {
    for (const preset of IRIS_PRESETS) {
      const colour = irisBaseColour({ ...DEFAULT_IRIS, ...preset.params });
      for (const channel of [colour.r, colour.g, colour.b]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
      expect(toHex(colour)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("the pupil", () => {
  it("spans the physiological range", () => {
    expect(pupilForLight(0)).toBeCloseTo(8, 1);
    expect(pupilForLight(1)).toBeCloseTo(2, 1);
  });

  it("constricts fastest at low light levels, as a real pupil does", () => {
    const early = pupilForLight(0) - pupilForLight(0.25);
    const late = pupilForLight(0.75) - pupilForLight(1);
    expect(early).toBeGreaterThan(late);
  });

  it("clamps a nonsensical diameter rather than rendering it", () => {
    expect(pupilRadiusMm({ ...DEFAULT_IRIS, pupilMm: 99 })).toBe(4);
    expect(pupilRadiusMm({ ...DEFAULT_IRIS, pupilMm: -3 })).toBe(1);
  });
});

describe("the vessel tree", () => {
  const segments = growVessels();

  it("grows four arcades with their arteries and veins", () => {
    const trunks = segments.filter((s) => s.depth === 0);
    expect(trunks.length).toBe(8);
    expect(trunks.filter((s) => s.kind === "artery")).toHaveLength(4);
    expect(trunks.filter((s) => s.kind === "vein")).toHaveLength(4);
  });

  it("never enters the foveal avascular zone", () => {
    expect(violatesFAV(segments)).toBe(false);
  });

  it("keeps veins wider than arteries, at roughly the expected ratio", () => {
    const ratio = calibreRatio(segments)!;
    expect(ratio).toBeGreaterThan(1.2);
    expect(ratio).toBeLessThan(1.8);
  });

  it("narrows with each generation", () => {
    const byDepth = new Map<number, number[]>();
    for (const s of segments) byDepth.set(s.depth, [...(byDepth.get(s.depth) ?? []), s.width]);
    const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;
    expect(mean(byDepth.get(1)!)).toBeLessThan(mean(byDepth.get(0)!));
  });

  it("is deterministic: the same seed always grows the same eye", () => {
    const a = growVessels({ ...DEFAULT_VESSELS, seed: 42 });
    const b = growVessels({ ...DEFAULT_VESSELS, seed: 42 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("grows a different tree for a different seed", () => {
    const a = growVessels({ ...DEFAULT_VESSELS, seed: 1 });
    const b = growVessels({ ...DEFAULT_VESSELS, seed: 2 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("stays inside the fundus", () => {
    for (const segment of segments) {
      for (const point of segment.points) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(1);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("the fundus", () => {
  it("puts the disc nasal to the fovea, mirrored between the eyes", () => {
    const right = fundusLayout({ ...DEFAULT_FUNDUS, eye: "right" });
    const left = fundusLayout({ ...DEFAULT_FUNDUS, eye: "left" });
    expect(right.disc.x).toBeGreaterThan(right.fovea.x);
    expect(left.disc.x).toBeLessThan(left.fovea.x);
  });

  it("darkens continuously with pigmentation", () => {
    const fair = fundusBackground(0);
    const dark = fundusBackground(1);
    expect(fair).not.toBe(dark);
    expect(fundusBackground(0.5)).not.toBe(fair);
  });

  it("respects the avascular zone at every pigmentation", () => {
    for (const pigmentation of [0, 0.5, 1]) {
      const layout = fundusLayout({ ...DEFAULT_FUNDUS, pigmentation });
      expect(violatesFAV(layout.segments)).toBe(false);
    }
  });
});

describe("quality tiers", () => {
  it("get progressively heavier, and low never exceeds high", () => {
    expect(TIERS.low.textureSize).toBeLessThan(TIERS.medium.textureSize);
    expect(TIERS.medium.textureSize).toBeLessThan(TIERS.high.textureSize);
    expect(TIERS.low.pixelRatioCap).toBeLessThanOrEqual(TIERS.high.pixelRatioCap);
    expect(TIERS.low.postProcessing).toBe(false);
  });
});

describe("the boundary", () => {
  it("says plainly that this is not the patient's own eye", () => {
    expect(GENERIC_MODEL_BOUNDARY).toMatch(/not your anatomy/i);
    expect(GENERIC_MODEL_BOUNDARY).toMatch(/not built from your scans/i);
    expect(GENERIC_MODEL_BOUNDARY).toMatch(/generic model/i);
  });
});
