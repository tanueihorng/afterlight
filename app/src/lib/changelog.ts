// What changed, written for the person using it.
//
// One source of truth: `CHANGELOG.md` at the repo root is generated from this file, and
// `npm run changelog:check` fails the build if the two have drifted. The app shows this list in
// Settings, so it has to read like a note to a patient rather than a commit log — "the brief now
// says which injection you are on", not "refactor treatment cycle rendering".

export interface Release {
  version: string;
  /** ISO date, or undefined for a version that has not been released yet. */
  date?: string;
  /** One line saying what this release is about. */
  summary: string;
  changes: string[];
  /** Anything a person should know before or after updating. */
  notes?: string[];
}

/**
 * The version the app reports.
 *
 * Deliberately not 1.0.0. A 1.0 on a tool that touches eye care would say the clinical wording has
 * been reviewed by someone qualified, and as of this release it has not — see
 * `docs/clinical-review.md`. The number moves to 1.0.0 when that review is recorded, and not
 * before.
 */
export const VERSION = "0.10.0";

export const CHANGELOG: Release[] = [
  {
    version: "0.10.0",
    summary: "Getting ready for other people to use it.",
    changes: [
      "A guide covering the daily habit, drawing what you see, preparing for an appointment, and — the part most people need — how to keep a backup and move to a new device.",
      "A plain page explaining what Afterlight is and is not, including the boundaries it will not cross.",
      "Version and this list of changes now appear in Settings.",
      "Ways to report a problem, including a route for anything that reads as clinically wrong, which goes to a person rather than being closed automatically.",
      "Groundwork for other languages. Only English is available so far.",
    ],
    notes: [
      "The clinical wording in the condition atlas, the home checks and the safety messages has not yet been reviewed by an ophthalmologist or optometrist. Until it has, treat every explanation in the app as background reading, not as advice about your eyes.",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-09-09",
    summary: "The appointment brief, ready to hand to a doctor.",
    changes: [
      "Save the brief as a real PDF, laid out to be read in about a minute, with your drawings printed at proper resolution.",
      "Printing now produces a clean black-and-white page rather than a copy of the screen.",
      "Inside each eye, what you reported and what you copied from a clinic letter are kept clearly apart.",
      "Share part of your record as one encrypted file covering only the dates you choose. It shows exactly what is in it, and what is not, before it is made.",
      "A code someone can scan off your screen with no signal, carrying a short summary. It is plain text and says so.",
      "Present mode shows the brief one section at a time in large, high-contrast type, and keeps the screen awake.",
      "Add several scans or letters at once. Afterlight reads what it can from filenames, PDFs and DICOM files as suggestions you check — and when a date could be read two ways, it says so instead of guessing.",
    ],
    notes: [
      "Anything read out of a file stays marked as unchecked, and is left out of your appointment brief until you confirm it.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-09-08",
    summary: "Your record, able to answer questions.",
    changes: [
      "Ask questions of your own history in more ways — how many times something happened, when you last recorded it, what a measurement has done over a period.",
      "Search understands clinical words and their everyday equivalents in both directions, tolerates a typo, and can be narrowed by eye, type or date.",
      "Recorded numbers can be shown as a chart and as a table, with clinic readings and home checks kept visibly separate.",
      "'Is this the same as last time?' puts every earlier instance of a symptom side by side, and records your answer in your own words.",
    ],
    notes: [
      "Trends describe what was recorded — the dates, the values, the difference between the first and the last. They never say better or worse.",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-09-08",
    summary: "A reference atlas, and a way to show what you see.",
    changes: [
      "Fifty conditions across the whole eye, each adjustable by severity rather than shown as a fixed picture.",
      "A view of how an experience is often described from the inside — a shadow, distortion, glare, floaters — which you can compare against your own.",
      "Compare two conditions side by side, with the view locked together.",
    ],
    notes: [
      "The atlas is a reference you navigate. It never suggests a condition from what you have recorded.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-09-08",
    summary: "A real eye to look at.",
    changes: [
      "A three-dimensional eye built from actual anatomical measurements, with an iris and a retina you can adjust to resemble your own.",
      "A single-file version of the explorer that works with no internet connection at all.",
    ],
    notes: ["The model is generic. It is never a picture of your own eye, and says so everywhere."],
  },
  {
    version: "0.5.0",
    date: "2026-09-08",
    summary: "Beyond the retina, and checks you can do at home.",
    changes: [
      "Thirteen condition profiles that reorder what you are asked about. They shape the questions only, and are never a diagnosis.",
      "An Amsler grid, a distance vision check and a contrast check, each recording the conditions you did it under.",
      "Measurements now carry their units and how they were taken, so two readings are never silently compared.",
      "Injections and tapering courses are described as cycles rather than a start date.",
    ],
    notes: [
      "A home check cannot be saved without recording the distance, lighting and correction you used — without those it is not comparable with anything, including your own previous attempt.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-09-08",
    summary: "Thirty seconds a day, on a phone.",
    changes: [
      "Today is one decision before it is a form: nothing different, or something changed.",
      "Entries can be dated to yesterday or an earlier day, so writing up last night this morning does not move when it started.",
      "A proper phone layout, with the main destinations in reach of a thumb.",
      "Works offline once you have opened it, including recording an entry.",
    ],
    notes: [
      "No streaks, no reminders that make you feel guilty. A gap in the record is fine and the app will say so.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-09-08",
    summary: "Built for eyes that are having a hard day.",
    changes: [
      "Four themes including two high-contrast ones, and four text sizes up to double.",
      "Every drawing is described in words as well as shown.",
      "Full keyboard use, larger targets, and motion you can turn off.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-09-08",
    summary: "Your record, portable and safe to move.",
    changes: [
      "Export everything to one file, check that file is readable without importing it, and bring it back on another device.",
      "Optional passphrase encryption on an export.",
      "A quiet reminder when it has been a while since your last backup.",
    ],
    notes: [
      "Clearing your browser data deletes your record. The export is the only thing standing between you and losing years of entries.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-09-08",
    summary: "The first version.",
    changes: [
      "A daily record of what you see, drawings of your own field of view, a timeline, your scans and letters, and a brief to take to an appointment.",
    ],
  },
];

export const CURRENT_RELEASE = CHANGELOG.find((r) => r.version === VERSION);
