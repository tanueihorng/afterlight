# Changelog

What changed, written for the person using it rather than for whoever wrote it.

This file is generated from `app/src/lib/changelog.ts`, which is the same list the app shows in
Settings. Edit that file, then run `npm run changelog`.

Versions follow [semantic versioning](https://semver.org). The number stays below 1.0.0 until
the clinical wording has been reviewed by a qualified clinician — see `docs/clinical-review.md`.

## 0.10.0 — unreleased

**Getting ready for other people to use it.**

- A guide covering the daily habit, drawing what you see, preparing for an appointment, and — the part most people need — how to keep a backup and move to a new device.
- A plain page explaining what Afterlight is and is not, including the boundaries it will not cross.
- Version and this list of changes now appear in Settings.
- Ways to report a problem, including a route for anything that reads as clinically wrong, which goes to a person rather than being closed automatically.
- Groundwork for other languages. Only English is available so far.

> The clinical wording in the condition atlas, the home checks and the safety messages has not yet been reviewed by an ophthalmologist or optometrist. Until it has, treat every explanation in the app as background reading, not as advice about your eyes.

## 0.9.0 — 2026-09-09

**The appointment brief, ready to hand to a doctor.**

- Save the brief as a real PDF, laid out to be read in about a minute, with your drawings printed at proper resolution.
- Printing now produces a clean black-and-white page rather than a copy of the screen.
- Inside each eye, what you reported and what you copied from a clinic letter are kept clearly apart.
- Share part of your record as one encrypted file covering only the dates you choose. It shows exactly what is in it, and what is not, before it is made.
- A code someone can scan off your screen with no signal, carrying a short summary. It is plain text and says so.
- Present mode shows the brief one section at a time in large, high-contrast type, and keeps the screen awake.
- Add several scans or letters at once. Afterlight reads what it can from filenames, PDFs and DICOM files as suggestions you check — and when a date could be read two ways, it says so instead of guessing.

> Anything read out of a file stays marked as unchecked, and is left out of your appointment brief until you confirm it.

## 0.8.0 — 2026-09-08

**Your record, able to answer questions.**

- Ask questions of your own history in more ways — how many times something happened, when you last recorded it, what a measurement has done over a period.
- Search understands clinical words and their everyday equivalents in both directions, tolerates a typo, and can be narrowed by eye, type or date.
- Recorded numbers can be shown as a chart and as a table, with clinic readings and home checks kept visibly separate.
- 'Is this the same as last time?' puts every earlier instance of a symptom side by side, and records your answer in your own words.

> Trends describe what was recorded — the dates, the values, the difference between the first and the last. They never say better or worse.

## 0.7.0 — 2026-09-08

**A reference atlas, and a way to show what you see.**

- Fifty conditions across the whole eye, each adjustable by severity rather than shown as a fixed picture.
- A view of how an experience is often described from the inside — a shadow, distortion, glare, floaters — which you can compare against your own.
- Compare two conditions side by side, with the view locked together.

> The atlas is a reference you navigate. It never suggests a condition from what you have recorded.

## 0.6.0 — 2026-09-08

**A real eye to look at.**

- A three-dimensional eye built from actual anatomical measurements, with an iris and a retina you can adjust to resemble your own.
- A single-file version of the explorer that works with no internet connection at all.

> The model is generic. It is never a picture of your own eye, and says so everywhere.

## 0.5.0 — 2026-09-08

**Beyond the retina, and checks you can do at home.**

- Thirteen condition profiles that reorder what you are asked about. They shape the questions only, and are never a diagnosis.
- An Amsler grid, a distance vision check and a contrast check, each recording the conditions you did it under.
- Measurements now carry their units and how they were taken, so two readings are never silently compared.
- Injections and tapering courses are described as cycles rather than a start date.

> A home check cannot be saved without recording the distance, lighting and correction you used — without those it is not comparable with anything, including your own previous attempt.

## 0.4.0 — 2026-09-08

**Thirty seconds a day, on a phone.**

- Today is one decision before it is a form: nothing different, or something changed.
- Entries can be dated to yesterday or an earlier day, so writing up last night this morning does not move when it started.
- A proper phone layout, with the main destinations in reach of a thumb.
- Works offline once you have opened it, including recording an entry.

> No streaks, no reminders that make you feel guilty. A gap in the record is fine and the app will say so.

## 0.3.0 — 2026-09-08

**Built for eyes that are having a hard day.**

- Four themes including two high-contrast ones, and four text sizes up to double.
- Every drawing is described in words as well as shown.
- Full keyboard use, larger targets, and motion you can turn off.

## 0.2.0 — 2026-09-08

**Your record, portable and safe to move.**

- Export everything to one file, check that file is readable without importing it, and bring it back on another device.
- Optional passphrase encryption on an export.
- A quiet reminder when it has been a while since your last backup.

> Clearing your browser data deletes your record. The export is the only thing standing between you and losing years of entries.

## 0.1.0 — 2026-09-08

**The first version.**

- A daily record of what you see, drawings of your own field of view, a timeline, your scans and letters, and a brief to take to an appointment.

---

Current version: **0.10.0**
