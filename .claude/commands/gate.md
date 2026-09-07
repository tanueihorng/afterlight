---
description: Run the full quality gate and the non-negotiables check on the current working tree
---

Run Afterlight's gate against the current working tree and report honestly.

1. `cd app && npm run verify` — paste real output. If it fails, stop and report the failure.
2. Review the diff (`git diff` plus `git status` for untracked files) against the seven
   non-negotiables in `AGENTS.md`, one by one. For each, state **pass** or **fail** with the
   evidence — a file and line, not an impression:
   - local-first (no network, no third-party assets, no telemetry)
   - provenance preserved (`eye` + `source_type`, distinguishable in UI, brief, print, export)
   - no diagnosis / risk score / prognosis / reassurance
   - missing data shown as missing
   - nothing generic presented as the patient's own anatomy
   - calm (no alarm decoration, streaks, guilt, frightening copy)
   - daily loop still under 30 seconds
3. Check the definition of done in `AGENTS.md` §7 and report which items are unmet.
4. List anything in the diff that needs **human** sign-off per `AGENTS.md` §5 — especially new or
   changed clinical wording, which must be quoted in full so a person can read it.

Be blunt. A gate that reports success on work that is not done is worse than no gate.
