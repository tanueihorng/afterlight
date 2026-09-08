import { describe, expect, it } from "vitest";
import {
  CONDITION_PROFILES,
  profileById,
  promptedSymptoms,
  suggestedMetrics,
  suggestedSelfTests,
} from "./conditions";
import { SYMPTOM_TYPES, MEASUREMENT_LABELS } from "./models";

describe("the profile set", () => {
  it("covers the conditions this app is for, beyond the retina", () => {
    const ids = CONDITION_PROFILES.map((p) => p.id);
    for (const expected of [
      "retinal_detachment",
      "glaucoma",
      "amd",
      "diabetic_eye",
      "uveitis",
      "cornea",
      "dry_eye",
      "cataract",
      "inherited_retinal",
      "optic_nerve",
    ]) {
      expect(ids).toContain(expected);
    }
  });

  it("has unique ids", () => {
    const ids = CONDITION_PROFILES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only prompts for symptoms the app actually supports", () => {
    for (const profile of CONDITION_PROFILES) {
      for (const symptom of profile.symptoms) {
        expect(SYMPTOM_TYPES, `${profile.id} prompts unknown symptom ${symptom}`).toContain(symptom);
      }
    }
  });

  it("only suggests metrics the app can store", () => {
    for (const profile of CONDITION_PROFILES) {
      for (const metric of profile.metrics) {
        expect(Object.keys(MEASUREMENT_LABELS)).toContain(metric);
      }
    }
  });

  it("describes each profile without naming the person as having it", () => {
    for (const profile of CONDITION_PROFILES) {
      expect(profile.blurb.length).toBeGreaterThan(20);
      // "You have X" would make a prompt setting into a diagnosis.
      expect(profile.blurb, `${profile.id} reads as a diagnosis`).not.toMatch(
        /\byou have\b(?! had)/i,
      );
      expect(profile.blurb).not.toMatch(/\byou are diagnosed|your diagnosis is/i);
    }
  });

  it("gives every profile something to prompt and something to record", () => {
    for (const profile of CONDITION_PROFILES) {
      expect(profile.symptoms.length).toBeGreaterThan(0);
      expect(profile.metrics.length).toBeGreaterThan(0);
      expect(profile.vocabulary.length).toBeGreaterThan(0);
    }
  });
});

describe("what a profile changes", () => {
  it("returns nothing when nothing is selected, which means the general set", () => {
    expect(promptedSymptoms([])).toEqual([]);
    expect(suggestedMetrics([])).toEqual([]);
    expect(suggestedSelfTests([])).toEqual([]);
  });

  it("merges several profiles without duplicating", () => {
    const symptoms = promptedSymptoms(["amd", "glaucoma"]);
    expect(new Set(symptoms).size).toBe(symptoms.length);
    expect(symptoms).toContain("distortion");
    expect(symptoms).toContain("visual field loss");
  });

  it("never returns a symptom outside the supported list, whatever is selected", () => {
    const all = promptedSymptoms(CONDITION_PROFILES.map((p) => p.id));
    for (const symptom of all) expect(SYMPTOM_TYPES).toContain(symptom);
  });

  it("ignores an unknown profile id rather than throwing", () => {
    expect(promptedSymptoms(["not_a_profile"])).toEqual([]);
    expect(profileById("not_a_profile")).toBeUndefined();
  });
});
