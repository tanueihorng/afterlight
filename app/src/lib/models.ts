// Afterlight core data models.
// Every eye-related record carries an explicit eye field and a provenance source type.

export type Eye = "right" | "left" | "both" | "not_applicable";

export type SourceType =
  | "patient_reported"
  | "patient_drawn"
  | "clinician_reported"
  | "device_measurement"
  | "document_extracted"
  | "ai_generated";

export const SOURCE_LABELS: Record<SourceType, string> = {
  patient_reported: "Patient reported",
  patient_drawn: "Patient drawing",
  clinician_reported: "Clinician documented",
  device_measurement: "Device measurement",
  document_extracted: "Extracted from document",
  ai_generated: "AI-generated summary",
};

export const EYE_LABELS: Record<Eye, string> = {
  right: "Right Eye (OD)",
  left: "Left Eye (OS)",
  both: "Both Eyes (OU)",
  not_applicable: "Not eye-specific",
};

export const EYE_SHORT: Record<Eye, string> = {
  right: "Right (OD)",
  left: "Left (OS)",
  both: "Both (OU)",
  not_applicable: "—",
};

/** Baseline comparison options — how a symptom relates to the patient's usual. */
export type BaselineComparison =
  | "same_as_usual"
  | "slightly_more"
  | "much_more"
  | "fewer"
  | "different_appearance"
  | "new";

export const BASELINE_LABELS: Record<BaselineComparison, string> = {
  same_as_usual: "Same as usual",
  slightly_more: "Slightly more",
  much_more: "Much more",
  fewer: "Fewer",
  different_appearance: "Different in appearance",
  new: "New symptom",
};

export type SymptomStatus = "new" | "same" | "better" | "worse" | "resolved";

export const SYMPTOM_TYPES = [
  "floaters",
  "flashes",
  "shadow / curtain",
  "blur",
  "glare",
  "halos",
  "distortion",
  "reduced vision",
  "dryness",
  "pain",
  "redness",
  "light sensitivity",
  "double vision",
  "visual field loss",
  "other",
] as const;
export type SymptomType = (typeof SYMPTOM_TYPES)[number];

/** Symptoms that are commonly treated as reasons for urgent assessment when new or sudden. */
export const URGENT_SYMPTOMS: string[] = [
  "floaters",
  "flashes",
  "shadow / curtain",
  "reduced vision",
  "visual field loss",
];

export interface SymptomEntry {
  id: string;
  date_time: string; // ISO
  eye: Eye;
  symptom_type: string;
  status: SymptomStatus;
  baseline_comparison?: BaselineComparison;
  severity?: number; // 0–10
  onset?: string;
  duration?: string;
  frequency?: string;
  trigger?: string;
  description?: string;
  floater_object_id?: string;
  drawing_id?: string;
  appointment_id?: string;
  source_type: SourceType;
  demo?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DailyLog {
  id: string; // `${date}` for the canonical whole-day log
  date: string; // YYYY-MM-DD
  overall: "no_change" | "recorded";
  note?: string;
  source_type: SourceType;
  demo?: boolean;
  created_at: string;
  updated_at: string;
}

export interface FloaterObject {
  id: string;
  nickname?: string;
  eye: Eye;
  first_seen: string;
  last_seen?: string;
  shape: string;
  opacity?: "faint" | "translucent" | "medium" | "dark";
  size?: "tiny" | "small" | "medium" | "large";
  motion?: "moves_with_eye" | "drifts" | "mostly_fixed" | "unknown";
  persistence?: "momentary" | "intermittent" | "persistent";
  appearance?: string;
  status: "active" | "resolved" | "uncertain";
  baseline: boolean;
  drawing_refs: string[];
  source_type: SourceType;
  demo?: boolean;
  created_at: string;
  updated_at: string;
}

export const FLOATER_SHAPES = [
  "dot",
  "speck",
  "ring",
  "strand",
  "thread",
  "cobweb",
  "cloud",
  "blob",
  "cluster",
  "translucent veil",
  "custom",
];

export interface DrawingMark {
  id: string;
  tool:
    | "pen"
    | "dot"
    | "strand"
    | "ring"
    | "blob"
    | "shadow"
    | "flash"
    | "blur"
    | "label";
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  r?: number;
  size: number; // stroke / element size 1–10
  opacity: number; // 0–1
  ink: "dark" | "light" | "amber" | "soft";
  text?: string;
}

export interface VisualFieldDrawing {
  id: string;
  date_time: string; // ISO
  eye: Eye;
  canvas_data: { marks: DrawingMark[] };
  thumbnail?: string; // dataURL
  description?: string;
  linked_symptoms: string[];
  source_type: SourceType;
  demo?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  date_time: string; // ISO
  clinic?: string;
  clinician?: string;
  specialty?: string;
  reason?: string;
  notes?: string;
  actions?: string[];
  follow_up_date?: string;
  linked_document_ids?: string[];
  linked_imaging_ids?: string[];
  demo?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoctorQuestion {
  id: string;
  text: string;
  status: "pending" | "asked" | "answered" | "follow_up";
  answer?: string;
  appointment_id?: string;
  created_at: string;
  updated_at: string;
  demo?: boolean;
}

export interface Diagnosis {
  id: string;
  name: string;
  eye: Eye;
  first_documented: string; // YYYY-MM-DD
  status: "active" | "resolved" | "monitored" | "historical" | "uncertain";
  clinician?: string;
  clinic?: string;
  notes?: string;
  source_type: SourceType;
  confirmed: boolean;
  demo?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Procedure {
  id: string;
  procedure_type: string;
  date: string;
  eye: Eye;
  surgeon?: string;
  facility?: string;
  indication?: string;
  operative_note?: string;
  outcome?: string;
  linked_document_ids: string[];
  demo?: boolean;
  created_at: string;
  updated_at: string;
}

export const PROCEDURE_TYPES = [
  "vitrectomy",
  "scleral buckle",
  "laser photocoagulation",
  "cryotherapy",
  "retinal tear repair",
  "gas tamponade",
  "silicone oil removal",
  "cataract surgery",
  "other",
];

export type TreatmentPattern = "ongoing" | "course" | "taper" | "injection_series";

export const TREATMENT_PATTERN_LABELS: Record<TreatmentPattern, string> = {
  ongoing: "Ongoing",
  course: "A course with an end date",
  taper: "Reducing dose (taper)",
  injection_series: "A series of injections",
};

export interface Medication {
  id: string;
  name: string;
  kind: "prescription" | "self_care";
  /** How this treatment runs, so the brief can describe a cycle rather than a start date. */
  pattern?: TreatmentPattern;
  /** For an injection series: which one this is, and the interval in weeks. */
  cycle_number?: number;
  interval_weeks?: number;
  /** Most recent dose or injection, when that is the thing that matters. */
  last_given?: string;
  eye: Eye;
  dose?: string;
  frequency?: string;
  start_date: string;
  end_date?: string;
  prescribed_by?: string;
  reason?: string;
  notes?: string;
  demo?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Prescription {
  id: string;
  date: string;
  right_eye: { sphere?: number; cylinder?: number; axis?: number; acuity?: string };
  left_eye: { sphere?: number; cylinder?: number; axis?: number; acuity?: string };
  provider?: string;
  notes?: string;
  demo?: boolean;
  created_at: string;
  updated_at: string;
}

export type MeasurementKind =
  | "visual_acuity"
  | "iop"
  | "cct"
  | "vf_md"
  | "vf_psd"
  | "vf_vfi"
  | "oct_cst"
  | "axial_length"
  | "hba1c"
  | "blood_pressure"
  | "other";

export const MEASUREMENT_LABELS: Record<MeasurementKind, string> = {
  visual_acuity: "Visual acuity",
  iop: "Intraocular pressure",
  cct: "Corneal thickness",
  vf_md: "Visual field — mean deviation",
  vf_psd: "Visual field — pattern standard deviation",
  vf_vfi: "Visual field index",
  oct_cst: "OCT central subfield thickness",
  axial_length: "Axial length",
  hba1c: "HbA1c",
  blood_pressure: "Blood pressure",
  other: "Other",
};

/** The unit a value is recorded in. Values are never silently converted between units. */
export const MEASUREMENT_UNITS: Record<MeasurementKind, string[]> = {
  visual_acuity: ["Snellen (6m)", "Snellen (20ft)", "logMAR", "decimal"],
  iop: ["mmHg"],
  cct: ["µm"],
  vf_md: ["dB"],
  vf_psd: ["dB"],
  vf_vfi: ["%"],
  oct_cst: ["µm"],
  axial_length: ["mm"],
  hba1c: ["mmol/mol", "%"],
  blood_pressure: ["mmHg"],
  other: [],
};

/**
 * How a measurement was taken. Two IOP readings by different methods are not the same number, so
 * the method travels with the value rather than being lost.
 */
export type MeasurementMethod =
  | "goldmann"
  | "non_contact"
  | "icare"
  | "tonopen"
  | "chart_clinic"
  | "home_screen_test"
  | "device_report"
  | "unspecified";

export const METHOD_LABELS: Record<MeasurementMethod, string> = {
  goldmann: "Goldmann applanation",
  non_contact: "Non-contact (air puff)",
  icare: "iCare rebound",
  tonopen: "Tono-Pen",
  chart_clinic: "Clinic chart",
  home_screen_test: "Home screen test — not a clinical measurement",
  device_report: "From a device report",
  unspecified: "Method not recorded",
};

export interface Measurement {
  id: string;
  date: string;
  eye: Eye;
  kind: MeasurementKind;
  value: string;
  unit?: string;
  /** How it was taken; absent means it was not recorded. */
  method?: MeasurementMethod;
  /** Correction worn, where it changes what the number means. */
  correction?: "none" | "glasses" | "contacts" | "pinhole";
  note?: string;
  source_type: SourceType;
  demo?: boolean;
  created_at: string;
  updated_at: string;
}

/* ---------------------------------------------------------------- self-tests */

export type SelfTestKind = "amsler" | "home_acuity" | "contrast" | "colour";

export const SELF_TEST_LABELS: Record<SelfTestKind, string> = {
  amsler: "Amsler grid",
  home_acuity: "Home vision check",
  contrast: "Contrast check",
  colour: "Colour check",
};

/**
 * The conditions a self-test was done under. A result without them is not comparable with a
 * result taken any other way, and the app says so rather than plotting them together.
 */
export interface TestConditions {
  /** Screen brightness as the person judged it, since no browser can read the real value. */
  brightness?: "low" | "medium" | "high";
  ambient?: "dark" | "dim" | "normal" | "bright";
  /** Viewing distance in centimetres, measured or estimated by the person. */
  distance_cm?: number;
  correction: "none" | "glasses" | "contacts";
  /** Screen calibration factor from the card-on-screen step, px per mm. */
  px_per_mm?: number;
  time_of_day?: string;
}

export function conditionsComplete(c: TestConditions | undefined): boolean {
  if (!c) return false;
  return (
    !!c.brightness && !!c.ambient && !!c.correction && typeof c.distance_cm === "number"
  );
}

export interface SelfTestResult {
  id: string;
  kind: SelfTestKind;
  date_time: string;
  eye: "right" | "left";
  /**
   * What the test produced, in its own terms. Deliberately not a score out of anything: these are
   * comparisons with the person's own previous attempts, never a measurement of vision.
   */
  result: {
    /** home_acuity: the smallest line read, in the test's own step units. */
    smallest_step?: number;
    /** home_acuity: the equivalent notation, always carrying the home-test qualifier. */
    notation?: string;
    /** contrast: the faintest step seen. */
    contrast_step?: number;
    /** colour: how many plates were read as expected, out of how many. */
    colour_seen?: number;
    colour_total?: number;
    /** amsler: whether anything was marked at all. */
    marks?: number;
  };
  /** Amsler drawings reuse the drawing engine rather than a second one. */
  drawing_id?: string;
  conditions: TestConditions;
  note?: string;
  source_type: SourceType;
  demo?: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoredFile {
  id: string;
  name: string;
  mime: string;
  /**
   * File payload as raw bytes. Stored as an ArrayBuffer rather than a Blob: Blob support in
   * IndexedDB is uneven across engines and cannot be round-tripped in tests at all, and these
   * bytes are the patient's scans and letters — the least replaceable thing in the record.
   */
  bytes: ArrayBuffer;
  size: number;
  stored_at: string;
}

export type ImagingModality = "OCT" | "fundus" | "visual_field" | "corneal" | "other";

export interface ImagingRecord {
  id: string;
  modality: ImagingModality;
  date: string;
  eye: Eye;
  file_ids: string[];
  clinic?: string;
  device?: string;
  findings?: string;
  clinician_interpretation?: string;
  patient_notes?: string;
  source_type: SourceType;
  confirmed: boolean;
  /** Data-URL thumbnail written by older versions; new records use `thumb_file_id`. */
  thumb?: string;
  /** Id of a stored file holding a compressed thumbnail. */
  thumb_file_id?: string;
  demo?: boolean;
  created_at: string;
  updated_at: string;
}

export type DocumentType =
  | "clinic letter"
  | "prescription"
  | "scan report"
  | "surgical report"
  | "referral"
  | "discharge note"
  | "medication instructions"
  | "insurance"
  | "other";

export interface DocumentRecord {
  id: string;
  title: string;
  doc_type: DocumentType;
  date: string;
  eye: Eye;
  file_id: string;
  clinic?: string;
  clinician?: string;
  summary?: string;
  source_type: SourceType;
  confirmed: boolean;
  demo?: boolean;
  created_at: string;
  updated_at: string;
}

/** Per-eye baseline ("what my vision is normally like"). */
export interface EyeBaseline {
  id: "right" | "left";
  text: string;
  drawing_ref?: string;
  established_date: string;
  revisions: { date: string; text: string }[];
  demo?: boolean;
  updated_at: string;
}

export interface GeneratedBrief {
  id: string;
  created_at: string;
  appointment_id?: string;
  range_start: string;
  range_end: string;
  payload: BriefPayload;
  demo?: boolean;
}

export interface BriefSection {
  title: string;
  items: string[];
}

export interface BriefPayload {
  generated_at: string;
  range_start: string;
  range_end: string;
  perEye: Record<
    "right" | "left",
    { new: string[]; unchanged: string[]; improved: string[]; worse: string[] }
  >;
  drawings: { id: string; date_time: string; eye: Eye; thumbnail?: string; description?: string }[];
  clinicalEvents: { date: string; kind: string; title: string }[];
  treatment: string[];
  questions: string[];
}

export interface AppMeta {
  id: "meta";
  onboarded: boolean;
  /** Display theme, including the two high-contrast options. */
  theme: "dark" | "light" | "hc-dark" | "hc-light";
  /** Multiplier on the whole type scale: 1, 1.25, 1.5 or 2. */
  type_scale?: number;
  reduced_motion?: boolean;
  /** Condition profiles chosen by the person. These shape prompts only — never a diagnosis. */
  condition_profiles?: string[];
  /** Cosmetic tuning of the 3D model so it resembles the person's own eyes. Not clinical data. */
  eye_appearance?: {
    iris?: {
      melanin?: number;
      warmth?: number;
      fibreDensity?: number;
      collarette?: number;
      crypts?: number;
      limbalRing?: number;
      pupilMm?: number;
    };
    fundusPigmentation?: number;
    scleraVessels?: number;
  };
  glare_comfort?: boolean;
  dim_imagery?: boolean;
  demo_seeded: boolean;
  /** Schema the stored records conform to; absent means version 1. */
  schema_version?: number;
  /** When the record was last exported, so the app can say how much is unbacked-up. */
  last_export_at?: string;
  /** Records changed since that export, counted at write time. */
  changes_since_export?: number;
}

/** Generic timeline view derived from stored entities (single source of truth for chronology). */
export interface TimelineEvent {
  id: string;
  event_type:
    | "daily_log"
    | "symptom"
    | "drawing"
    | "appointment"
    | "diagnosis"
    | "procedure"
    | "medication"
    | "prescription"
    | "imaging"
    | "document"
    | "measurement"
    | "self_test"
    | "note"
    | "floater";
  entity_id: string;
  date_time: string;
  eye: Eye;
  title: string;
  summary?: string;
  source_type: SourceType;
  demo?: boolean;
  icon: string;
}
