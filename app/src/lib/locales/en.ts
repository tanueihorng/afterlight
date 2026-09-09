// English — the source catalogue.
//
// Every other language is a copy of this file with the right-hand side replaced. See
// `docs/translating.md`.
//
// Two rules for anyone writing in here:
//
//   1. **The tone is the feature.** Plain words, no exclamation marks, no encouragement, no
//      cheerfulness. The person reading this may have been awake since 3am worrying about their
//      sight. Write as if you are sitting next to them.
//
//   2. **Nothing here interprets.** A string may describe what was recorded and what the app did.
//      It may not say what a symptom means, whether it is serious, or whether anything is
//      improving. That line is enforced by `npm run guard`, and it applies to translations too.
//
// Some strings are *not* in this file: the boundary statements and the "I could not find that"
// sentence live beside the code that uses them, where the invariant guard checks them by name.
// See the note at the bottom for where they are and how to get them all in one document.

import { EYE_LABELS, EYE_SHORT, SOURCE_LABELS } from "../models";

export const EN = {
  /* ------------------------------------------------------------- app shell */

  "app.name": "Afterlight",
  "app.tagline": "A living record of the sight you fought to keep.",
  "app.search": "Search my records",
  "app.ask": "Ask my records",
  "app.skip_to_content": "Skip to main content",
  "app.local_only":
    "Records are stored locally in this browser. Nothing is uploaded without your action.",
  "app.more": "More",
  "app.opening": "Opening…",

  "nav.today": "Today",
  "nav.what_i_see": "What I See",
  "nav.timeline": "Timeline",
  "nav.my_eyes": "My Eyes",
  "nav.self_tests": "Checks",
  "nav.imaging": "Imaging & Documents",
  "nav.appointments": "Appointments",
  "nav.visualize": "Visualize",
  "nav.settings": "Settings",

  /* ------------------------------------------------------------ provenance */

  "source.patient_reported": SOURCE_LABELS.patient_reported,
  "source.patient_drawn": SOURCE_LABELS.patient_drawn,
  "source.clinician_reported": SOURCE_LABELS.clinician_reported,
  "source.device_measurement": SOURCE_LABELS.device_measurement,
  "source.document_extracted": SOURCE_LABELS.document_extracted,
  "source.ai_generated": SOURCE_LABELS.ai_generated,
  "source.not_checked": "Not checked yet",

  "eye.right": EYE_LABELS.right,
  "eye.left": EYE_LABELS.left,
  "eye.both": EYE_LABELS.both,
  "eye.not_applicable": EYE_LABELS.not_applicable,
  "eye.short.right": EYE_SHORT.right,
  "eye.short.left": EYE_SHORT.left,
  "eye.short.both": EYE_SHORT.both,
  "eye.short.not_applicable": EYE_SHORT.not_applicable,
  "eye.label": "Eye: {eye}",
  "eye.demo": "Demo data",

  /* --------------------------------------------------------- the daily loop */

  "today.title": "How is your vision today?",
  "today.sub":
    "Record what changed compared with your usual baseline — or tap “No change today” on ordinary days. Nothing here is a diagnosis.",
  "today.nothing_different": "Nothing different today",
  "today.nothing_different_hint": "One tap. A quiet day is still a record.",
  "today.something_changed": "Something changed",
  "today.something_changed_hint": "Which eye, what, how it compares to your usual.",
  "today.recorded": "Today is recorded.",
  "today.recorded_no_change": "Today is recorded as no change.",
  "today.recorded_editable": "You can add to it or change it at any time.",
  "today.view_timeline": "View timeline →",

  "today.when_title": "When did this start?",
  "today.when_today": "Today",
  "today.when_yesterday": "Yesterday",
  "today.when_other": "Another day",
  "today.when_other_label": "The day this started",

  "today.same_as_before": "Same as before?",
  "today.same_as_before_hint":
    "Things you have recorded before. Tapping one starts an entry you can adjust — it saves nothing on its own.",
  "today.checks_title": "Checks you can do yourself",
  "today.checks_hint":
    "Repeatable checks that give you something concrete to compare between appointments. They are not measurements of your vision.",
  "today.open_checks": "Open checks",

  "today.your_baseline": "Your baseline:",
  "today.add_symptom": "Add symptom",
  "today.draw": "Draw what I see",
  "today.remove_symptom": "Remove symptom",
  "today.symptom_type": "Symptom type",
  "today.compared_with_usual": "Compared with your usual",
  "today.floater_appearance": "Floater appearance",
  "today.floater_shape": "Floater shape",
  "today.severity": "Severity (optional)",
  "today.severity_label": "Severity out of ten",
  "today.describe": "Describe it in your words",
  "today.describe_placeholder": "e.g. small dark dot, slightly right of centre…",

  /* ------------------------------------------------------------ safety copy */

  // Reviewed as a unit — see docs/clinical-review.md §1. A translation of these must be reviewed
  // by a clinician who reads that language, not translated and shipped.
  "safety.urgent":
    "Some sudden visual changes can require urgent eye assessment. Afterlight cannot determine the cause. If this is a new or sudden change, consider contacting an ophthalmologist or emergency eye service promptly.",
  "safety.settings_notice":
    "If you notice sudden floaters, flashes, a curtain or shadow over your vision, or a sudden drop in vision, contact an ophthalmologist or emergency eye service promptly.",

  /* ------------------------------------------------------------- boundaries */

  "boundary.not_a_diagnosis":
    "Afterlight is a personal record — it does not diagnose disease and does not replace an ophthalmologist.",
  "boundary.not_a_substitute":
    "Symptom logging is not a substitute for urgent assessment when something is sudden or severe.",
  "boundary.missing_is_missing":
    "Missing information is shown as “Not recorded”, never as a normal result.",
  "boundary.drawings_subjective":
    "Patient drawings are subjective representations; visualisations are educational.",
  "boundary.stays_here":
    "All records, images and documents stay on this device. Nothing is uploaded.",

  /* ------------------------------------------------------------------ misc */

  "common.not_recorded": "Not recorded",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.close": "Close",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.none": "None",
} as const;

export type Catalogue = Record<keyof typeof EN, string>;
export type MessageKey = keyof typeof EN;

/**
 * The boundary statements are not in this file, and not re-exported from it either.
 *
 * They live beside the code that uses them, where the invariant guard checks them by name —
 * moving them would disarm those checks. Re-exporting them here was the obvious alternative, and
 * it was wrong for a duller reason: it would drag `briefpdf`, `share`, `qr`, `ingest` and `pdf`
 * into the initial chunk, so every first visit would download the PDF writer to render a nav bar.
 *
 * A translator gets them in one place from `npm run clinical-pack`, which collects them into
 * `docs/clinical-pack.md` §2 straight from the source:
 *
 *   SELF_TEST_BOUNDARY        lib/selftest.ts
 *   GENERIC_MODEL_BOUNDARY    engine/index.ts
 *   SIMULATION_BOUNDARY       engine/simulate/vision.ts
 *   PATIENT_GENERATED_FOOTER  lib/briefpdf.ts
 *   HOW_TO_READ               lib/briefpdf.ts
 *   QR_BOUNDARY               lib/share.ts
 *   OCR_BOUNDARY              lib/ingest.ts
 *   NOT_FOUND (ask)           lib/ask.ts
 */
