// The atlas.
//
// Deliberately a reference someone navigates, never a suggestion engine: nothing here is ever
// ranked against a person's own symptoms, and no part of the app offers "conditions you might
// have". Showing someone forty diseases can plant symptoms that were not there.

import { SURFACE, ANTERIOR } from "./anterior";
import { VITREORETINA } from "./vitreoretina";
import { OPTIC_NERVE } from "./optic";
import type { ConditionEntry, Region } from "./types";

export * from "./types";

export const ATLAS: ConditionEntry[] = [...SURFACE, ...ANTERIOR, ...VITREORETINA, ...OPTIC_NERVE];

export function conditionById(id: string): ConditionEntry | undefined {
  return ATLAS.find((c) => c.id === id);
}

export function byRegion(region: Region): ConditionEntry[] {
  return ATLAS.filter((c) => c.region === region);
}

/**
 * Free-text search over the atlas.
 *
 * Searching by a symptom word is fine — someone looking up "distortion" is reading a reference.
 * Ranking conditions against a person's recorded symptoms is not, and is deliberately absent.
 */
export function searchAtlas(query: string): ConditionEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return ATLAS.filter((c) =>
    [c.name, c.description, c.experience, c.clinical, ...c.vocabulary]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}

/** Atlas entries relevant to the condition profiles a person has chosen in Settings. */
export function forProfiles(profileIds: string[]): ConditionEntry[] {
  if (profileIds.length === 0) return [];
  return ATLAS.filter((c) => c.profiles?.some((p) => profileIds.includes(p)));
}

/** Entries matching a documented diagnosis name, most specific first. */
export function matchDiagnosis(name: string): ConditionEntry | undefined {
  const n = name.toLowerCase();
  const scored = ATLAS.map((c) => {
    const terms = [c.name.toLowerCase(), ...c.vocabulary.map((v) => v.toLowerCase())];
    const hit = terms.filter((t) => n.includes(t)).sort((a, b) => b.length - a.length)[0];
    return { entry: c, score: hit ? hit.length : 0 };
  })
    .filter((x) => x.score > 3)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.entry;
}
