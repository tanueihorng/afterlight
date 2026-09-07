---
description: Add a new record type to the data model with provenance and migration done correctly
argument-hint: <RecordName> — what it stores
---

Add the record type **$1** to Afterlight's data model, following the repo's conventions exactly.

Required, without exception:

- Declared in `app/src/lib/models.ts` with `id`, `created_at`, `updated_at`, `eye: Eye`,
  `source_type: SourceType`, and optional `demo?: boolean`. If it is genuinely not eye-specific,
  say why in a comment and add it to the guard's exemption list deliberately.
- Added to `AllData`, `EMPTY_DATA`, the object store list and `loadAllData()` in `app/src/lib/db.ts`.
- Exposed through the store in `app/src/lib/store.tsx` with the same `EntityOps` shape as its peers.
- Represented in `buildTimeline()` with an icon, a title, a summary and its `source_type` carried
  through — never flattened.
- Included in export/import so a record of this type survives a full round trip.
- Indexed in `app/src/lib/search.ts` so it is findable, with an honest `kind` label.
- Covered by demo data in `app/src/lib/demo.ts` with `demo: true`, fitting the existing clinical story.
- Migrated: a schema change to stored data needs a migration, not a silent shape change. If the
  migration system from Phase 01 does not exist yet, add a defensive normaliser on read and say so.

Then run `cd app && npm run verify` and confirm the guard passes. Report anything you could not do.
