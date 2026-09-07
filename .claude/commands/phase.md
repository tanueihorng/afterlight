---
description: Execute a build-plan phase end to end (usage: /phase 03)
argument-hint: <phase number, e.g. 03>
---

Execute plan phase **$1** of Afterlight.

1. Read `AGENTS.md` in full, then `docs/plan/phase-$1-*.md` in full, then every file listed in that
   phase's **Scope**. Do not start editing until you have read all of them.
2. Create branch `phase-$1-<slug>` and mark the phase `in progress` in `docs/plan/STATUS.md`
   (date, branch, your name).
3. Work the **Tasks** in order — they are dependency-ordered. Stay inside **Scope**; note anything
   else you find rather than fixing it.
4. Verify each **Acceptance criterion** by running something. A criterion you cannot verify is not
   met — say so.
5. Run the gate: `cd app && npm run verify`. It must pass clean.
6. Commit as `phase-$1: <what changed>`. Do not push and do not open a PR unless asked.
7. Update `docs/plan/STATUS.md` to `done`, listing explicitly what you did **not** do and why.

Then report: what passed, what failed, what you skipped, and anything in the phase brief that
turned out to be wrong. Never report a partially-done phase as done.

Before you finish, confirm out loud that none of the seven non-negotiables in `AGENTS.md`
regressed — check, do not assume. If the phase touches clinical wording, accessibility, or the
provenance model, run the matching reviewer subagent in `.claude/agents/` first.
