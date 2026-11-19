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
- Every appointment, question, procedure, medication and prescription now records where it came from, so your record says the same thing wherever it is shown, exported or shared. A surgery you add yourself can be marked as your own account rather than a clinic's.
- Procedures can be edited, including whether they came from a clinic or from you. Each one now shows where it came from.
- Glasses and contact lens prescriptions are kept apart and charted separately, because they are prescribed differently and are not one series.
- Prescriptions can be edited, and sphere and cylinder for each eye can be shown as a chart over time.
- The charts of your recorded numbers are easier to find from My Eyes.
- Opening Visualize no longer freezes the page.
- An appointment stays under “Next appointment” for the whole of its day, wherever in the world you are — previously the visit could move to the past before it happened, and take the brief with it.
- When Ask quotes your records back to you, each quote is now labelled with where it actually came from — your own notes are no longer presented as something a clinician wrote, and text read out of a file that nobody has checked is left out.
- A file whose date cannot be read is still dated today, but now says so next to it, so a wrong date is easier to catch before you confirm it.
- The keyboard and screen-reader paths through the search panel, the full-screen brief and first-run set-up now work properly: focus enters and stays inside each of them and returns to where you were.
- A document saved without a title now says so instead of doing nothing.
- Importing a shared extract can no longer replace your whole record; it can only be added alongside it, and Afterlight says what it is before you choose.
- Restoring a backup now brings back your settings too: text size, motion and glare preferences, condition profiles and how your brief is headed.
- Loading demo data no longer replaces your own description of what is normal for each eye, so removing demo data can no longer delete it.
- A period with nothing recorded now prints as nothing recorded, not as unchanged.
- Clinic readings and home checks are no longer compared with each other in the words under a chart.
- On a phone at the largest text size, pages no longer scroll sideways, and chart labels follow your text size.
- The skip-to-content link now stays on the page you are on.
- Windows that open over a page now use the browser's own dialog, so a screen reader stays inside the window until it closes and the phone's back gesture closes it. When a window has no field to fill in, it starts on its title rather than on its first button. Printing while presenting a brief now prints the whole brief.
- Delete buttons that ask twice now wait 10 seconds for the second press instead of under 3, so there is time to find and read the question. A screen reader announces the question, and moving away from the button cancels it.

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
