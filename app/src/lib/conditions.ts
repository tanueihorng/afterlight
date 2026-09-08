// Condition profiles.
//
// A profile changes what Afterlight *asks*, and nothing else. It is not a diagnosis, it is never
// displayed as one, and it never restricts what can be recorded — every symptom, metric and test
// stays available to everyone. Someone with a glaucoma profile who wants to log distortion can.
//
// Everything a profile prompts for must be answerable by the patient. Nothing here interprets an
// answer, and nothing here is clinical guidance.

import type { MeasurementKind, SymptomType } from "./models";

export type SelfTestId = "amsler" | "home_acuity" | "contrast" | "colour";

export interface ConditionProfile {
  id: string;
  label: string;
  /** Plain-language description of who might pick this. Never phrased as a diagnosis. */
  blurb: string;
  /** Symptom types worth offering first for this profile. */
  symptoms: SymptomType[];
  /** Metrics a clinic commonly records for this, so the record has somewhere to put them. */
  metrics: MeasurementKind[];
  /** Self-tests that make sense to repeat at home for this. */
  selfTests: SelfTestId[];
  /** Words the clinic tends to use, so search finds the patient's own paperwork. */
  vocabulary: string[];
}

export const CONDITION_PROFILES: ConditionProfile[] = [
  {
    id: "retinal_detachment",
    label: "Retinal detachment or tear",
    blurb: "You have had a detachment or a tear treated, or are being watched for one.",
    symptoms: ["floaters", "flashes", "shadow / curtain", "visual field loss", "blur", "distortion"],
    metrics: ["visual_acuity", "iop", "oct_cst"],
    selfTests: ["amsler", "home_acuity"],
    vocabulary: ["rhegmatogenous", "vitrectomy", "scleral buckle", "tamponade", "macula-on", "macula-off"],
  },
  {
    id: "pvd_floaters",
    label: "Floaters and posterior vitreous detachment",
    blurb: "You are tracking floaters, flashes, or a vitreous detachment.",
    symptoms: ["floaters", "flashes", "blur"],
    metrics: ["visual_acuity"],
    selfTests: ["amsler"],
    vocabulary: ["PVD", "Weiss ring", "vitreous opacity"],
  },
  {
    id: "glaucoma",
    label: "Glaucoma or raised eye pressure",
    blurb: "You are being treated or monitored for eye pressure or optic nerve changes.",
    symptoms: ["visual field loss", "halos", "pain", "blur", "reduced vision"],
    metrics: ["iop", "cct", "vf_md", "vf_psd", "vf_vfi", "visual_acuity"],
    selfTests: ["home_acuity", "contrast"],
    vocabulary: ["IOP", "cup-to-disc", "trabeculectomy", "MIGS", "latanoprost", "timolol", "visual field"],
  },
  {
    id: "amd",
    label: "Macular degeneration",
    blurb: "You are tracking dry or wet AMD, including any injections you receive.",
    symptoms: ["distortion", "blur", "reduced vision", "glare", "other"],
    metrics: ["visual_acuity", "oct_cst"],
    selfTests: ["amsler", "home_acuity", "contrast"],
    vocabulary: ["drusen", "geographic atrophy", "CNV", "anti-VEGF", "aflibercept", "ranibizumab", "bevacizumab"],
  },
  {
    id: "diabetic_eye",
    label: "Diabetic eye disease",
    blurb: "You are tracking diabetic retinopathy or macular oedema.",
    symptoms: ["blur", "floaters", "distortion", "reduced vision", "visual field loss"],
    metrics: ["visual_acuity", "oct_cst", "hba1c", "blood_pressure"],
    selfTests: ["amsler", "home_acuity"],
    vocabulary: ["retinopathy", "maculopathy", "PRP", "laser", "anti-VEGF", "HbA1c"],
  },
  {
    id: "vein_occlusion",
    label: "Retinal vein occlusion",
    blurb: "You are tracking a branch or central vein occlusion.",
    symptoms: ["blur", "distortion", "reduced vision", "visual field loss"],
    metrics: ["visual_acuity", "oct_cst", "blood_pressure", "iop"],
    selfTests: ["amsler", "home_acuity"],
    vocabulary: ["BRVO", "CRVO", "macular oedema", "anti-VEGF"],
  },
  {
    id: "uveitis",
    label: "Uveitis or eye inflammation",
    blurb: "You are tracking inflammation inside the eye, including flare-ups.",
    symptoms: ["pain", "redness", "light sensitivity", "blur", "floaters"],
    metrics: ["iop", "visual_acuity", "oct_cst"],
    selfTests: ["home_acuity"],
    vocabulary: ["anterior uveitis", "iritis", "flare", "keratic precipitates", "steroid taper"],
  },
  {
    id: "cornea",
    label: "Corneal conditions",
    blurb: "Keratoconus, dystrophy, scarring, or another corneal condition.",
    symptoms: ["blur", "distortion", "glare", "halos", "pain", "light sensitivity"],
    metrics: ["visual_acuity", "cct"],
    selfTests: ["home_acuity", "contrast"],
    vocabulary: ["keratoconus", "cross-linking", "topography", "pachymetry", "graft"],
  },
  {
    id: "dry_eye",
    label: "Dry eye and ocular surface",
    blurb: "You are tracking dryness, grittiness or surface discomfort.",
    symptoms: ["dryness", "blur", "glare", "redness", "light sensitivity", "pain"],
    metrics: ["visual_acuity"],
    selfTests: ["contrast"],
    vocabulary: ["tear film", "meibomian", "blepharitis", "artificial tears", "punctal plug"],
  },
  {
    id: "cataract",
    label: "Cataract or lens implant",
    blurb: "You are tracking a cataract before surgery, or vision after a lens implant.",
    symptoms: ["glare", "halos", "blur", "reduced vision", "double vision"],
    metrics: ["visual_acuity", "axial_length"],
    selfTests: ["home_acuity", "contrast"],
    vocabulary: ["phaco", "IOL", "posterior capsule", "YAG"],
  },
  {
    id: "macular_surface",
    label: "Epiretinal membrane or macular hole",
    blurb: "You are tracking distortion from a membrane or a hole at the macula.",
    symptoms: ["distortion", "blur", "reduced vision"],
    metrics: ["visual_acuity", "oct_cst"],
    selfTests: ["amsler", "home_acuity"],
    vocabulary: ["ERM", "macular pucker", "macular hole", "membrane peel"],
  },
  {
    id: "inherited_retinal",
    label: "Inherited retinal conditions",
    blurb: "Retinitis pigmentosa or another inherited retinal condition.",
    symptoms: ["visual field loss", "reduced vision", "glare", "light sensitivity", "blur"],
    metrics: ["visual_acuity", "vf_md", "vf_vfi"],
    selfTests: ["home_acuity", "contrast", "colour"],
    vocabulary: ["retinitis pigmentosa", "night vision", "ERG", "gene panel"],
  },
  {
    id: "optic_nerve",
    label: "Optic nerve conditions",
    blurb: "Optic neuritis, swelling, or another optic nerve condition.",
    symptoms: ["reduced vision", "pain", "visual field loss", "blur", "other"],
    metrics: ["visual_acuity", "vf_md"],
    selfTests: ["home_acuity", "contrast", "colour"],
    vocabulary: ["optic neuritis", "papilloedema", "RAPD", "colour desaturation"],
  },
];

export function profileById(id: string): ConditionProfile | undefined {
  return CONDITION_PROFILES.find((p) => p.id === id);
}

/** Symptoms to offer first, given the profiles someone has chosen. Never a restriction. */
export function promptedSymptoms(profileIds: string[]): SymptomType[] {
  const out: SymptomType[] = [];
  for (const id of profileIds) {
    for (const symptom of profileById(id)?.symptoms ?? []) {
      if (!out.includes(symptom)) out.push(symptom);
    }
  }
  return out;
}

export function suggestedMetrics(profileIds: string[]): MeasurementKind[] {
  const out: MeasurementKind[] = [];
  for (const id of profileIds) {
    for (const metric of profileById(id)?.metrics ?? []) {
      if (!out.includes(metric)) out.push(metric);
    }
  }
  return out;
}

export function suggestedSelfTests(profileIds: string[]): SelfTestId[] {
  const out: SelfTestId[] = [];
  for (const id of profileIds) {
    for (const test of profileById(id)?.selfTests ?? []) {
      if (!out.includes(test)) out.push(test);
    }
  }
  return out;
}
