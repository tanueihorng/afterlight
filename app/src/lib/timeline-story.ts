// The timeline read as a story, not a list.
//
// A medical record has events of very different weight: a diagnosis changes everything, a
// symptom log is Tuesday. The detailed list treats them identically; the story view weights
// them, so the clinical spine — diagnosis, surgery, imaging, appointments — reads first, and
// the person's own observations sit quietly along the same line.

import type { TimelineEvent } from "./models";

export type StoryWeight = "milestone" | "treatment" | "observation";

export const STORY_WEIGHT: Record<string, StoryWeight> = {
  diagnosis: "milestone",
  procedure: "milestone",
  appointment: "milestone",
  imaging: "milestone",
  medication: "treatment",
  prescription: "treatment",
  daily_log: "observation",
  symptom: "observation",
  floater: "observation",
  drawing: "observation",
  measurement: "observation",
  document: "observation",
};

export function weightOf(eventType: string): StoryWeight {
  return STORY_WEIGHT[eventType] ?? "observation";
}

/** What the story lens shows: the clinical spine, or everything including daily texture. */
export type StoryLens = "clinical" | "everything";

export function inLens(event: TimelineEvent, lens: StoryLens): boolean {
  return lens === "everything" || weightOf(event.event_type) !== "observation";
}
