## What changed

<!-- One paragraph. What a patient or a future agent would need to know. -->

## Phase

<!-- e.g. phase-03, or "not a plan phase" -->

## The non-negotiables

Check each one against your actual diff, with evidence. Do not tick from memory.

- [ ] **Local-first** — no network calls, no third-party assets, no telemetry added
- [ ] **Provenance preserved** — `eye` + `source_type` intact through UI, brief, print and export
- [ ] **No interpretation** — no diagnosis, risk score, probability, prognosis or reassurance
- [ ] **Missing data shown as missing** — nothing absent rendered as normal
- [ ] **Generic ≠ theirs** — no generic visualization presented as the patient's own anatomy
- [ ] **Calm** — no alarm decoration, streaks, guilt, or copy that would frighten someone at 2am
- [ ] **Daily loop ≤ 30s** — `Today` did not get slower to complete

## Gate

```
# paste the real output of: cd app && npm run verify
```

- [ ] Gate passes clean
- [ ] New behaviour is covered by a test that would fail if it regressed
- [ ] Keyboard and screen-reader paths work for anything new
- [ ] Demo data still loads and still looks coherent

## Needs a human

<!-- Quote in full any new or changed clinical wording, safety copy, or anything that weakens an
     invariant. An agent must not self-approve these. Write "none" if there are none. -->

## Not done

<!-- What you left out and why. Scaling scope down is the maintainer's call, not the agent's. -->
