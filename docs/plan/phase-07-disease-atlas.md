# Phase 07 — Visualization II: whole-eye disease atlas, procedures & patient-view simulator

> **Goal:** every common eye disease, rendered credibly across the whole eye — plus what each one
> actually looks like from inside the patient's own vision.

## Why it matters

The current explorer covers nine scenarios, weighted to the retina. A patient with keratoconus, or
uveitis, or wet AMD, or glaucoma gets nothing. And the most powerful view of all is missing: not
"here is your retina" but **"here is roughly what someone with this sees"** — the view that lets a
patient say *yes, that, that is what I have been trying to describe*, and lets a family member
finally understand.

## Preconditions

Phase 06 (engine with parameterised anatomy), Phase 05 (condition profiles exist).

## Scope

```
app/src/engine/conditions/         one module per condition — parameter deltas + annotations
app/src/engine/procedures/         staged procedure animations
app/src/engine/simulate/           patient-view (what-you-see) simulation
app/src/lib/atlas.ts               atlas index, metadata, clinical copy
app/src/pages/Visualize.tsx        atlas browser, compare mode, simulator
app/src/components/VisionSim.tsx   new — simulation applied to a photo or scene
docs/atlas-review.md               new — clinical copy for human review, with sources
```

## The atlas

Each entry is a **parameter delta** over the normal eye from Phase 06, plus annotations, plus a
patient-view simulation. Never a bespoke model — that is what makes the atlas maintainable.

**Anterior segment / ocular surface**
dry eye disease (tear-film break-up) · corneal abrasion · corneal ulcer · keratitis ·
keratoconus (cone protrusion, thinning) · corneal oedema · Fuchs' dystrophy · pterygium ·
conjunctivitis · subconjunctival haemorrhage · episcleritis / scleritis · blepharitis

**Anterior chamber / lens / pressure**
anterior uveitis (cells, flare, keratic precipitates, posterior synechiae) · hyphaema ·
cataract (nuclear, cortical, posterior subcapsular) · pseudophakia (IOL, posterior capsule
opacification) · open-angle glaucoma (cupping progression) · angle-closure (shallow chamber,
corneal haze, mid-dilated pupil) · ocular hypertension

**Vitreous & retina**
vitreous floaters (Weiss ring, strands, clumps) · posterior vitreous detachment ·
retinal tear (horseshoe, operculated) · retinal hole · lattice degeneration ·
rhegmatogenous retinal detachment (macula-on and macula-off) · tractional detachment ·
epiretinal membrane · macular hole (staged) · vitreomacular traction ·
central serous chorioretinopathy · dry AMD (drusen, geographic atrophy) ·
wet AMD (CNV, haemorrhage, exudate) · diabetic retinopathy (mild / moderate / severe NPDR,
proliferative with neovascularisation) · diabetic macular oedema ·
branch and central retinal vein occlusion · central retinal artery occlusion ·
retinitis pigmentosa (bone-spicule pigmentation, arteriolar attenuation) · myopic degeneration ·
retinoschisis · commotio retinae

**Optic nerve & neuro**
optic neuritis · papilloedema · non-arteritic AION · optic atrophy · glaucomatous rim loss

Each entry carries: plain-language description, what a patient commonly notices, what a clinician
looks for, which imaging shows it, and — where relevant — which Phase 05 condition profile it maps
to. **All clinical copy goes into `docs/atlas-review.md` for human sign-off before it ships.**

## Tasks

1. **Condition module contract.** Every condition exports
   `{ id, name, region, params(normal): Params, annotations: Annotation[], simulation: SimSpec,
   severity?: (0..1) => Params }`. Severity is continuous where the disease is (cup:disc ratio,
   drusen load, detachment extent, cataract density) so the patient can drag a slider and watch
   progression — the single most explanatory interaction in the whole app.

2. **Fundus-first authoring.** Most posterior conditions are parameter changes to the Phase 06
   fundus generator: vessel calibre and tortuosity, haemorrhage sprites (dot-blot, flame, preretinal),
   exudate deposits, cotton-wool spots, drusen fields, atrophy patches, pigment migration,
   neovascular fronds, detachment bullae with shifting subretinal fluid. Build these as composable
   layers so combinations (e.g. PDR + DMO + prior laser scars) render correctly.

3. **Cross-section authoring.** Anterior and structural conditions modify the cross-section:
   corneal thinning cones, oedema thickness, chamber depth, synechiae, lens opacity distribution,
   ERM traction on the inner retina, macular hole staging, subretinal versus intraretinal fluid.

4. **Compare mode.** Two viewports, locked camera, independent conditions or severities:
   healthy ↔ affected, before ↔ after treatment, right ↔ left, mild ↔ severe. Locked cameras are
   what make comparison honest; add a sync toggle for deliberate divergence.

5. **Procedure animations.** Staged, scrubbable, narrated in plain language, one stage per step of
   the Phase-05 explainers already in `education.ts` (reuse that copy — do not fork it):
   vitrectomy (port placement → gel removal → break identification → fluid-air exchange →
   endolaser → tamponade), scleral buckle (band placement → indentation → cryo), laser retinopexy,
   pneumatic retinopexy, intravitreal injection, cataract surgery (phaco → IOL), YAG capsulotomy,
   trabeculectomy / MIGS, corneal cross-linking, PRP laser. Each ends with the post-operative state
   the patient will actually experience (gas bubble line, dilated pupil, floaters post-injection).

6. **Patient-view simulator.** The flagship. Given a condition and severity, render what a person
   might see, applied either to a neutral scene or to a photo the patient chooses (processed
   on-device, never stored unless they save it):
   - central scotoma (AMD, macular hole) with correct softness and fill-in behaviour;
   - metamorphopsia (ERM, CSR) as a real distortion field, not a blur;
   - arcuate and peripheral field loss (glaucoma, RP) with realistic gradual edges — **not** a hard
     black tunnel, which is the most common and most misleading depiction;
   - curtain / shadow (detachment) with the correct inverted geometry — a superior detachment
     produces an inferior field loss, and the simulator must get this right;
   - floaters and Weiss ring with parallax that lags eye movement;
   - glare, halos and starbursts (cataract, dry eye, post-refractive);
   - contrast and colour desaturation (optic neuropathy);
   - diplopia; photophobia dimming.
   Every simulation carries the same boundary: **an illustration of a described experience, not a
   measurement of anyone's vision.**

7. **Bridge to the patient's own record.** From `My Eyes` and the `Timeline`, a documented diagnosis
   or procedure links to its atlas entry — reusing the Phase-05 matching, tightened so a specific
   condition never falls through to a broader one. From the simulator, an **"is this like what you
   see?"** action drops a pre-filled drawing into `What I See` for the patient to adjust — turning
   a generic illustration into their own dated record. Never write a record automatically.

8. **Atlas browsing.** Search and filter by region, by symptom ("I see distortion"), and by the
   patient's own profiles. Each entry deep-links (`#/visualize/atlas/<id>`) so a brief or a note can
   point at it.

## Acceptance criteria

- [ ] ≥ 40 atlas entries across all four regions, each with a render, annotations, plain-language
      copy, and a patient-view simulation where applicable.
- [ ] Severity sliders produce continuous, plausible progression for at least: glaucoma cupping,
      dry AMD, diabetic retinopathy, cataract, retinal detachment extent.
- [ ] Every procedure animation is scrubbable, narrated from `education.ts`, and ends in the
      post-operative state.
- [ ] Field-loss simulations use gradual edges; a hard-black tunnel appears nowhere in the app.
- [ ] Detachment simulation inverts the field correctly (assert with a test on the geometry).
- [ ] Every clinical string in the atlas appears in `docs/atlas-review.md` with a source, and the PR
      states clearly that it needs clinician review before release.
- [ ] "Is this like what you see?" produces an editable draft drawing and writes nothing until the
      patient saves.
- [ ] Atlas entries lazy-load; the initial Visualize load does not pull all 40.

## Risks & non-goals

- **Suggestion risk.** Showing a patient forty diseases can plant symptoms that were not there. The
  atlas must be a reference the patient navigates deliberately, never a "conditions you might have"
  surface, and never surfaced from their symptom entries. Search by symptom is acceptable; ranked
  suggestion by symptom is not.
- **Anxiety risk.** Severity sliders can be read as a prediction. Copy must be explicit: this shows
  *how the condition is described*, not where anyone is heading.
- **Not** diagnostic. No differential ranking of the patient's own symptoms anywhere in the app.
- All clinical accuracy claims require human review before release. An agent must not sign off
  medical copy.

## Agent brief

> Execute `docs/plan/phase-07-disease-atlas.md`. Build the condition-module contract over the Phase
> 06 engine, author ≥ 40 conditions across ocular surface, anterior segment, vitreoretina and optic
> nerve as composable parameter deltas with continuous severity, add locked-camera compare mode,
> scrubbable procedure animations reusing `education.ts` copy, and the patient-view simulator with
> anatomically correct field-loss geometry and gradual edges. Link atlas entries from documented
> diagnoses and procedures, and add "is this like what you see?" that drafts — never saves — a
> drawing. Put every clinical string in `docs/atlas-review.md` with sources and flag the PR as
> requiring clinician sign-off.
