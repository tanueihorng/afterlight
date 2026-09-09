# Clinical review

<!-- The release script reads the next line. Do not reword it; change only the value. -->

**Status: NOT REVIEWED**

Reviewer: _none yet_
Date: _none yet_
Scope reviewed: _none yet_

---

## Why this file blocks a release

Afterlight contains a lot of writing about eyes. Most of it was drafted by an agent working to a
plan, checked against a mechanical guard, and never read by anyone qualified to say whether it is
right. That is an acceptable state for a repository. It is not an acceptable state for something a
frightened person reads at 2am.

So the rule is mechanical rather than aspirational:

- `npm run release` refuses to tag a version while the status line above says `NOT REVIEWED`.
- The version number stays below `1.0.0` until it does not.
- The app, the landing page and `CHANGELOG.md` all say plainly that the clinical wording is
  unreviewed, so nobody has to read this file to find out.

**Only a human may change the status line.** An agent may prepare the pack, chase the reviewer,
apply the corrections and update everything else in this document. It may not mark the review done.
(`AGENTS.md` §5.)

## What needs reviewing

Four bodies of writing, in the order they matter.

### 1. Emergency and safety wording — highest priority

The sentences that tell someone to seek urgent care, and the ones that decide when they appear.

| Where | What to check |
| --- | --- |
| `app/src/components/ui.tsx` → `SafetyNotice` | The wording of the notice itself. |
| `app/src/lib/models.ts` → `URGENT_SYMPTOMS` | Whether this is the right list of symptoms to attach it to — and whether anything is missing. |
| `app/src/pages/Today.tsx`, `Settings.tsx` | Whether it appears at the right moments, and not so often it is ignored. |

Questions for the reviewer:

- Is any of this wording likely to send someone to A&E who did not need to go, or — much worse —
  reassure someone who did?
- Is the trigger list right for a general patient audience rather than for a retinal clinic?

### 2. The condition atlas — 50 entries

Listed in full in [`atlas-review.md`](atlas-review.md), with the specific questions per entry.

The line that matters most in each entry is **"what people notice"**, because that is the sentence a
patient will match themselves against. A wrong one teaches someone to report the wrong thing, or to
dismiss the right thing.

### 3. Phase 05 clinical copy

Listed in [`clinical-copy-review.md`](clinical-copy-review.md): the thirteen condition profiles, the
home-check instructions and their boundary statements, the measurement methods, and the acuity
notation.

The specific risk here is the home checks. They are deliberately framed as comparisons with the
person's own previous attempt and never as a measurement of vision — the reviewer should say whether
that framing holds, and whether the recorded conditions (distance, lighting, correction) are the
right ones to demand.

### 4. Everything the brief says to a clinician

New in Phase 09, and unreviewed:

- [`clinician-note.md`](clinician-note.md) — the one-page explanation a patient may hand over.
- `app/src/lib/briefpdf.ts` → `PATIENT_GENERATED_FOOTER`, `HOW_TO_READ`, the section headings and
  the bucket labels (`New`, `More than usual`, `Unchanged`, `Less than usual`).
- `app/src/lib/share.ts` → `QR_BOUNDARY`.
- `app/src/lib/ingest.ts` → `OCR_BOUNDARY`.

The question here is different from the others: not "is this true?" but **"would a busy clinician
misread this?"** A brief that is skimmed and misunderstood is worse than one that is not read.

## Preparing the pack

```bash
cd app && npm run clinical-pack
```

Writes `docs/clinical-pack.md`: every string above, in one file, with its source location and the
question attached to it. That is the document to send.

## Recording the outcome

When a review comes back, a human edits this file:

1. Change the status line to `**Status: REVIEWED**`.
2. Fill in the reviewer's name **or** their role if they prefer to stay anonymous — that is their
   choice, and "a consultant ophthalmologist, retina" is a perfectly good attribution.
3. Record the date and exactly what was in scope. A review of the safety wording is not a review of
   the atlas; say which.
4. Log every correction below, including the ones that were declined and why.
5. Anything the reviewer flagged and that has **not** been fixed stays listed under "Outstanding"
   and does not ship.

### Corrections applied

_None yet._

### Outstanding

_None yet._

### Out of scope

Things a reviewer might reasonably raise that this project will not do, so the conversation does not
have to be repeated:

- **Risk scores, probabilities, prognosis.** Not a gap; a deliberate absence.
- **Interpreting imaging.** The app stores an OCT and shows it. It does not read it.
- **Suggesting a diagnosis from symptoms.** The atlas is a reference someone navigates, never a
  ranking against their record.
- **Regulatory clearance as a medical device.** See [`boundaries.md`](boundaries.md). If the project
  ever adds clinical judgement, that position changes and this file is where the change starts.
