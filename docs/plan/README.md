# Afterlight — Build Plan

A phased plan to take Afterlight from "works for me" to "trustworthy for anyone living with a
retinal or ocular condition."

Each phase is a **self-contained brief**. An agent can open one file, execute it without reading
this conversation or any other phase, and stop with a verifiable result.

---

## The point of all of this

Afterlight exists because the person with the condition is the only one watching their eyes
between appointments, and memory is a terrible instrument. Everything in this plan is judged
against one question:

> **When the clinician asks "has it changed since last time?", does the patient have a real answer?**

Features that do not serve that question are decoration. Features that make the record less
trustworthy are damage, no matter how impressive they look.

---

## Non-negotiables (every phase must preserve these)

These are invariants, not preferences. A phase that breaks one is not done, however good it looks.

1. **Local-first, no backend.** No account, no telemetry, no upload. Data leaves only by explicit
   user export, print, or share action. Adding a network call to a third party is a design failure,
   not an optimisation.
2. **Provenance is never lost.** Every record carries `eye` and `source_type`. Patient-reported,
   patient-drawn, clinician-documented, device-measured and document-extracted content is visually
   distinguishable everywhere it appears, including in exports, briefs and print.
3. **No diagnosis, no risk scores, no prognosis.** The app organises and compares. It never
   interprets. No probabilities, no "your vision is declining", no reassurance. Emergency guidance
   is one restrained sentence pointing at a real clinician.
4. **Missing data is shown as missing.** "Not recorded" is never rendered as normal. A quiet log
   is never presented as a healthy eye.
5. **Nothing generic is ever presented as the patient's own anatomy.** Every visualization carries
   an unmissable "generic, educational, not your eye" boundary — including realistic renders.
   The more realistic the render, the louder this must be.
6. **Calm.** No alarm colours as decoration, no streak-shaming, no notifications that frighten
   someone at 2am. Restraint is a feature.
7. **The daily loop stays under 30 seconds.** Any phase that adds friction to `Today` must remove
   an equal amount elsewhere or make the addition optional.

---

## How an agent runs a phase

1. Read `docs/plan/phase-NN-*.md` end to end before writing code.
2. Read the files named in **Scope**. Match the surrounding style — the codebase has a voice.
3. Work through **Tasks** in order. They are ordered by dependency.
4. Verify against **Acceptance criteria**. Every box must be checkable by running something, not
   by opinion.
5. Run the gate before declaring done:
   ```bash
   cd app && npm run verify      # typecheck + lint + test + build (exists after Phase 0)
   ```
   Until Phase 0 lands, the gate is `npm run build`.
6. Commit as `phase-NN: <what changed>`. One phase, one branch, one PR where possible.
7. Report what was **not** done and why. Scaling scope down is the human's call, not the agent's.

**Ground rules for agents**

- Do not invent clinical content. Any medical wording that is not already in the repo must be
  generic, textbook-level, and flagged in the PR description for human review.
- Do not add a runtime dependency without justifying it in the PR. The app is React + TS + Vite and
  nothing else; the renderer may add Three.js and nothing else.
- Do not refactor outside **Scope** — flag it instead.
- Prefer deleting code to adding options. Every setting is a permanent maintenance cost.
- If a task turns out to be wrong, stop and say so. A phase brief is a plan, not a contract with
  reality.

---

## Phase index

| # | Phase | Why it matters | Depends on |
|---|---|---|---|
| [00](phase-00-foundations.md) | Foundations & guardrails | You cannot make something robust that you cannot test | — |
| [01](phase-01-data-integrity.md) | Data integrity & portability | A record you can lose by clearing your browser is not a record | 00 |
| [02](phase-02-performance.md) | Performance & scale | Ten years of daily entries must stay instant | 00, 01 |
| [03](phase-03-low-vision-access.md) | Accessibility for low vision | The users have eye disease. This is the phase that decides who can use it | 00 |
| [04](phase-04-daily-loop-mobile.md) | Daily loop & mobile | The record only exists if the daily entry actually happens | 03 |
| [05](phase-05-clinical-breadth.md) | Clinical breadth & home self-tests | Retina is the start; glaucoma, AMD, DR, cornea deserve the same care | 01 |
| [06](phase-06-render-engine.md) | Visualization I — realistic eye renderer | "Show me what happened to my eye" deserves a real answer | 02 |
| [07](phase-07-disease-atlas.md) | Visualization II — whole-eye atlas & simulator | Every condition, plus what it actually looks like from inside | 05, 06 |
| [08](phase-08-records-intelligence.md) | Records intelligence | Turn ten months of entries into the answer to one question | 01, 05 |
| [09](phase-09-clinician-handoff.md) | Clinician handoff & sharing | The brief has to survive contact with a real clinic | 08 |
| [10](phase-10-release.md) | Release, docs & clinical review | Other patients can only benefit from what they can install and trust | all |

**Suggested order:** 00 → 01 → 03 → 02 → 04 → 05 → 06 → 07 → 08 → 09 → 10.
Phases 03 and 05 can run in parallel with 02. Phase 06 is the long pole — start its spike early.

---

## Definition of done, globally

A phase is done when:

- `npm run verify` passes clean.
- New behaviour is covered by tests that would fail if the behaviour regressed.
- Keyboard-only and screen-reader paths work for anything new (from Phase 03 onward this is
  enforced by tests).
- Nothing in **Non-negotiables** regressed — check explicitly, do not assume.
- The demo dataset still loads, still looks coherent, and still exercises the new feature.
- `docs/` reflects any change a user or a future agent would need to know.
