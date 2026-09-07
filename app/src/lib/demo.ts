// Synthetic demo data. Clearly flagged with demo:true so it can be removed wholesale,
// and never mixed with a user's real records. Dates are generated relative to today
// so the demo always looks current.

import type { StoreShape } from "./store";
import { newRecord } from "./store";
import type { DailyLog, DrawingMark, EyeBaseline, FloaterObject, SymptomEntry, VisualFieldDrawing } from "./models";
import { addDays, nowISO, todayLocal } from "./util";
import { drawingToDataURL } from "./render";
import { dbDelete, dbGetAll } from "./db";

const IMG_BG = "#0b0f17";

function ago(n: number): string {
  return addDays(todayLocal(), -n);
}
function ahead(n: number): string {
  return addDays(todayLocal(), n);
}
function isoAt(date: string, hh = 9, mm = 0): string {
  return `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

/** Procedural synthetic OCT B-scan (clearly watermarked as demo). */
async function syntheticOCT(seed: number, detached: boolean): Promise<Blob> {
  const w = 640;
  const h = 320;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#05070c";
  ctx.fillRect(0, 0, w, h);

  const bands: [string, number][] = [
    ["#3b2f2a", 0.18],
    ["#6b4a35", 0.08],
    ["#8a5d40", 0.05],
    ["#b57f52", 0.04],
    ["#7a4a33", 0.06],
    ["#2a3140", 0.12],
    ["#e8c48f", 0.025],
    ["#1d232e", 0.2],
  ];
  let y = h * 0.25;
  const rnd = mulberry(seed);
  for (const [color, thickness] of bands) {
    const bandH = h * thickness;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 8) {
      const t = x / w;
      // foveal dip
      const dip = Math.exp(-Math.pow((t - 0.5) / 0.09, 2)) * h * 0.06;
      const wave = Math.sin(t * 18 + seed) * 2 + Math.sin(t * 7 + seed * 2) * 3;
      let yy = y + wave + dip;
      if (detached && t > 0.3 && t < 0.62) yy -= Math.sin(((t - 0.3) / 0.32) * Math.PI) * h * 0.07;
      ctx.lineTo(x, yy);
    }
    for (let x = w; x >= 0; x -= 8) {
      const t = x / w;
      const dip = Math.exp(-Math.pow((t - 0.5) / 0.09, 2)) * h * 0.06;
      const wave = Math.sin(t * 18 + seed) * 2 + Math.sin(t * 7 + seed * 2) * 3;
      let yy = y + bandH + wave + dip;
      if (detached && t > 0.3 && t < 0.62) yy -= Math.sin(((t - 0.3) / 0.32) * Math.PI) * h * 0.07;
      ctx.lineTo(x, yy);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    y += bandH;
  }
  // speckle noise
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = rnd() > 0.5 ? "#ffffff" : "#000000";
    ctx.fillRect(rnd() * w, h * 0.15 + rnd() * h * 0.6, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("DEMO DATA — synthetic image, not a real scan", 14, h - 14);
  return canvasToBlob(c);
}

/** Procedural synthetic fundus photo (clearly watermarked as demo). */
async function syntheticFundus(seed: number): Promise<Blob> {
  const s = 480;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#05070c";
  ctx.fillRect(0, 0, s, s);
  const rnd = mulberry(seed);
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.46;
  const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  g.addColorStop(0, "#b96a3c");
  g.addColorStop(0.7, "#9c5227");
  g.addColorStop(1, "#5c2c12");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // optic disc
  ctx.fillStyle = "#e8c25a";
  ctx.beginPath();
  ctx.ellipse(s * 0.36, s * 0.47, s * 0.055, s * 0.045, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8a5d20";
  ctx.beginPath();
  ctx.ellipse(s * 0.36, s * 0.47, s * 0.018, s * 0.015, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // vessels
  ctx.strokeStyle = "#7a1f1f";
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    let x = s * 0.36;
    let y = s * 0.47;
    ctx.moveTo(x, y);
    const angle = (i / 7) * Math.PI * 2 + 0.3;
    for (let step = 0; step < 12; step++) {
      x += Math.cos(angle + Math.sin(step * 1.3 + i) * 0.4) * s * 0.03;
      y += Math.sin(angle + Math.sin(step * 1.1 + i) * 0.4) * s * 0.03;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rnd() > 0.5 ? "#ffffff" : "#000000";
    ctx.fillRect(cx - r + rnd() * 2 * r, cy - r + rnd() * 2 * r, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("DEMO DATA — synthetic image, not a real photograph", 14, s - 14);
  return canvasToBlob(c);
}

function syntheticLetter(text: string): Blob {
  return new Blob([text], { type: "text/plain" });
}

function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => c.toBlob((b) => resolve(b!), "image/png"));
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const m = (tool: DrawingMark["tool"], patch: Partial<DrawingMark>): DrawingMark => ({
  id: crypto.randomUUID(),
  tool,
  size: 4,
  opacity: 0.7,
  ink: "dark",
  ...patch,
});

/** Demo images are generated as Blobs; the record stores bytes. */
async function demoFile(id: string, name: string, blob: Blob, mime = "image/png") {
  const bytes = await blob.arrayBuffer();
  return {
    id,
    name,
    mime,
    bytes,
    size: bytes.byteLength,
    stored_at: new Date().toISOString(),
  };
}

export async function seedDemo(store: StoreShape): Promise<void> {
  if (store.meta?.demo_seeded) return;
  const demo = { demo: true } as const;
  const created = nowISO();

  // ---- baselines -----------------------------------------------------------
  const baselineRight: EyeBaseline = {
    id: "right",
    text: "2–3 small dark dots. One translucent curved strand that moves with my eye. No flashes. Mild occasional glare at night.",
    established_date: ago(430),
    revisions: [{ date: ago(430), text: "Baseline established." }],
    demo: true,
    updated_at: created,
  };
  const baselineLeft: EyeBaseline = {
    id: "left",
    text: "Occasional tiny dots only. No persistent floaters. No flashes.",
    established_date: ago(430),
    revisions: [
      { date: ago(430), text: "Baseline established." },
      { date: ago(13), text: "PVD noted at review — dots unchanged." },
    ],
    demo: true,
    updated_at: created,
  };
  await store.baselines.put(baselineRight);
  await store.baselines.put(baselineLeft);

  // ---- floater objects ------------------------------------------------------
  const f01: FloaterObject = newRecord({
    source_type: "patient_reported" as const,
    ...demo,
    nickname: "F01 — Long Strand",
    eye: "right" as const,
    first_seen: ago(430),
    last_seen: ago(1),
    shape: "strand",
    opacity: "translucent",
    size: "medium",
    motion: "moves_with_eye",
    persistence: "persistent",
    appearance: "Long translucent curved strand",
    status: "active",
    baseline: true,
    drawing_refs: [] as string[],
  });
  const f02: FloaterObject = newRecord({
    source_type: "patient_reported" as const,
    ...demo,
    nickname: "F02 — Dark Dot",
    eye: "left" as const,
    first_seen: ago(4),
    last_seen: ago(1),
    shape: "dot",
    opacity: "dark",
    size: "small",
    motion: "moves_with_eye",
    persistence: "persistent",
    appearance: "Small dark circular dot, slightly right of centre",
    status: "active",
    baseline: false,
    drawing_refs: [] as string[],
  });
  const f03: FloaterObject = newRecord({
    source_type: "patient_reported" as const,
    ...demo,
    nickname: "Left baseline dots",
    eye: "left" as const,
    first_seen: ago(430),
    last_seen: ago(1),
    shape: "speck",
    opacity: "faint",
    size: "tiny",
    motion: "drifts",
    persistence: "intermittent",
    appearance: "Occasional faint tiny dots",
    status: "active",
    baseline: true,
    drawing_refs: [] as string[],
  });
  await store.floaters.put(f01);
  await store.floaters.put(f02);
  await store.floaters.put(f03);

  // ---- drawings --------------------------------------------------------------
  const drawingGlare: VisualFieldDrawing = {
    ...newRecord({
      ...demo,
      date_time: isoAt(ago(16), 20, 30),
      eye: "left" as const,
      canvas_data: {
        marks: [
          m("flash", { x: 0.3, y: 0.32, w: 0.07, opacity: 0.8, ink: "amber" }),
          m("flash", { x: 0.62, y: 0.6, w: 0.05, opacity: 0.6, ink: "amber" }),
          m("label", { x: 0.3, y: 0.16, text: "glare around lights", ink: "light", opacity: 0.9 }),
        ],
      },
      description: "Mild glare around lights in the evening.",
      linked_symptoms: [],
      source_type: "patient_drawn",
    }),
    thumbnail: "",
    created_at: created,
    updated_at: created,
  };
  drawingGlare.thumbnail = drawingToDataURL(drawingGlare.canvas_data.marks, 320, 300, IMG_BG);

  const drawingFloater: VisualFieldDrawing = {
    ...newRecord({
      ...demo,
      date_time: isoAt(ago(4), 8, 15),
      eye: "left" as const,
      canvas_data: {
        marks: [
          m("dot", { x: 0.58, y: 0.5, size: 5, opacity: 0.9, ink: "dark", r: 1.4 }),
          m("label", { x: 0.58, y: 0.28, text: "new dark dot", ink: "light", opacity: 0.9 }),
        ],
      },
      description: "New small dark dot, slightly right of centre.",
      linked_symptoms: [],
      source_type: "patient_drawn",
    }),
    thumbnail: "",
    created_at: created,
    updated_at: created,
  };
  drawingFloater.thumbnail = drawingToDataURL(drawingFloater.canvas_data.marks, 320, 300, IMG_BG);

  const drawingBaseline: VisualFieldDrawing = {
    ...newRecord({
      ...demo,
      date_time: isoAt(ago(430)),
      eye: "right" as const,
      canvas_data: {
        marks: [
          m("strand", {
            points: [
              { x: 0.3, y: 0.3 },
              { x: 0.42, y: 0.42 },
              { x: 0.55, y: 0.4 },
              { x: 0.66, y: 0.52 },
            ],
            ink: "soft",
            opacity: 0.6,
          }),
          m("dot", { x: 0.44, y: 0.6, size: 3, opacity: 0.6 }),
          m("dot", { x: 0.62, y: 0.34, size: 3, opacity: 0.5 }),
          m("label", { x: 0.5, y: 0.14, text: "usual floaters (baseline)", ink: "light", opacity: 0.9 }),
        ],
      },
      description: "What the right eye normally sees — recorded as reference.",
      linked_symptoms: [],
      source_type: "patient_drawn",
    }),
    thumbnail: "",
    created_at: created,
    updated_at: created,
  };
  drawingBaseline.thumbnail = drawingToDataURL(drawingBaseline.canvas_data.marks, 320, 300, IMG_BG);

  const drawingToday: VisualFieldDrawing = {
    ...newRecord({
      ...demo,
      date_time: isoAt(todayLocal(), 8, 40),
      eye: "left" as const,
      canvas_data: {
        marks: [
          m("dot", { x: 0.58, y: 0.5, size: 5, opacity: 0.9, ink: "dark", r: 1.4 }),
          m("blob", { x: 0.4, y: 0.68, w: 0.09, h: 0.06, ink: "soft", opacity: 0.35 }),
        ],
      },
      description: "Dark dot unchanged; faint smudge lower-left appears on waking.",
      linked_symptoms: [],
      source_type: "patient_drawn",
    }),
    thumbnail: "",
    created_at: created,
    updated_at: created,
  };
  drawingToday.thumbnail = drawingToDataURL(drawingToday.canvas_data.marks, 320, 300, IMG_BG);

  await store.drawings.put(drawingBaseline);
  await store.drawings.put(drawingGlare);
  await store.drawings.put(drawingFloater);
  await store.drawings.put(drawingToday);

  f01.drawing_refs = [drawingBaseline.id];
  f02.drawing_refs = [drawingFloater.id, drawingToday.id];
  await store.floaters.put(f01);
  await store.floaters.put(f02);

  // ---- symptoms --------------------------------------------------------------
  const symptoms: SymptomEntry[] = [
    newRecord({
      ...demo,
      date_time: isoAt(ago(30), 7, 50),
      eye: "both" as const,
      symptom_type: "dryness",
      status: "new",
      baseline_comparison: "new" as const,
      severity: 7,
      description: "Gritty dryness, worse in the afternoon; started after more screen time.",
      source_type: "patient_reported" as const,
    }),
    newRecord({
      ...demo,
      date_time: isoAt(ago(16), 20, 35),
      eye: "left",
      symptom_type: "glare",
      status: "new",
      baseline_comparison: "new" as const,
      severity: 2,
      description: "Mild glare around lights in the evening.",
      source_type: "patient_reported" as const,
    }),
    newRecord({
      ...demo,
      date_time: isoAt(ago(10), 7, 45),
      eye: "both" as const,
      symptom_type: "dryness",
      status: "better",
      baseline_comparison: "fewer" as const,
      severity: 3,
      description: "Improved since starting artificial tears regularly.",
      source_type: "patient_reported" as const,
    }),
    newRecord({
      ...demo,
      date_time: isoAt(ago(4), 8, 12),
      eye: "left",
      symptom_type: "floaters",
      status: "new",
      baseline_comparison: "new" as const,
      description: "One new small dark dot, slightly right of centre. Present since this morning.",
      floater_object_id: f02.id,
      drawing_id: drawingFloater.id,
      source_type: "patient_reported" as const,
    }),
    newRecord({
      ...demo,
      date_time: isoAt(ago(4), 8, 20),
      eye: "left",
      symptom_type: "blur",
      status: "same",
      baseline_comparison: "slightly_more" as const,
      severity: 1,
      description: "Slight blur when the dark dot is centred.",
      source_type: "patient_reported" as const,
    }),
    newRecord({
      ...demo,
      date_time: isoAt(ago(2), 8, 5),
      eye: "right" as const,
      symptom_type: "floaters",
      status: "same",
      baseline_comparison: "same_as_usual" as const,
      description: "Usual strand and dots, unchanged.",
      floater_object_id: f01.id,
      source_type: "patient_reported" as const,
    }),
    newRecord({
      ...demo,
      date_time: isoAt(ago(1), 8, 30),
      eye: "left",
      symptom_type: "glare",
      status: "same",
      baseline_comparison: "same_as_usual" as const,
      severity: 2,
      description: "Evening glare unchanged.",
      source_type: "patient_reported" as const,
    }),
  ];
  for (const s of symptoms) await store.symptoms.put(s);

  // ---- daily logs ------------------------------------------------------------
  const logs: DailyLog[] = [];
  for (let d = 30; d >= 0; d--) {
    const date = ago(d);
    if (d === 30 || d === 16 || d === 10 || d <= 4) {
      logs.push({
        id: `demo-log-${date}`,
        date,
        overall: "recorded",
        source_type: "patient_reported",
        demo: true,
        created_at: created,
        updated_at: created,
      });
    } else if (d % 3 !== 2) {
      logs.push({
        id: `demo-log-${date}`,
        date,
        overall: "no_change",
        source_type: "patient_reported",
        demo: true,
        created_at: created,
        updated_at: created,
      });
    }
  }
  for (const l of logs) await store.dailyLogs.put(l);

  // ---- diagnoses ---------------------------------------------------------------
  const dx = [
    newRecord({
      ...demo,
      name: "Rhegmatogenous retinal detachment — macula on",
      eye: "right" as const,
      first_documented: ago(760),
      status: "historical" as const,
      clinician: "Prof. A. Okafor",
      clinic: "University Eye Hospital",
      notes: "Treated surgically; retina attached at every review since.",
      source_type: "clinician_reported" as const,
      confirmed: true,
    }),
    newRecord({
      ...demo,
      name: "Posterior vitreous detachment",
      eye: "left" as const,
      first_documented: ago(13),
      status: "monitored" as const,
      clinician: "Dr. R. Chen",
      clinic: "City Retina Clinic",
      notes: "Documented at dilated exam. No tears seen.",
      source_type: "clinician_reported" as const,
      confirmed: true,
    }),
    newRecord({
      ...demo,
      name: "Lattice degeneration",
      eye: "left" as const,
      first_documented: ago(1100),
      status: "monitored" as const,
      clinician: "Prof. A. Okafor",
      clinic: "University Eye Hospital",
      notes: "Stable appearance across reviews.",
      source_type: "clinician_reported" as const,
      confirmed: true,
    }),
    newRecord({
      ...demo,
      name: "Dry eye syndrome",
      eye: "both" as const,
      first_documented: ago(28),
      status: "active" as const,
      clinician: "Dr. R. Chen",
      clinic: "City Retina Clinic",
      notes: "Managed with lubricants.",
      source_type: "clinician_reported" as const,
      confirmed: true,
    }),
  ];
  for (const d of dx) await store.diagnoses.put(d);

  // ---- procedures -------------------------------------------------------------
  const procs = [
    newRecord({
      ...demo,
      procedure_type: "Vitrectomy + scleral buckle",
      date: ago(760),
      eye: "right" as const,
      surgeon: "Prof. A. Okafor",
      facility: "University Eye Hospital",
      indication: "Rhegmatogenous retinal detachment (macula on), superior tear.",
      operative_note:
        "25g vitrectomy, scleral buckle, cryotherapy to tear, 20% SF6 gas tamponade.",
      outcome: "Retina attached at 1-week review. Visual acuity 20/25 at 3 months.",
      linked_document_ids: [] as string[],
    }),
    newRecord({
      ...demo,
      procedure_type: "Laser photocoagulation (barrier)",
      date: ago(745),
      eye: "left" as const,
      surgeon: "Prof. A. Okafor",
      facility: "University Eye Hospital",
      indication: "Prophylactic barrier to lattice degeneration.",
      outcome: "Well-demarcated laser scars at review.",
      linked_document_ids: [] as string[],
    }),
  ];
  for (const p of procs) await store.procedures.put(p);

  // ---- medications --------------------------------------------------------------
  const meds = [
    newRecord({
      ...demo,
      name: "Ofloxacin eye drops",
      kind: "prescription" as const,
      eye: "right" as const,
      dose: "1 drop",
      frequency: "4× daily",
      start_date: ago(760),
      end_date: ago(745),
      prescribed_by: "Prof. A. Okafor",
      reason: "Post-operative prophylaxis",
    }),
    newRecord({
      ...demo,
      name: "Prednisolone acetate 1%",
      kind: "prescription" as const,
      eye: "right" as const,
      dose: "1 drop",
      frequency: "tapering over 4 weeks",
      start_date: ago(760),
      end_date: ago(732),
      prescribed_by: "Prof. A. Okafor",
      reason: "Post-operative inflammation control",
    }),
    newRecord({
      ...demo,
      name: "Preservative-free artificial tears",
      kind: "self_care" as const,
      eye: "both" as const,
      dose: "1 drop",
      frequency: "4× daily",
      start_date: ago(28),
      reason: "Dryness",
      notes: "Self-started; discussed at review.",
    }),
  ];
  for (const x of meds) await store.medications.put(x);

  // ---- measurements --------------------------------------------------------------
  const meas = [
    newRecord({ ...demo, date: ago(760), eye: "right" as const, kind: "visual_acuity" as const, value: "20/200", note: "Pre-operative", source_type: "clinician_reported" as const }),
    newRecord({ ...demo, date: ago(730), eye: "right" as const, kind: "visual_acuity" as const, value: "20/50", source_type: "clinician_reported" as const }),
    newRecord({ ...demo, date: ago(365), eye: "right" as const, kind: "visual_acuity" as const, value: "20/30", source_type: "clinician_reported" as const }),
    newRecord({ ...demo, date: ago(13), eye: "right" as const, kind: "visual_acuity" as const, value: "20/25", source_type: "clinician_reported" as const }),
    newRecord({ ...demo, date: ago(13), eye: "left" as const, kind: "visual_acuity" as const, value: "20/20", source_type: "clinician_reported" as const }),
    newRecord({ ...demo, date: ago(760), eye: "right" as const, kind: "iop" as const, value: "11", unit: " mmHg", source_type: "device_measurement" as const }),
    newRecord({ ...demo, date: ago(760), eye: "left" as const, kind: "iop" as const, value: "12", unit: " mmHg", source_type: "device_measurement" as const }),
    newRecord({ ...demo, date: ago(180), eye: "right" as const, kind: "iop" as const, value: "13", unit: " mmHg", source_type: "device_measurement" as const }),
    newRecord({ ...demo, date: ago(180), eye: "left" as const, kind: "iop" as const, value: "12", unit: " mmHg", source_type: "device_measurement" as const }),
    newRecord({ ...demo, date: ago(13), eye: "right" as const, kind: "iop" as const, value: "14", unit: " mmHg", source_type: "device_measurement" as const }),
    newRecord({ ...demo, date: ago(13), eye: "left" as const, kind: "iop" as const, value: "13", unit: " mmHg", source_type: "device_measurement" as const }),
  ];
  for (const x of meas) await store.measurements.put(x);

  // ---- prescriptions --------------------------------------------------------------
  const rx = [
    newRecord({
      ...demo,
      date: ago(730),
      right_eye: { sphere: -0.5, cylinder: -1.0, axis: 90, acuity: "20/25" },
      left_eye: { sphere: -3.25, cylinder: -0.5, axis: 175, acuity: "20/20" },
      provider: "University Eye Hospital optometry",
      notes: "Post-surgical refraction.",
    }),
    newRecord({
      ...demo,
      date: ago(60),
      right_eye: { sphere: -0.25, cylinder: -0.75, axis: 95, acuity: "20/25" },
      left_eye: { sphere: -3.5, cylinder: -0.5, axis: 175, acuity: "20/20" },
      provider: "High Street Opticians",
    }),
  ];
  for (const r of rx) await store.prescriptions.put(r);

  // ---- imaging + files -------------------------------------------------------------
  const octBlobOld = await syntheticOCT(11, true);
  const octBlobNew = await syntheticOCT(23, false);
  const fundusBlob = await syntheticFundus(7);

  await store.putFile(await demoFile("demo-file-oct-old", "demo-oct-right-24mo.png", octBlobOld));
  await store.putFile(await demoFile("demo-file-oct-new", "demo-oct-left-16d.png", octBlobNew));
  await store.putFile(await demoFile("demo-file-fundus", "demo-fundus-left-16d.png", fundusBlob));

  const octOld = newRecord({
    ...demo,
    modality: "OCT" as const,
    date: ago(730),
    eye: "right" as const,
    file_ids: ["demo-file-oct-old"],
    clinic: "University Eye Hospital",
    device: "Spectralis OCT",
    findings: "Macula attached, slight foveal contour irregularity post-op.",
    clinician_interpretation: "Stable post-operative appearance.",
    source_type: "device_measurement" as const,
    confirmed: true,
  });
  const octNew = newRecord({
    ...demo,
    modality: "OCT" as const,
    date: ago(16),
    eye: "left" as const,
    file_ids: ["demo-file-oct-new"],
    clinic: "City Retina Clinic",
    device: "Spectralis OCT",
    findings: "Macula attached. Posterior hyaloid face partially detached.",
    clinician_interpretation: "Consistent with early PVD. No tear seen.",
    source_type: "device_measurement" as const,
    confirmed: true,
  });
  const fundus = newRecord({
    ...demo,
    modality: "fundus" as const,
    date: ago(16),
    eye: "left" as const,
    file_ids: ["demo-file-fundus"],
    clinic: "City Retina Clinic",
    device: "Optos ultra-widefield",
    findings: "Lattice periphery without tears. Laser scars stable.",
    source_type: "device_measurement" as const,
    confirmed: true,
  });
  await store.imaging.put(octOld);
  await store.imaging.put(octNew);
  await store.imaging.put(fundus);

  // ---- documents + files -------------------------------------------------------------
  const letterText = `CITY RETINA CLINIC — CLINIC LETTER (DEMO DATA)
Date: ${ago(13)}
Patient: Demo patient
Seen by: Dr R. Chen, Consultant Ophthalmologist

Subjective: Reports mild left-eye evening glare since 22 Aug. New left-eye floater not yet noticed at that time. Dryness improving with lubricants.

Examination: VA R 20/25, L 20/20. IOP R 14, L 13. Dilated exam: retina attached OU. Early PVD OS without tear. Lattice stable with old barrier laser.

Plan: Routine retina follow-up in 3 months. Continue lubricants. Advice given on flashing lights / curtain symptoms.

(This is a synthetic demo document.)`;
  const surgeryText = `UNIVERSITY EYE HOSPITAL — OPERATIVE NOTE (DEMO DATA)
Date: ${ago(760)}
Procedure: 25g pars plana vitrectomy + scleral buckle, right eye
Surgeon: Prof. A. Okafor
Indication: Rhegmatogenous retinal detachment, macula on.
Findings: Superior horseshoe tear; subretinal fluid posterior to tear.
Technique: Vitrectomy, PFCL exchange, cryotherapy, 276 band, SF6 20% tamponade.
Outcome: Uncomplicated. Posture advised for 3 nights.

(This is a synthetic demo document.)`;
  await store.putFile(
    await demoFile("demo-file-letter", "demo-clinic-letter.txt", syntheticLetter(letterText), "text/plain"),
  );
  await store.putFile(
    await demoFile("demo-file-surgery", "demo-operative-note.txt", syntheticLetter(surgeryText), "text/plain"),
  );

  const letter = newRecord({
    ...demo,
    title: "Clinic letter — retina review",
    doc_type: "clinic letter" as const,
    date: ago(13),
    eye: "both" as const,
    file_id: "demo-file-letter",
    clinic: "City Retina Clinic",
    clinician: "Dr. R. Chen",
    summary: "Retina attached OU; early PVD OS; continue lubricants; review in 3 months.",
    source_type: "document_extracted" as const,
    confirmed: true,
  });
  const surgeryDoc = newRecord({
    ...demo,
    title: "Operative note — vitrectomy + buckle",
    doc_type: "surgical report" as const,
    date: ago(760),
    eye: "right" as const,
    file_id: "demo-file-surgery",
    clinic: "University Eye Hospital",
    clinician: "Prof. A. Okafor",
    summary: "Vitrectomy, scleral buckle, cryotherapy, SF6 gas. Uncomplicated.",
    source_type: "document_extracted" as const,
    confirmed: true,
  });
  await store.documents.put(letter);
  await store.documents.put(surgeryDoc);

  // ---- appointments --------------------------------------------------------------
  const aptSurgery = newRecord({
    ...demo,
    date_time: isoAt(ago(760), 7, 30),
    clinic: "University Eye Hospital",
    clinician: "Prof. A. Okafor",
    specialty: "Vitreoretinal surgery",
    reason: "Retinal detachment repair (surgery day)",
    notes: "Emergency repair. See operative note.",
    actions: ["Vitrectomy + buckle", "Cryotherapy", "SF6 gas"],
    follow_up_date: ago(745),
  });
  const aptReview = newRecord({
    ...demo,
    date_time: isoAt(ago(13), 10, 20),
    clinic: "City Retina Clinic",
    clinician: "Dr. R. Chen",
    specialty: "Medical retina",
    reason: "Retina follow-up",
    notes:
      "Retina attached OU. Early PVD OS, no tear. Lattice stable. Dryness improving. Advised on warning symptoms.",
    actions: ["Dilated fundus exam", "OCT macula OS", "Optos OS"],
    follow_up_date: ahead(1),
  });
  const aptNext = newRecord({
    ...demo,
    date_time: isoAt(ahead(1), 10, 0),
    clinic: "City Retina Clinic",
    clinician: "Dr. R. Chen",
    specialty: "Medical retina",
    reason: "Retina follow-up",
  });
  await store.appointments.put(aptSurgery);
  await store.appointments.put(aptReview);
  await store.appointments.put(aptNext);

  // ---- questions ------------------------------------------------------------------
  const questions = [
    newRecord({
      ...demo,
      text: "Has my OCT changed since the August scan?",
      status: "pending" as const,
    }),
    newRecord({
      ...demo,
      text: "Is the new left-eye dark dot floater consistent with the PVD seen at my last exam?",
      status: "pending" as const,
    }),
    newRecord({
      ...demo,
      text: "When can I resume running and swimming?",
      status: "answered" as const,
      answer: "Yes — gradual return advised; gas fully absorbed long ago.",
      appointment_id: aptReview.id,
    }),
    newRecord({
      ...demo,
      text: "Should the lattice in my left eye be treated again?",
      status: "follow_up" as const,
      appointment_id: aptReview.id,
    }),
  ];
  for (const q of questions) await store.questions.put(q);

  await store.setMeta({ demo_seeded: true });
}

export async function removeDemoData(store: StoreShape): Promise<void> {
  const stores = [
    store.symptoms,
    store.dailyLogs,
    store.floaters,
    store.drawings,
    store.appointments,
    store.questions,
    store.diagnoses,
    store.procedures,
    store.medications,
    store.prescriptions,
    store.measurements,
    store.imaging,
    store.documents,
    store.baselines,
    store.briefs,
  ] as const;
  for (const s of stores) {
    for (const rec of (s.list as { id: string; demo?: boolean }[]).filter((r) => r.demo)) {
      await s.del(rec.id);
    }
  }
  // demo files use a fixed id prefix
  const files = await dbGetAll<{ id: string }>("files");
  for (const f of files.filter((f) => f.id.startsWith("demo-file-"))) {
    await dbDelete("files", f.id);
  }
  await store.setMeta({ demo_seeded: false });
}
