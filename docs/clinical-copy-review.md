# Clinical copy — awaiting review

**Status: NOT REVIEWED. Nothing in this document has been checked by a clinician.**

Everything below was written during Phase 05 and needs sign-off from a qualified ophthalmologist
or optometrist before release. It is listed here in full so a person can read exactly what a
patient would see, rather than hunting through the source.

Per `AGENTS.md` §5, an agent must not approve any of this. When it has been reviewed, record the
outcome, the reviewer's role and the date in `docs/clinical-review.md` (Phase 10) and note the
result here.

---

## 1. What kind of copy this is

Three categories, with different risk:

| Category | Risk | Where |
|---|---|---|
| **Boundary statements** — what a feature is and is not | Highest: a wrong framing turns a self-check into a perceived diagnosis | `lib/selftest.ts`, self-test screens |
| **Prompt vocabulary** — condition names and the words clinics use | Low: labels for choosing what to be asked about, no clinical claim | `lib/conditions.ts` |
| **Instructions** — how to do a check | Medium: a badly described check produces a result that is not comparable | `components/tests/*` |

There is deliberately **no** clinical interpretation anywhere: no thresholds, no normal ranges,
no advice about what a result means, and no suggestion to act on one.

---

## 2. Boundary statements — the ones that matter most

The single sentence carried on every self-test screen (`SELF_TEST_BOUNDARY`):

> This is a check you do yourself, to compare with your own earlier attempts. It is not a
> measurement of your vision and it cannot be compared with a test done at a clinic.

Home acuity results are **never** rendered as a bare fraction. The only format used is:

> about 6/12 on a home screen check

After finishing a check:

> You stopped at about 6/12 on a home screen check. This is a home check under the conditions you
> recorded — not a clinical result.

When two attempts were taken differently:

> Taken under different conditions from the earlier attempt, so the two cannot be compared.

> The conditions of one of these attempts were not recorded, so they cannot be compared.

When there is only one attempt:

> One attempt, on 1 September 2026. A single attempt has nothing to compare against yet.

When conditions are incomplete, no result can be saved at all:

> Fill in all four before starting. Without them this attempt could not be compared with any
> other, which is the only thing it is for.

**Reviewer question:** is this framing strong enough that a patient would not report a home result
to a clinician as though it were an acuity measurement?

---

## 3. Check instructions

**Amsler grid**

> A grid of straight lines with a dot in the middle. You mark anywhere the lines look bent,
> blurred or missing, one eye at a time.

> Keeping your eye on the centre dot, mark any area where the lines look wavy, blurred, faded or
> missing. Draw straight onto the grid.

> Cover the other eye completely. Test one, then the other.

**Home vision check**

> Rows of letters that get smaller. You note the smallest row you can read, at a distance you
> record so you can repeat it.

> Cover the other eye. Read the row out loud, then say whether you could read it. Stop when you
> cannot.

> This row would be smaller than this screen can show honestly at 40 cm. The check stops here
> rather than showing something that is not the right size.

**Contrast check**

> A shape that gets fainter each step. You note the faintest one you can still see.

> Each step is fainter than the last. Stop when you cannot see it any more.

**Calibration**

> Hold a bank card flat against the screen and drag the slider until the box is exactly the width
> of the card. Everything after this depends on it, so it is worth doing carefully.

**Reviewer questions:** is the Amsler instruction complete enough to be done correctly at home
(fixation, one eye, reading distance)? Is 33 cm the right default Amsler distance to suggest? Is
the tumbling-E format appropriate, and are the logMAR steps (1.0 → 0.0) sensible for a screen?

---

## 4. Condition profile labels and descriptions

These choose what the app asks about. They are not recorded as diagnoses and a test asserts none
of them says "you have" anything.

| Profile | Description shown |
|---|---|
| Retinal detachment or tear | You have had a detachment or a tear treated, or are being watched for one. |
| Floaters and posterior vitreous detachment | You are tracking floaters, flashes, or a vitreous detachment. |
| Glaucoma or raised eye pressure | You are being treated or monitored for eye pressure or optic nerve changes. |
| Macular degeneration | You are tracking dry or wet AMD, including any injections you receive. |
| Diabetic eye disease | You are tracking diabetic retinopathy or macular oedema. |
| Retinal vein occlusion | You are tracking a branch or central vein occlusion. |
| Uveitis or eye inflammation | You are tracking inflammation inside the eye, including flare-ups. |
| Corneal conditions | Keratoconus, dystrophy, scarring, or another corneal condition. |
| Dry eye and ocular surface | You are tracking dryness, grittiness or surface discomfort. |
| Cataract or lens implant | You are tracking a cataract before surgery, or vision after a lens implant. |
| Epiretinal membrane or macular hole | You are tracking distortion from a membrane or a hole at the macula. |
| Inherited retinal conditions | Retinitis pigmentosa or another inherited retinal condition. |
| Optic nerve conditions | Optic neuritis, swelling, or another optic nerve condition. |

**Reviewer questions:** are these groupings sensible for how patients actually think about their
own condition? Is any common condition missing? Does any label risk someone selecting the wrong
one and being prompted for the wrong things?

Each profile also carries the symptoms it prompts first and the metrics it offers. Those are in
`app/src/lib/conditions.ts` and are worth a skim: the question is whether anything prompted is
something a patient cannot reliably answer.

---

## 5. Measurement methods and units

Recorded alongside values so they are not silently compared across methods:

- IOP: Goldmann applanation, non-contact (air puff), iCare rebound, Tono-Pen
- Acuity: Snellen (6m), Snellen (20ft), logMAR, decimal — conversions are arithmetic only
- Non-numeric acuities: counting fingers, hand movements, light perception, no light perception —
  stored as ordered categories and never converted to numbers or plotted
- Fields: mean deviation, pattern standard deviation, visual field index
- Other: corneal thickness, OCT central subfield thickness, axial length, HbA1c, blood pressure

Corneal thickness is stored **but never applied** as a correction to IOP. That is a clinical
judgement and the app does not make it.

**Reviewer questions:** are the method options the right ones? Is storing CCT without applying a
correction the right call? Should any unit be presented differently?

---

## 6. What is deliberately absent

Listed so a reviewer can confirm the omissions are right:

- No normal ranges or thresholds for any metric
- No trend arrows, no "improving" or "worsening" on any self-test
- No advice to contact anyone based on a result — the only urgent-assessment wording in the app is
  the existing symptom notice, which is unchanged by this phase
- No interpretation of an Amsler grid, whatever is marked on it
- No comparison of a home check against a clinic result
