// The condition contract.
//
// Every entry in the atlas is a *delta* over the normal eye from the engine, never a bespoke
// picture. That is what makes forty conditions maintainable, and what makes severity a slider
// instead of a set of images.
//
// Nothing here diagnoses. The atlas is a reference someone navigates deliberately; it is never
// surfaced from a person's own symptoms, and it never ranks anything against their record.

import type { FundusLesions } from "../anatomy/fundus";
import type { SimulationKind } from "../simulate/vision";

export type Region = "surface" | "anterior" | "vitreoretina" | "optic_nerve";

export const REGION_LABELS: Record<Region, string> = {
  surface: "Ocular surface",
  anterior: "Anterior segment, lens and pressure",
  vitreoretina: "Vitreous and retina",
  optic_nerve: "Optic nerve",
};

/** Changes to the eye's own parameters, rather than lesions painted over it. */
export interface EyeDelta {
  /** Pupil diameter in mm, where the condition changes it. */
  pupilMm?: number;
  /** Cup-to-disc ratio. */
  cupDisc?: number;
  /** Background pigmentation of the fundus. */
  pigmentation?: number;
  /** Macular pigment. */
  macularPigment?: number;
  /** Vessel calibre and tortuosity multipliers. */
  vesselCalibre?: number;
  vesselTortuosity?: number;
  /** Redness of the white of the eye. */
  scleraVessels?: number;
  /** Corneal clarity, 1 = clear. */
  corneaClarity?: number;
  /** Lens opacity, 0 = clear. */
  lensOpacity?: number;
}

export interface Annotation {
  /** Where the note points, in normalised fundus or cross-section coordinates. */
  x: number;
  y: number;
  text: string;
}

export interface ConditionEntry {
  id: string;
  name: string;
  region: Region;
  /** Which view shows it best. */
  view: "fundus" | "exterior" | "cross_section";
  /** Plain language, for the person reading it. */
  description: string;
  /** What people commonly notice. Descriptive, never a checklist to match against oneself. */
  experience: string;
  /** What a clinician is looking at, so a patient can follow the conversation. */
  clinical: string;
  /** Which imaging shows it. */
  imaging?: string;
  /** Matching Phase 05 condition profiles, if any. */
  profiles?: string[];
  /** Words a clinic uses, so the patient's own paperwork is searchable. */
  vocabulary: string[];
  /**
   * The eye at a given severity, 0 to 1. Continuous where the condition is, so someone can watch
   * how it is described as it progresses — not as a prediction about them.
   */
  at(severity: number): { lesions?: FundusLesions; delta?: EyeDelta };
  annotations?: Annotation[];
  /** How it is experienced from inside, if it changes vision in a way that can be illustrated. */
  simulation?: { kind: SimulationKind; retinalQuadrant?: "superior" | "inferior" | "nasal" | "temporal" };
  /** Whether severity is meaningful for this entry. */
  gradable: boolean;
}
