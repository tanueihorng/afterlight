# Asset manifest

Every binary that ships with Afterlight, where it came from, and under what licence.

**Nothing with unclear provenance ships in a public medical repo.** An asset whose licence cannot
be stated in one line is removed rather than kept "for now".

## Status: no baked assets yet

The engine is currently **fully procedural** — geometry, iris, sclera and fundus are all generated
on the device at runtime. There are no committed binaries, so this table is empty and
`npm run verify:assets` passes trivially.

The Blender pipeline exists and is scripted (`build-eye.py`), but it has not been run: Blender is
not installed on the machine where Phase 06 was built. Producing the baked assets is the first
task of whoever picks this up with Blender 4.x available. See `docs/asset-pipeline.md`.

## Assets

| File | Origin | Author | Licence | SHA-256 |
|---|---|---|---|---|
| _(none yet)_ | | | | |

## Rules

- Self-authored or CC0 only. No exceptions, and no "probably fine".
- Every asset must be regenerable by `blender --background assets-src/eye.blend --python assets-src/build-eye.py`.
- Hashes in this table are checked by `app/scripts/verify-assets.mjs`, which runs in CI. Blender
  itself is **not** in CI — the check is a hash comparison, not a rebuild.
- A contributor without Blender must still be able to build, test and run everything.
