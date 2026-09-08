import { describe, expect, it } from "vitest";
import {
  ATLAS,
  REGION_LABELS,
  byRegion,
  conditionById,
  forProfiles,
  matchDiagnosis,
  searchAtlas,
  type Region,
} from "./index";
import { CONDITION_PROFILES } from "../../lib/conditions";
import { SIMULATION_LABELS } from "../simulate/vision";

const REGIONS: Region[] = ["surface", "anterior", "vitreoretina", "optic_nerve"];

describe("the atlas", () => {
  it("covers the whole eye, not just the retina", () => {
    expect(ATLAS.length).toBeGreaterThanOrEqual(40);
    for (const region of REGIONS) {
      expect(byRegion(region).length, `${region} has no entries`).toBeGreaterThan(0);
    }
  });

  it("has unique ids and names", () => {
    expect(new Set(ATLAS.map((c) => c.id)).size).toBe(ATLAS.length);
    expect(new Set(ATLAS.map((c) => c.name)).size).toBe(ATLAS.length);
  });

  it("gives every entry the four things a patient needs", () => {
    for (const c of ATLAS) {
      expect(c.description.length, `${c.id} description`).toBeGreaterThan(30);
      expect(c.experience.length, `${c.id} experience`).toBeGreaterThan(20);
      expect(c.clinical.length, `${c.id} clinical`).toBeGreaterThan(15);
      expect(c.vocabulary.length, `${c.id} vocabulary`).toBeGreaterThan(0);
      expect(REGION_LABELS[c.region]).toBeTruthy();
    }
  });

  it("never tells the reader they have anything, or what to do about it", () => {
    for (const c of ATLAS) {
      const prose = [c.description, c.experience, c.clinical].join(" ");
      expect(prose, `${c.id}`).not.toMatch(/\byou have\b(?! had)/i);
      expect(prose, `${c.id}`).not.toMatch(/\byou (should|must|need to)\b/i);
      expect(prose, `${c.id}`).not.toMatch(/\b(likely|probably) (means|indicates)\b/i);
    }
  });

  it("only points at condition profiles that exist", () => {
    const ids = CONDITION_PROFILES.map((p) => p.id);
    for (const c of ATLAS) {
      for (const profile of c.profiles ?? []) {
        expect(ids, `${c.id} points at unknown profile ${profile}`).toContain(profile);
      }
    }
  });

  it("only uses simulations the simulator knows about", () => {
    for (const c of ATLAS) {
      if (!c.simulation) continue;
      expect(Object.keys(SIMULATION_LABELS)).toContain(c.simulation.kind);
    }
  });
});

describe("severity", () => {
  it("is continuous for gradable conditions: the eye changes as it is dragged", () => {
    for (const c of ATLAS.filter((x) => x.gradable)) {
      const low = JSON.stringify(c.at(0.1));
      const high = JSON.stringify(c.at(0.95));
      expect(low, `${c.id} does not change with severity`).not.toBe(high);
    }
  });

  it("never produces a lesion value outside 0–1", () => {
    for (const c of ATLAS) {
      for (const severity of [0, 0.25, 0.5, 0.75, 1]) {
        const { lesions } = c.at(severity);
        for (const [key, value] of Object.entries(lesions ?? {})) {
          if (typeof value !== "number") continue;
          expect(value, `${c.id}.${key} at ${severity}`).toBeGreaterThanOrEqual(0);
          expect(value, `${c.id}.${key} at ${severity}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("is stable: the same severity always describes the same thing", () => {
    for (const c of ATLAS) {
      expect(JSON.stringify(c.at(0.5))).toBe(JSON.stringify(c.at(0.5)));
    }
  });
});

describe("finding an entry", () => {
  it("looks up by id", () => {
    expect(conditionById("wet_amd")?.name).toMatch(/wet/i);
    expect(conditionById("nonsense")).toBeUndefined();
  });

  it("searches names, prose and clinic vocabulary", () => {
    expect(searchAtlas("drusen").some((c) => c.id === "dry_amd")).toBe(true);
    expect(searchAtlas("macula-off").some((c) => c.id === "rhegmatogenous_detachment")).toBe(true);
    expect(searchAtlas("distortion").length).toBeGreaterThan(0);
  });

  it("returns nothing for a one-character query rather than everything", () => {
    expect(searchAtlas("a")).toEqual([]);
  });

  it("matches a documented diagnosis to an entry, and only when it really matches", () => {
    expect(matchDiagnosis("Rhegmatogenous retinal detachment — macula on")?.id).toBe(
      "rhegmatogenous_detachment",
    );
    expect(matchDiagnosis("Posterior vitreous detachment")?.id).toBe("pvd");
    expect(matchDiagnosis("Some entirely unrelated condition")).toBeUndefined();
  });

  it("relates to the profiles a person is tracking, without ranking against their symptoms", () => {
    const forAmd = forProfiles(["amd"]);
    expect(forAmd.some((c) => c.id === "dry_amd")).toBe(true);
    expect(forAmd.some((c) => c.id === "conjunctivitis")).toBe(false);
    expect(forProfiles([])).toEqual([]);
  });
});
