# CLAUDE.md

**Read [`AGENTS.md`](AGENTS.md) first — it is the canonical working agreement for this repo.**
Everything in it applies: the seven non-negotiables, the repo map, the commands, what requires a
human, and the phase workflow.

Claude-specific notes:

- **The gate is `cd app && npm run verify`.** Run it before reporting any task complete.
- **Plan phases** live in `docs/plan/`. Use `/phase NN` to execute one; it loads the brief, updates
  the ledger and runs the gate. Use `/gate` to check the current working tree against the
  invariants and the definition of done.
- **Subagents** are defined in `.claude/agents/`: `phase-executor`, `a11y-auditor`,
  `clinical-copy-reviewer`, `record-integrity-reviewer`. Use the reviewers before opening a PR that
  touches accessibility, clinical wording, or the data/provenance model.
- **Do not** run `git push`, create releases, or deploy without being asked. Committing locally on a
  phase branch is fine when the work is done and the gate is green.
- **This is a medical diary.** When you are unsure whether wording crosses into interpretation,
  assume it does and flag it rather than shipping it.
