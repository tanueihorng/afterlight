# Afterlight — Product Context

> **Tagline:** *A living record of the sight you fought to keep.*

## 1. Product Summary

**Afterlight** is a patient-owned, longitudinal eye-health record and visual diary designed around the lived experience of vision over time.

The product was inspired by recovery from a retinal detachment complication and the fear of potentially losing sight. It exists to bridge a gap in ophthalmic care: clinicians see patients at discrete appointments, but patients live with their vision every day.

Afterlight captures that missing time between appointments.

It lets a patient:

- record day-to-day visual symptoms;
- describe and draw floaters, flashes, shadows, blur, glare, distortion, and other visual phenomena;
- establish what “normal” looks like for each eye;
- track when symptoms become new, more frequent, less frequent, or otherwise different;
- store OCT scans, fundus images, diagnoses, prescriptions, surgery records, medications, and check-up notes;
- visualize retinal anatomy, disease, procedures, and the patient’s own history;
- compare symptoms and objective clinical evidence over time;
- prepare a concise, chronological appointment brief to show an ophthalmologist;
- retain a coherent personal history of what the patient experienced, what clinicians observed, and what treatment occurred.

Afterlight is **not** intended to diagnose retinal disease or replace professional medical care. Its primary role is **recording, visualization, organization, recall, communication, and patient understanding**.

---

# 2. Product Thesis

The core insight is simple:

> **A patient experiences their eyesight continuously, while clinical care captures only occasional snapshots.**

Traditional medical records are usually organized around clinics, encounters, documents, and providers. They are rarely optimized around the question a patient actually has:

> “What happened to my vision over time?”

Afterlight organizes eye health around a continuous personal timeline.

Three types of information coexist but must remain clearly distinguished:

1. **What I experienced**
   - floaters;
   - flashes;
   - shadows;
   - blur;
   - glare;
   - halos;
   - distortion;
   - pain;
   - dryness;
   - redness;
   - visual field changes;
   - patient-drawn visual phenomena;
   - free-text notes.

2. **What clinicians observed**
   - OCT findings;
   - retinal photographs;
   - dilated examination findings;
   - diagnosis;
   - visual acuity;
   - intraocular pressure;
   - prescriptions;
   - retinal status;
   - corneal findings;
   - physician notes.

3. **What was done**
   - retinal surgery;
   - vitrectomy;
   - scleral buckle;
   - laser photocoagulation;
   - cryotherapy;
   - gas or silicone oil tamponade;
   - medication;
   - observation;
   - follow-up;
   - referrals;
   - other interventions.

The timeline links these layers without pretending they are equivalent.

---

# 3. Emotional Product Story

Afterlight is not merely an “eye disease renderer.”

Its emotional origin is the experience of believing that sight might be lost, surviving a serious retinal complication, and then having to live with uncertainty about every visual change afterward.

A new floater can feel significant.
A flash can trigger anxiety.
A small change may be hard to describe weeks later at an appointment.
Years of scans and follow-ups become scattered across devices, clinics, PDFs, screenshots, and memory.

Afterlight gives those experiences continuity.

The name reflects this idea:

> **Afterlight**
>
> The light that remains after darkness.
>
> The vision that remains after a frightening event.
>
> The trace left by each day, symptom, scan, diagnosis, and recovery milestone.

The product should feel calm, respectful, precise, and reassuring without pretending to offer certainty it does not possess.

---

# 4. Product Category

Afterlight can be described as:

- a **personal vision health operating system**;
- a **longitudinal personal ophthalmology record**;
- a **visual diary for the eyes**;
- a **patient-owned ophthalmic timeline**;
- a **flight recorder for vision**.

The “flight recorder” analogy is useful internally:

> Vision is continuously experienced, but doctors only see snapshots. Afterlight records what happens between those snapshots.

---

# 5. Primary User

The initial user is a person with an ongoing ophthalmic history, especially someone who:

- has experienced retinal detachment;
- has undergone retinal surgery;
- has persistent or recurring floaters;
- monitors flashes or visual field changes;
- receives recurring OCT or retinal imaging;
- sees multiple ophthalmologists or clinics over time;
- wants to remember exactly when a symptom started;
- wants to show a doctor how a symptom changed between visits;
- wants a personal copy of their eye history;
- is anxious about missing meaningful changes but does not want to rely on memory alone.

The architecture should nevertheless be general enough to support other ophthalmic conditions later.

---

# 6. Core Product Loop

The product should support this continuous loop:

```text
NOTICE SOMETHING
      ↓
RECORD IT
      ↓
DESCRIBE / DRAW WHAT I SEE
      ↓
TRACK HOW IT CHANGES
      ↓
ADD CLINICAL EVIDENCE
      ↓
CONNECT IT TO APPOINTMENTS / TREATMENT
      ↓
PREPARE FOR THE NEXT DOCTOR VISIT
      ↓
CONTINUE THE RECORD
```

Another useful formulation:

```text
Everyday life
    ↓
Subjective symptoms
    ↓
Timeline
    ↓
Clinical evidence
    ↓
Treatment / monitoring
    ↓
Appointment summary
```

---

# 7. Product Principles

## 7.1 Longitudinal first

The timeline is the core product primitive.

Everything important should be date-aware:

- symptoms;
- drawings;
- scans;
- appointments;
- diagnoses;
- procedures;
- medications;
- prescriptions;
- notes;
- measurements;
- documents.

The UI should always make it easy to answer:

- What happened first?
- What changed?
- What has remained stable?
- What happened between two appointments?
- What happened before and after treatment?
- When was something first recorded?

---

## 7.2 Eye-specific by default

Right and left eye must never be ambiguously mixed.

Use standard ophthalmic terms where helpful:

- **OD** — right eye;
- **OS** — left eye;
- **OU** — both eyes.

Every relevant record should contain an eye field:

```ts
eye: "right" | "left" | "both" | "not_applicable"
```

The interface should usually display both plain language and clinical notation:

```text
Right Eye (OD)
Left Eye (OS)
```

---

## 7.3 Subjective and clinical data must remain distinct

A patient drawing a shadow is not a diagnosis of retinal detachment.

An AI-generated observation is not a physician finding.

A physician note is not a patient-described symptom.

Every record should carry a provenance/source type such as:

```ts
source_type:
  | "patient_reported"
  | "patient_drawn"
  | "clinician_reported"
  | "device_measurement"
  | "document_extracted"
  | "ai_generated"
```

The UI should visually distinguish these categories.

---

## 7.4 Calm, not alarmist

The application deals with serious conditions.

Avoid:

- frightening visual language;
- excessive red;
- automatic diagnosis;
- probability-of-blindness claims;
- catastrophic wording;
- overstating AI findings.

Emergency guidance should be clear but restrained.

---

## 7.5 Fast enough for daily use

A symptom tracker that takes several minutes every day will fail.

A normal day should be recordable in seconds.

Ideal action:

> **No change today**

One tap should create a daily entry using the previous baseline.

More detailed logging should be optional when something changed.

---

## 7.6 Patient-owned

The product should feel like the patient’s own longitudinal record rather than a clinic portal.

Users should be able to:

- export their records;
- view everything locally;
- retain original files;
- understand where information came from;
- correct extracted information;
- delete entries;
- generate portable appointment summaries.

A local-first architecture is preferred where practical.

---

# 8. Primary Navigation

Recommended top-level information architecture:

```text
Today

What I See

Timeline

My Eyes
 ├── Right Eye
 └── Left Eye

Imaging
 ├── OCT
 ├── Fundus
 └── Other Imaging

Conditions

Procedures

Symptoms

Medications

Appointments

Documents

Visualize

Ask My Records
```

For a simpler first release, collapse this into:

```text
Today
Timeline
My Eyes
Imaging
Appointments
Visualize
```

with secondary sections within those pages.

---

# 9. Feature: Today

## Purpose

The daily landing page should make recording vision effortless.

It should answer:

> “How are my eyes today?”

Example:

```text
7 September 2026

RIGHT EYE (OD)                 LEFT EYE (OS)
Feeling normal                 Mild glare
Floaters: usual                Floaters: +1 new
Flashes: none                  Flashes: none
Pain: 0/10                     Pain: 0/10
Vision change: none            Slight blur

[ Draw what I see ]

[ No change today ]
[ Add symptom ]
[ Add note ]
[ Add image / document ]
```

## Requirements

Support:

- date;
- eye;
- overall status;
- symptom changes;
- new visual phenomena;
- free-text note;
- visual field drawing;
- comparison with baseline;
- quick “no change” action;
- optional severity rating.

Do not force users to fill every field every day.

---

# 10. Feature: Daily Symptom Journal

## Symptoms to support

Initial set:

- floaters;
- flashes;
- shadow / curtain;
- blur;
- glare;
- halos;
- distortion;
- reduced vision;
- dryness;
- pain;
- redness;
- light sensitivity;
- double vision;
- visual field loss;
- other.

Each symptom should support:

```ts
{
  id: string,
  date_time: string,
  eye: "right" | "left" | "both",
  symptom_type: string,
  status: "new" | "same" | "better" | "worse" | "resolved",
  severity?: number,
  onset?: string,
  duration?: string,
  frequency?: string,
  trigger?: string,
  description?: string,
  baseline_comparison?: string,
  linked_drawing_id?: string,
  linked_appointment_id?: string
}
```

## Important interaction

For recurring symptoms, ask:

```text
Compared with your usual baseline:

○ Same as usual
○ Slightly more
○ Much more
○ Fewer
○ Different in appearance
○ New symptom
```

This is more meaningful than simply recording presence/absence.

---

# 11. Feature: Floater Tracking

Floaters deserve their own structured workflow.

The patient should be able to record:

- approximate count;
- whether there are new floaters;
- shape;
- size;
- opacity;
- apparent location;
- mobility;
- persistence;
- whether the pattern differs from baseline.

## Floater descriptors

Suggested shapes:

- dot;
- speck;
- ring;
- strand;
- thread;
- cobweb;
- cloud;
- blob;
- cluster;
- translucent veil;
- custom.

Suggested appearance fields:

```ts
{
  shape: string,
  opacity: "faint" | "translucent" | "medium" | "dark",
  size: "tiny" | "small" | "medium" | "large",
  motion: "moves_with_eye" | "drifts" | "mostly_fixed" | "unknown",
  persistence: "momentary" | "intermittent" | "persistent"
}
```

---

# 12. Feature: Persistent Floater Objects

Optional advanced feature.

Allow recurring floaters to become identifiable objects.

Example:

```text
F01 — Long Strand
Eye: Right
First recorded: Aug 2024
Appearance: translucent, curved
Status: persistent

F02 — Dark Dot
Eye: Left
First recorded: 3 Sep 2026
Appearance: small, dark, circular
Status: new
```

This lets the system distinguish:

> “Floaters are still present”

from:

> “A genuinely new floater appeared.”

Data model:

```ts
FloaterObject {
  id: string,
  nickname?: string,
  eye: Eye,
  first_seen: string,
  last_seen?: string,
  shape: string,
  appearance?: string,
  status: "active" | "resolved" | "uncertain",
  baseline: boolean,
  drawing_refs: string[]
}
```

---

# 13. Feature: What I See

This is one of Afterlight’s signature experiences.

## Purpose

Allow the patient to visually represent subjective phenomena that are difficult to describe in words.

The tool should display a neutral representation of the user’s visual field.

The user can add:

- dots;
- translucent circles;
- strings;
- strands;
- cobweb shapes;
- blobs;
- rings;
- flashes;
- arcs;
- shadows;
- curtain-like areas;
- blurry regions;
- glare;
- halos;
- distortion;
- scotoma-like areas;
- custom freehand marks.

## Drawing controls

Suggested tools:

- pen;
- dot;
- floater strand;
- ring;
- translucent blob;
- shadow region;
- flash;
- blur brush;
- distortion region;
- eraser;
- undo / redo;
- opacity;
- size;
- label;
- eye selector.

Each drawing is associated with:

```ts
{
  id: string,
  date_time: string,
  eye: Eye,
  canvas_data: object,
  preview_image?: string,
  description?: string,
  linked_symptoms: string[],
  source_type: "patient_drawn"
}
```

## Critical UI label

Every visual field drawing should clearly say something similar to:

> **Patient-drawn representation of perceived vision — not a clinical retinal image.**

---

# 14. Feature: Visual Field History

Every visual drawing becomes a dated snapshot.

Users should be able to browse them chronologically:

```text
Sep 1 → Sep 2 → Sep 3 → Sep 4 → Sep 5 → Sep 6 → Sep 7
```

Potential interactions:

- scrub through dates;
- play as an animation;
- compare two dates side by side;
- overlay drawings;
- highlight newly added marks;
- jump to the corresponding symptom log.

Example appointment view:

```text
Visual field history

22 Aug         1 Sep          7 Sep
[ drawing ]    [ drawing ]    [ drawing ]
```

---

# 15. Feature: Baseline Vision

The user should define their normal baseline separately for each eye.

Example:

```text
RIGHT EYE BASELINE
• 2–3 small dark dots
• 1 translucent curved strand
• No flashes
• Mild occasional glare

LEFT EYE BASELINE
• Occasional tiny dots
• No persistent floaters
• No flashes
```

Baseline should support:

- text description;
- baseline visual drawing;
- known persistent floaters;
- date established;
- revision history.

Daily symptom input should focus on deviation from this baseline.

---

# 16. Feature: Timeline

This is the central longitudinal view.

## Events displayed together

- daily symptom records;
- visual field drawings;
- new floater events;
- OCT scans;
- fundus images;
- clinic appointments;
- diagnoses;
- procedures;
- medication changes;
- prescriptions;
- visual acuity;
- intraocular pressure;
- uploaded documents;
- user notes.

Example:

```text
AUGUST                              SEPTEMBER

Floaters ━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━
                              new floater

Glare    ━━━━━▲━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         began

Dryness  ━━━━━━━━━━━▲━━━━▼━━━━━━━━━━━━━━━━━━
                   worse improved

               │                   │
             OCT                Retina review
```

## Timeline filters

Allow filtering by:

- right / left / both eyes;
- symptoms;
- imaging;
- appointments;
- diagnoses;
- procedures;
- medication;
- user notes.

Allow date ranges:

- 7 days;
- 30 days;
- 3 months;
- 1 year;
- all time;
- since last appointment;
- custom.

---

# 17. Feature: My Eyes

Create separate longitudinal profiles.

## Right Eye / OD

Display:

- current status;
- current prescription;
- visual acuity;
- last known intraocular pressure;
- diagnoses;
- surgeries;
- current retinal status;
- lens status if known;
- medication;
- baseline symptoms;
- last OCT;
- last retinal examination;
- upcoming follow-up;
- major historical events.

## Left Eye / OS

Same structure.

Avoid presenting missing values as “normal.”

Use:

> Not recorded

rather than:

> Normal

unless normality was actually documented.

---

# 18. Feature: Clinical Record Ingestion

Support upload / drag-and-drop of:

- OCT images;
- fundus photographs;
- retinal photographs;
- visual field tests;
- clinic letters;
- discharge summaries;
- surgical reports;
- prescriptions;
- referral letters;
- PDFs;
- screenshots;
- other images.

## Ingestion workflow

```text
Upload
  ↓
Preserve original
  ↓
Extract candidate metadata
  ↓
Show user review screen
  ↓
User confirms/corrects
  ↓
Create structured record
  ↓
Add to timeline
```

Candidate fields:

- date;
- clinic;
- doctor;
- patient eye;
- document type;
- diagnosis;
- procedure;
- medications;
- measurements;
- follow-up interval;
- interpretation.

Never silently convert extracted text into permanent medical facts.

Require confirmation.

---

# 19. Feature: OCT Vault

Each OCT scan becomes a structured record.

Fields:

```ts
OCTRecord {
  id: string,
  scan_date: string,
  eye: Eye,
  clinic?: string,
  device?: string,
  image_files: string[],
  thickness_measurements?: object,
  clinician_interpretation?: string,
  extracted_text?: string,
  patient_notes?: string,
  source_document_id?: string
}
```

## OCT interface

Display:

- scan date;
- eye;
- original scan;
- extracted measurements where available;
- clinician interpretation;
- linked appointment;
- linked diagnosis;
- linked symptoms recorded near the date.

---

# 20. Feature: OCT Comparison

Allow:

```text
Earlier OCT  ← slider / side-by-side →  Later OCT
```

Modes:

- side-by-side;
- image slider;
- chronological gallery;
- measurement comparison.

Any AI analysis must be clearly marked:

> **AI-generated observation — not a diagnosis and not a substitute for clinician interpretation.**

Prefer clinician interpretations when available.

---

# 21. Feature: Other Imaging

Support:

- fundus photography;
- Optos / ultra-widefield images;
- visual field reports;
- corneal imaging;
- prescription photos;
- miscellaneous ophthalmic imaging.

Each should use a common imaging metadata model:

```ts
ImagingRecord {
  id: string,
  modality: string,
  date: string,
  eye: Eye,
  files: string[],
  clinic?: string,
  findings?: string,
  source_type: SourceType
}
```

---

# 22. Feature: Diagnoses

A diagnosis is a clinical record, not a symptom.

Fields:

- diagnosis;
- eye;
- first documented date;
- status;
- clinician;
- clinic;
- linked evidence;
- linked imaging;
- notes.

Statuses:

- active;
- resolved;
- monitored;
- historical;
- uncertain / pending confirmation.

---

# 23. Feature: Procedure and Surgery History

Support:

- vitrectomy;
- scleral buckle;
- laser photocoagulation;
- cryotherapy;
- retinal tear repair;
- gas tamponade;
- silicone oil;
- cataract-related procedures;
- other ophthalmic procedures.

Fields:

```ts
Procedure {
  id: string,
  procedure_type: string,
  date: string,
  eye: Eye,
  surgeon?: string,
  facility?: string,
  indication?: string,
  operative_note?: string,
  outcome?: string,
  linked_documents: string[]
}
```

---

# 24. Feature: Surgery Visualizer

Educational visualization explaining what happened anatomically.

Examples:

## Vitrectomy

```text
1. Vitreous is removed
2. Retinal tear / detachment is treated
3. Retina is repositioned
4. Laser or cryotherapy may be applied
5. Gas or silicone oil may be used as tamponade
```

## Scleral buckle

Show:

- external buckle placement;
- indentation of the eye wall;
- conceptual relationship to retinal breaks.

## Retinal detachment visualizer

Potential states:

- healthy retina;
- retinal tear;
- localized detachment;
- larger detachment;
- macula-on / macula-off concepts;
- treated state.

The visualizer is educational unless actual image-derived reconstruction is implemented.

---

# 25. Feature: Retina / Eye Renderer

The existing HTML disease renderer should become a major “Understand” or “Visualize” section.

Potential conditions to support:

- retinal tear;
- retinal hole;
- retinal detachment;
- lattice degeneration;
- posterior vitreous detachment;
- vitreous floaters;
- epiretinal membrane;
- macular edema;
- retinal scarring;
- laser scars;
- scleral buckle;
- vitrectomy;
- gas bubble;
- silicone oil.

Useful modes:

- healthy vs affected;
- before vs after treatment;
- right vs left eye;
- anatomy labels on/off;
- procedure overlays;
- condition explanation panel.

Do not imply that generic visualization is a reconstruction of the user’s actual retina.

---

# 26. Feature: Appointments

Appointments should be first-class objects.

Fields:

```ts
Appointment {
  id: string,
  date_time: string,
  clinic?: string,
  clinician?: string,
  specialty?: string,
  reason?: string,
  notes?: string,
  diagnoses?: string[],
  actions?: string[],
  follow_up_date?: string,
  linked_documents?: string[],
  linked_imaging?: string[],
  questions?: string[]
}
```

---

# 27. Feature: Questions for My Doctor

Maintain a persistent list of questions.

Examples:

- Is the retina fully attached?
- Has anything changed on my OCT?
- Is this floater consistent with my prior examination?
- Is this symptom more likely retinal or corneal?
- Is there lattice degeneration in the other eye?
- Are there activity restrictions?
- When should the next dilated retinal exam be?
- What symptoms should prompt an earlier review?

Question states:

- pending;
- asked;
- answered;
- follow-up required.

Allow an answer/note to be attached after the appointment.

---

# 28. Feature: Appointment Mode

This should be a signature workflow.

CTA:

> **Prepare for appointment**

Default range:

> Since previous appointment

Alternative ranges:

- last 7 days;
- last 30 days;
- since specific date;
- custom.

Generated summary example:

```text
RETINA FOLLOW-UP
8 September 2026

RIGHT EYE
No significant new symptoms recorded.

LEFT EYE

NEW
• One new dark-dot floater first recorded Sep 3
• Intermittent glare recorded since Aug 22

UNCHANGED
• Existing strand-shaped floater
• No flashes reported

IMPROVED
• Dryness severity decreased from 7/10 to 3/10

VISUAL FIELD HISTORY
Aug 22      Sep 1       Sep 7
[image]     [image]     [image]

CLINICAL EVENTS
Aug 21 — OCT
Aug 25 — Ophthalmology review

CURRENT TREATMENT
• ...

QUESTIONS FOR DOCTOR
• Is this new floater concerning?
• Has my OCT changed?
```

The user should be able to:

- view it fullscreen;
- present it directly from phone/laptop;
- export as PDF;
- print it;
- save the generated brief into the timeline.

---

# 29. Feature: “What Changed?”

A reusable comparison engine.

The user can choose two points or ranges:

```text
Previous appointment → Today
```

or:

```text
1 Aug → 7 Sep
```

The system summarizes:

- new symptoms;
- resolved symptoms;
- worsening symptoms;
- improving symptoms;
- new medications;
- new diagnoses;
- new procedures;
- imaging added;
- questions still unanswered.

This is an organizational summary, not medical interpretation.

---

# 30. Feature: Measurements

Support structured measurements over time.

Possible fields:

- visual acuity;
- intraocular pressure;
- refractive prescription;
- astigmatism;
- retinal thickness;
- other device measurements.

Do not mix unlike measurement types on the same axis without clear labeling.

Allow trend charts where useful.

---

# 31. Feature: Prescription History

Track glasses/contact prescriptions by date.

Suggested model:

```ts
Prescription {
  id: string,
  date: string,
  right_eye: {
    sphere?: number,
    cylinder?: number,
    axis?: number,
    acuity?: string
  },
  left_eye: {
    sphere?: number,
    cylinder?: number,
    axis?: number,
    acuity?: string
  },
  provider?: string,
  notes?: string
}
```

Allow comparison over time.

---

# 32. Feature: Medication / Treatment Log

Track:

- medication name;
- eye;
- dose;
- frequency;
- start date;
- stop date;
- prescribed by;
- reason;
- patient notes.

Include non-prescription care if useful, such as:

- artificial tears;
- warm compress;
- eyelid cleaning.

But clearly distinguish professional prescription from self-entered routine.

---

# 33. Feature: Documents

Provide a personal eye-health document vault.

Each document should retain:

- original file;
- upload date;
- document date;
- document type;
- eye;
- source;
- extracted metadata;
- linked events.

Document types:

- clinic letter;
- prescription;
- scan;
- surgical report;
- referral;
- discharge note;
- medication instructions;
- insurance document;
- other.

Search should eventually include text inside documents.

---

# 34. Feature: Ask My Records

Future AI layer.

This should operate over the user’s own stored history.

Example questions:

> When did glare in my left eye first appear?

> Show every OCT after my surgery.

> What symptoms did I report between my last two retinal appointments?

> When was the first new floater recorded this year?

> What did my doctors document about the macula?

> Compare my two most recent prescriptions.

> What questions did I want to ask at my previous appointment?

> Summarize what changed since my last review.

## Critical AI principle

Answers should cite the underlying record.

Example:

```text
Your first recorded left-eye glare entry was on 22 Aug 2026.

Source:
Daily symptom log — 22 Aug 2026
```

Never hallucinate missing clinical data.

If the record does not contain an answer:

> “I could not find that in your stored records.”

---

# 35. Feature: Search

Global search across:

- symptoms;
- dates;
- diagnoses;
- doctors;
- clinics;
- documents;
- procedures;
- imaging;
- notes.

Examples:

```text
"floaters"
"vitrectomy"
"Aug 2026"
"left eye"
"glare"
```

---

# 36. Feature: Emergency Symptom Guidance

Afterlight should never diagnose an emergency.

However, the product may recognize that certain user-reported changes are commonly treated as reasons to seek urgent professional assessment.

Examples include:

- sudden increase in floaters;
- sudden flashes;
- curtain / shadow over vision;
- sudden significant vision reduction.

The UI can display a restrained safety message such as:

> **Some sudden visual changes can require urgent eye assessment. Afterlight cannot determine the cause. If this is a new or sudden change, consider contacting an ophthalmologist or emergency eye service promptly.**

The implementation should avoid:

- “You have a retinal detachment”;
- probability estimates;
- false reassurance;
- telling users that a normal-looking log means they are safe.

---

# 37. Provenance and Trust Model

Every important piece of information should expose its origin.

Example labels:

```text
Patient reported
Patient drawing
Clinician documented
Device measurement
Extracted from document
AI-generated summary
```

For AI-extracted data, retain:

- original document;
- extracted value;
- confidence if available;
- confirmation status;
- user correction.

Example:

```ts
{
  value: "retinal detachment",
  provenance: "document_extracted",
  confirmed: true,
  source_document_id: "doc_123"
}
```

---

# 38. Safety and Medical Boundaries

Afterlight should clearly state:

- it is a personal record and visualization tool;
- it does not diagnose disease;
- it does not replace an ophthalmologist;
- symptom logging is not a substitute for urgent assessment;
- AI summaries may be incomplete or incorrect;
- generic visualizations are educational;
- patient drawings are subjective representations;
- missing data must not be interpreted as normal findings.

AI outputs should use language such as:

- “recorded”;
- “reported”;
- “documented”;
- “appears in your uploaded record.”

Avoid:

- “you have” unless quoting a confirmed clinical diagnosis;
- “your retina is healthy” without confirmed clinical evidence;
- “this is harmless”;
- “you do not need medical attention.”

---

# 39. Design Direction

The product should feel:

- calm;
- modern;
- precise;
- personal;
- premium;
- medically literate;
- not sterile;
- not frightening;
- not overly corporate.

Avoid a conventional hospital-dashboard aesthetic.

Think:

- spacious layout;
- refined typography;
- subtle depth;
- restrained use of color;
- excellent timeline visualization;
- dark mode if practical;
- high-quality image viewing;
- beautiful transitions between dates;
- strong focus on photography / OCT / visual data.

The product’s emotional identity should reflect **light after uncertainty**, not illness.

---

# 40. Brand

## Name

# Afterlight

## Tagline

> **A living record of the sight you fought to keep.**

## Alternate short descriptions

> Your vision, over time.

> Record what you see. Remember what changed.

> The story of your sight, in one place.

> A personal timeline for your eyes.

## GitHub one-line description

> A local-first visual health diary that connects everyday vision changes with OCT scans, ophthalmology records, procedures, and follow-up care.

---

# 41. Suggested Home Dashboard

Desktop concept:

```text
┌──────────────────────────────────────────────────────────┐
│ AFTERLIGHT                              7 SEP 2026       │
│ A living record of the sight you fought to keep.        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  How is your vision today?                               │
│                                                          │
│  RIGHT EYE                    LEFT EYE                    │
│  ✓ No major change             Mild glare                │
│  Floaters: baseline            +1 new floater            │
│  Flashes: none                 Flashes: none              │
│                                                          │
│  [ No change today ]       [ Record changes ]            │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ WHAT I SEE                                               │
│                                                          │
│       [Right visual field]     [Left visual field]       │
│                                                          │
│                    [ Draw what I see ]                   │
├──────────────────────────────────────────────────────────┤
│ RECENT TIMELINE                                          │
│                                                          │
│ Sep 7   Daily log     New left-eye floater               │
│ Sep 3   Symptom       Dark dot first recorded            │
│ Aug 25  Appointment   Ophthalmology review               │
│ Aug 21  OCT           Left eye                           │
│                                                          │
│                        View full timeline →              │
└──────────────────────────────────────────────────────────┘
```

---

# 42. Suggested Appointment Dashboard

```text
┌───────────────────────────────────────────────────────┐
│ NEXT APPOINTMENT                                      │
│ 8 Sep 2026 · Retina follow-up                         │
│                                                       │
│ Changes since previous visit                          │
│                                                       │
│ 1 new symptom                                         │
│ 3 symptom updates                                     │
│ 2 new visual drawings                                 │
│ 1 OCT added                                           │
│                                                       │
│ [ Prepare appointment brief ]                         │
│ [ Questions for doctor ]                              │
└───────────────────────────────────────────────────────┘
```

---

# 43. Suggested Data Architecture

A relational model is recommended even if the prototype initially uses local JSON or IndexedDB.

Primary entities:

```text
User
EyeProfile
DailyLog
SymptomEntry
FloaterObject
VisualFieldDrawing
Appointment
Diagnosis
Procedure
Medication
Prescription
ImagingRecord
OCTRecord
Document
Measurement
DoctorQuestion
TimelineEvent
GeneratedBrief
```

## Generic timeline event

Rather than duplicating chronology logic, use a shared timeline index.

```ts
TimelineEvent {
  id: string,
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
    | "note",
  entity_id: string,
  date_time: string,
  eye: Eye | "not_applicable",
  title: string,
  summary?: string,
  source_type: SourceType
}
```

---

# 44. Suggested Technical Architecture

For a polished modern implementation, an agent can consider:

## Front end

- React;
- TypeScript;
- Vite or Next.js;
- componentized UI;
- responsive desktop/tablet/mobile layout.

## Local data

For a local-first prototype:

- IndexedDB;
- SQLite through a local backend;
- or browser-local storage only for simple early prototypes.

Prefer IndexedDB/SQLite over localStorage for images and structured records.

## File storage

Maintain:

- immutable original upload;
- generated thumbnail;
- extracted metadata;
- link to structured record.

## Rendering

Potential tools:

- SVG for visual-field drawing;
- Canvas for freehand drawing;
- Three.js only if true 3D anatomy improves understanding;
- otherwise high-quality 2D/SVG can be clearer and lighter.

## Charts

Use lightweight time-series charts for:

- symptom severity;
- measurement trends;
- frequency of floaters;
- prescription changes.

Do not over-chart qualitative symptoms.

---

# 45. Local-First Principle

Where practical:

- records stay on the device;
- uploaded images remain local;
- user controls export;
- AI should be optional;
- remote calls should never occur silently.

If cloud or external AI is later introduced, the UI must explain what data leaves the device.

Possible future setting:

```text
Privacy mode

● Local only
○ Allow AI processing for selected records
```

---

# 46. Export and Portability

Export options should eventually include:

## Appointment brief

PDF optimized for doctor review.

## Full medical archive

Possible ZIP:

```text
afterlight-export/
  profile.json
  timeline.json
  symptoms/
  drawings/
  imaging/
  documents/
  appointments/
```

## Data export

- JSON;
- CSV for structured measurements/symptoms;
- original images/documents preserved.

The user should never be trapped in the application.

---

# 47. First-Run Onboarding

Recommended onboarding:

```text
Welcome to Afterlight

Your vision changes every day.
Your medical record usually doesn't.

Afterlight helps you keep a continuous record of what you see,
what your doctors observe, and what happens over time.
```

Then:

### Step 1 — Your eye history

Ask minimally:

- Have you had eye surgery?
- Which eye?
- Approximate date?
- Known diagnosis?

Allow skip.

### Step 2 — Establish baseline

Ask:

> What does your vision normally look like?

Allow:

- baseline symptoms;
- baseline floater drawing;
- skip.

### Step 3 — Add existing records

Optional upload:

- OCT;
- clinic letter;
- surgery record;
- prescription.

### Step 4 — Start today

> How is your vision today?

---

# 48. Empty States

Empty states should teach the product.

Examples:

## No drawings

> **Your visual history starts here.**
>
> Draw floaters, flashes, shadows, blur, or anything else you notice. Each drawing becomes a dated snapshot you can compare later.

## No OCT scans

> **Keep your scans together.**
>
> Add OCT images to build a chronological imaging history for each eye.

## No appointments

> **Connect everyday changes to clinical visits.**
>
> Add your next ophthalmology appointment and Afterlight can summarize what changed beforehand.

---

# 49. Notifications — Future Option

Not necessary for V1.

Possible reminders:

- daily check-in;
- upcoming ophthalmology appointment;
- medication;
- periodic baseline review.

Avoid notification fatigue.

Daily logging should remain optional.

---

# 50. Implementation Priority

## Phase 1 — Core personal record

Must-have:

1. Afterlight branding and redesigned shell;
2. right/left eye profiles;
3. Today page;
4. daily symptom logging;
5. baseline comparison;
6. visual-field / floater drawing;
7. timeline;
8. appointments;
9. questions for doctor;
10. manual OCT/document upload;
11. existing retina/disease renderer integrated into Visualize;
12. persistent local data.

This already represents a coherent useful product.

---

## Phase 2 — Clinical organization

Add:

- structured OCT vault;
- fundus imaging;
- diagnoses;
- procedures;
- medications;
- prescription history;
- measurements;
- appointment brief;
- PDF export;
- symptom trend visualization;
- visual-field history comparison.

---

## Phase 3 — Intelligent ingestion

Add:

- PDF text extraction;
- OCR only where necessary;
- automated metadata extraction;
- user confirmation workflow;
- document linking;
- search.

---

## Phase 4 — AI over personal records

Add:

- Ask My Records;
- cited answers;
- automatic “What changed?” summaries;
- appointment brief generation;
- structured record extraction;
- optional AI-assisted document understanding.

Keep AI observational and organizational rather than diagnostic.

---

## Phase 5 — Advanced visualization

Possible:

- anatomy-aware retinal model;
- surgery overlays;
- before/after procedural visualization;
- longitudinal visual-field animation;
- advanced OCT comparison;
- optional image registration or analysis if technically justified.

---

# 51. What NOT to Build First

Do not make V1:

- an AI retinal diagnosis product;
- an automatic emergency triage engine;
- a full hospital EMR;
- a telemedicine platform;
- an ophthalmologist replacement;
- an AI chatbot with no underlying structured record;
- an overcomplicated 3D anatomy demo with little daily utility.

The highest-value foundation is:

```text
RECORD
+
TIMELINE
+
VISUALIZE
+
COMPARE
+
PREPARE FOR APPOINTMENT
```

---

# 52. Definition of a Successful V1

A V1 is successful if the following user story works end-to-end:

> I notice a new floater in my left eye.
>
> I open Afterlight.
>
> I mark the symptom as new.
>
> I describe it as a small dark dot.
>
> I draw where I perceive it.
>
> The event appears on my timeline.
>
> Over the next several days I update whether it changes.
>
> I upload an OCT and clinic record from my ophthalmology visit.
>
> Those clinical events appear on the same timeline.
>
> Before my next appointment I press “Prepare for appointment.”
>
> Afterlight shows when the floater first appeared, how I described it, my drawings over time, associated symptoms, the scans and previous appointment, and the questions I want to ask.
>
> I can show this directly to my ophthalmologist.

If this feels excellent, Afterlight already has a compelling reason to exist.

---

# 53. Agent Implementation Guidance

When implementing Afterlight:

1. **Preserve the existing working disease/retina HTML functionality.**
2. Refactor rather than blindly rewrite working visualization logic.
3. Build a coherent application around it.
4. Treat the timeline as a foundational data primitive.
5. Ensure every eye-related event is explicitly assigned to right, left, or both eyes.
6. Preserve provenance for every medical record.
7. Never convert AI inference into confirmed diagnosis.
8. Optimize daily logging for minimal friction.
9. Make the visual-field drawing tool a flagship experience.
10. Make appointment preparation a flagship workflow.
11. Ensure uploaded originals are never overwritten.
12. Design for local-first storage.
13. Make export possible.
14. Build reusable data models rather than page-specific ad hoc objects.
15. Ensure the interface works without AI.
16. Keep the product calm, human, and visually refined.
17. Treat accessibility seriously because the target users may have impaired vision.
18. Use large click targets, excellent contrast, keyboard accessibility, and scalable text.
19. Never use “missing” medical information to imply a normal result.
20. Create realistic demo data separately from personal/private records.

---

# 54. Accessibility Requirements

Because Afterlight is itself an eye-health product, accessibility is not optional.

Requirements:

- high text contrast;
- clear typography;
- scalable font sizes;
- no essential information encoded only by color;
- keyboard navigation;
- screen-reader labels;
- large interactive targets;
- avoid tiny chart labels;
- support reduced motion;
- clear focus states;
- responsive zoom;
- dark/light appearance;
- avoid low-contrast gray text;
- accessible canvas controls where possible.

Visualizations should also have textual summaries.

---

# 55. Privacy Requirements

Eye records are sensitive.

For implementation:

- do not include private medical files in Git;
- add personal data directories to `.gitignore`;
- provide synthetic/demo fixtures;
- separate application code from user data;
- avoid logging medical content to the browser console unnecessarily;
- explain storage location;
- provide delete/export controls;
- do not send records to third-party services without explicit action.

For the public GitHub repository, use anonymized or generated demo data only.

---

# 56. GitHub Repository Positioning

Suggested README opening:

> # Afterlight
>
> **A living record of the sight you fought to keep.**
>
> Afterlight is a local-first personal ophthalmology record and visual diary that connects what a patient sees every day with what clinicians observe during appointments.
>
> Track changes in floaters, flashes, glare, blur and other visual symptoms, draw subjective visual-field changes, organize OCT scans and ophthalmology records, understand retinal conditions through interactive visualization, and turn years of fragmented eye history into one continuous timeline.
>
> Afterlight was inspired by the experience of recovering from retinal detachment and realizing how difficult it is to reconstruct what changed between clinical visits.

Then emphasize:

- patient-owned;
- longitudinal;
- local-first;
- visual;
- appointment-oriented;
- non-diagnostic.

---

# 57. Core Product Language

Preferred terminology:

Use:

- “What I see”
- “Your baseline”
- “Compared with usual”
- “First recorded”
- “Patient reported”
- “Clinician documented”
- “What changed”
- “Since your last appointment”
- “Prepare for appointment”
- “Visual history”
- “My Eyes”
- “Timeline”

Avoid unnecessarily clinical wording on everyday screens.

Clinical terminology is appropriate inside detailed records.

---

# 58. Product North Star

Afterlight should ultimately answer one question exceptionally well:

> **What happened to my vision over time?**

Everything else should support that.

The patient should be able to move fluidly between:

```text
What I remember
      ↓
What I recorded
      ↓
What I saw
      ↓
What my scans showed
      ↓
What my doctor said
      ↓
What treatment happened
      ↓
What changed afterward
```

That continuous story is the product.

---

# 59. Final Product Vision

Afterlight begins as a deeply personal retina-recovery project, but the broader concept is larger:

**a personal longitudinal layer for ophthalmic care.**

A clinic owns the encounter.
A scanner owns the image.
A doctor writes the note.
A pharmacy owns the prescription record.

But the patient is the only person who experiences every day between them.

Afterlight belongs to that missing space.

It should become the place where someone can say:

> “This is what I have been seeing.”

> “This is when it changed.”

> “This is what my scan showed afterward.”

> “This is what the doctor told me.”

> “This is what happened after surgery.”

> “And this is the story I can bring with me to the next appointment.”

That is the product Afterlight should become.
