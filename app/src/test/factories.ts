// Record builders for tests. Defaults are valid and boring; a test states only what it cares about.
import type { AllData } from "../lib/db";
import { EMPTY_DATA } from "../lib/db";
import type {
  Appointment,
  Diagnosis,
  DocumentRecord,
  DailyLog,
  DoctorQuestion,
  EyeBaseline,
  FloaterObject,
  ImagingRecord,
  Measurement,
  Medication,
  Prescription,
  Procedure,
  SymptomEntry,
  VisualFieldDrawing,
} from "../lib/models";

let seq = 0;
const id = (prefix: string) => `${prefix}-${++seq}`;
const stamps = () => ({ created_at: "2026-01-01T09:00:00", updated_at: "2026-01-01T09:00:00" });

export function aSymptom(over: Partial<SymptomEntry> = {}): SymptomEntry {
  return {
    id: id("sym"),
    date_time: "2026-06-01T09:00:00",
    eye: "left",
    symptom_type: "floaters",
    status: "same",
    source_type: "patient_reported",
    ...stamps(),
    ...over,
  };
}

export function aDailyLog(over: Partial<DailyLog> = {}): DailyLog {
  return {
    id: "2026-06-01",
    date: "2026-06-01",
    overall: "recorded",
    source_type: "patient_reported",
    ...stamps(),
    ...over,
  };
}

export function aFloater(over: Partial<FloaterObject> = {}): FloaterObject {
  return {
    id: id("flt"),
    eye: "left",
    first_seen: "2026-05-01",
    shape: "dot",
    status: "active",
    baseline: false,
    drawing_refs: [],
    source_type: "patient_reported",
    ...stamps(),
    ...over,
  };
}

export function aDrawing(over: Partial<VisualFieldDrawing> = {}): VisualFieldDrawing {
  return {
    id: id("drw"),
    date_time: "2026-06-01T09:30:00",
    eye: "left",
    canvas_data: { marks: [] },
    linked_symptoms: [],
    source_type: "patient_drawn",
    ...stamps(),
    ...over,
  };
}

export function anAppointment(over: Partial<Appointment> = {}): Appointment {
  return {
    id: id("apt"),
    date_time: "2026-06-15T10:00:00",
    reason: "Retina follow-up",
    linked_document_ids: [],
    linked_imaging_ids: [],
    ...stamps(),
    ...over,
  };
}

export function aQuestion(over: Partial<DoctorQuestion> = {}): DoctorQuestion {
  return { id: id("qst"), text: "Is this new floater concerning?", status: "pending", ...stamps(), ...over };
}

export function aDiagnosis(over: Partial<Diagnosis> = {}): Diagnosis {
  return {
    id: id("dgn"),
    name: "Rhegmatogenous retinal detachment",
    eye: "right",
    first_documented: "2024-08-09",
    status: "historical",
    source_type: "clinician_reported",
    confirmed: true,
    ...stamps(),
    ...over,
  };
}

export function aProcedure(over: Partial<Procedure> = {}): Procedure {
  return {
    id: id("prc"),
    procedure_type: "vitrectomy",
    date: "2024-08-09",
    eye: "right",
    linked_document_ids: [],
    ...stamps(),
    ...over,
  };
}

export function aMedication(over: Partial<Medication> = {}): Medication {
  return {
    id: id("med"),
    name: "Preservative-free artificial tears",
    kind: "self_care",
    eye: "both",
    start_date: "2026-05-01",
    ...stamps(),
    ...over,
  };
}

export function aPrescription(over: Partial<Prescription> = {}): Prescription {
  return {
    id: id("rx"),
    date: "2026-07-10",
    right_eye: { sphere: -0.5, cylinder: -1, acuity: "20/25" },
    left_eye: { sphere: -3.25, cylinder: -0.5, acuity: "20/20" },
    ...stamps(),
    ...over,
  };
}

export function aMeasurement(over: Partial<Measurement> = {}): Measurement {
  return {
    id: id("msr"),
    date: "2026-06-20",
    eye: "right",
    kind: "iop",
    value: "16",
    unit: "mmHg",
    source_type: "device_measurement",
    ...stamps(),
    ...over,
  };
}

export function anImaging(over: Partial<ImagingRecord> = {}): ImagingRecord {
  return {
    id: id("img"),
    modality: "OCT",
    date: "2026-06-20",
    eye: "right",
    file_ids: [],
    source_type: "device_measurement",
    confirmed: true,
    ...stamps(),
    ...over,
  };
}

export function aDocument(over: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: id("doc"),
    title: "Clinic letter",
    doc_type: "clinic letter",
    date: "2026-06-21",
    eye: "not_applicable",
    file_id: "file-1",
    source_type: "document_extracted",
    confirmed: false,
    ...stamps(),
    ...over,
  };
}

export function aBaseline(over: Partial<EyeBaseline> = {}): EyeBaseline {
  return {
    id: "left",
    text: "A few small dots, no flashes.",
    established_date: "2026-01-05",
    revisions: [],
    updated_at: "2026-01-05T09:00:00",
    ...over,
  };
}

/** An AllData with only the slices a test names. */
export function anAllData(over: Partial<AllData> = {}): AllData {
  return { ...EMPTY_DATA, ...over };
}
