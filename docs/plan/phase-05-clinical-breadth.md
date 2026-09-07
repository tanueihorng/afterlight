# Phase 05 — Clinical breadth & home self-tests

> **Goal:** serve glaucoma, macular disease, diabetic retinopathy, corneal and post-surgical
> patients as well as it serves retinal detachment.

## Why it matters

The app was built around one story — detachment, vitrectomy, floaters, field loss. That story is
real, but it is one of many. A glaucoma patient needs pressure trends and field-test history. A
wet-AMD patient needs injection cycles and an Amsler grid. A diabetic patient needs HbA1c context
and laser history. The daily loop generalises; the vocabulary and the metrics do not — yet.

Home self-tests matter for a specific reason: they turn "I think it's worse" into a dated,
repeatable, self-consistent measurement the patient took the same way each time. That is not a
diagnosis — it is a comparison, which is exactly what this app is for.

## Preconditions

Phase 01 (migrations), Phase 03 (self-tests must be accessible or they are useless here).

## Scope

```
app/src/lib/models.ts             condition profiles, new record types
app/src/lib/conditions.ts         new — condition definitions and their metrics
app/src/lib/migrations.ts         schema bump
app/src/pages/Today.tsx           condition-aware prompts
app/src/pages/MyEyes.tsx          condition-specific panels
app/src/pages/SelfTests.tsx       new
app/src/components/tests/         new — Amsler, acuity, contrast, colour
app/src/lib/selftest.ts           new — scoring, calibration, comparison
```

## Tasks

1. **Condition profiles.** `conditions.ts` defines a profile per condition family — retinal
   detachment / tear, PVD & floaters, glaucoma & ocular hypertension, dry & wet AMD, diabetic
   retinopathy & macular oedema, retinal vein occlusion, uveitis, keratoconus, dry eye disease,
   cataract & pseudophakia, epiretinal membrane & macular hole, retinitis pigmentosa, optic
   neuropathy. Each profile names: the symptoms worth prompting, the metrics worth tracking, the
   self-tests that are meaningful, the treatments commonly recorded, and the vocabulary the clinic
   uses. The user picks profiles in onboarding or Settings; profiles **shape prompts only** — they
   never label the person, never appear as a diagnosis, and never restrict what can be recorded.

2. **Metric expansion.** Extend `Measurement` handling with typed, unit-aware kinds: IOP (mmHg, with
   method: GAT/NCT/iCare and CCT correction noted but never applied), visual acuity (Snellen /
   logMAR / decimal with conversion), visual field indices (MD, PSD, VFI), OCT central subfield
   thickness (µm), axial length, HbA1c and blood pressure as context. Store the unit and the method
   with every value; render conversions, never silent normalisation.

3. **Treatment cycles.** Model recurring treatments properly — anti-VEGF injection series (agent,
   interval, eye, cycle number), pressure-drop regimens with adherence, steroid tapers, laser
   sessions. The brief must be able to say "3rd aflibercept injection, left eye, 6-week interval,
   most recent 12 Aug".

4. **Amsler grid self-test.** Full-screen, calibrated grid with fixation dot, one eye at a time,
   distance guidance, and a **drawable overlay** so the patient marks distortion or missing areas
   directly on the grid. Store as a first-class record with the same provenance model as drawings.
   Comparison view overlays any two dates. This reuses the existing drawing engine — do not build a
   second one.

5. **Home visual acuity check.** Tumbling-E or Landolt-C at a screen-size-calibrated size, with a
   physical calibration step (credit card on screen) and a fixed viewing distance instruction.
   Record as `source_type: "patient_reported"` with an explicit `method: "home_screen_test"`. The UI
   must state plainly that this is **not** a clinical acuity measurement and is only meaningful
   compared against the patient's own previous home tests.

6. **Contrast sensitivity and colour checks.** A simple contrast-step chart and a colour-confusion
   check, both same-conditions-each-time, both framed strictly as self-comparison over time.

7. **Self-test integrity.** Every self-test stores the conditions that affect the result: screen
   brightness setting, ambient light (asked), distance, glasses worn, eye tested, time of day. A
   result without its conditions is not comparable, and the app must say so rather than plot it
   next to properly-conditioned results.

8. **Condition-aware prompts.** Today's quick chips and symptom vocabulary adapt to the chosen
   profiles: a glaucoma profile prompts for halos, brow ache, drop adherence; an AMD profile prompts
   for straight-line distortion and the Amsler test; a DR profile prompts for new floaters and
   blurred central vision. The generic set always remains available.

## Acceptance criteria

- [ ] Each condition profile drives a distinct, coherent Today prompt set and My Eyes panel, tested.
- [ ] Acuity conversions (Snellen ↔ logMAR ↔ decimal) are exact and unit-tested at boundary values.
- [ ] An Amsler result round-trips through export/import with its drawing intact and overlays
      correctly against a previous date.
- [ ] Self-tests are completable by keyboard and screen reader, and refuse to record a result when
      required conditions are missing.
- [ ] The appointment brief includes treatment-cycle context and self-test trends, clearly badged as
      patient-performed.
- [ ] Migrations upgrade an existing record without loss; a retina-only user sees no new clutter.

## Risks & non-goals

- **The largest risk in the whole plan:** a home self-test that looks clinical. Every screen must
  frame results as self-comparison, never as a measurement of vision. No pass/fail, no "20/40" shown
  without the home-test qualifier, no trend arrow that implies deterioration. If a design cannot be
  made unambiguous, cut it.
- **Not** implementing OCT image analysis, field-test analysis, or any automated interpretation.
- Condition profiles are prompts, not diagnoses. Never render "You have glaucoma."

## Agent brief

> Execute `docs/plan/phase-05-clinical-breadth.md`. Add condition profiles that shape prompts only,
> unit-aware metrics with method metadata and tested acuity conversions, treatment-cycle modelling,
> an Amsler grid self-test that reuses the drawing engine with date-overlay comparison, calibrated
> home acuity/contrast/colour checks with mandatory test-condition capture, and condition-aware
> Today prompts. Every self-test must be framed as self-comparison, never as clinical measurement —
> put the exact wording you use in the PR description for human review.
