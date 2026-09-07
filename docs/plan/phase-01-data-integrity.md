# Phase 01 — Data integrity & portability

> **Goal:** make it impossible to lose the record by accident, and possible to move it anywhere.

## Why it matters

Right now the entire record lives in one browser's IndexedDB. Clearing site data, switching
browsers, or a corrupted write loses years of entries with no warning and no recovery. For a
medical diary, that is the single highest-severity flaw in the product. A patient who loses their
history loses exactly the thing they were building it for: the comparison.

## Preconditions

Phase 00 (tests exist, so migrations can be tested).

## Scope

```
app/src/lib/db.ts               schema version, migrations, quota handling
app/src/lib/migrations.ts       new
app/src/lib/archive.ts          new — export/import v2, integrity, encryption
app/src/lib/backup.ts           new — backup state, reminder logic
app/src/pages/Settings.tsx      backup UI, restore, encryption toggle
app/src/components/BackupNudge.tsx  new
app/src/lib/models.ts           add schema_version to the archive envelope
```

## Tasks

1. **Schema versioning.** Introduce `SCHEMA_VERSION` and store it in the `meta` record. Add
   `migrations.ts` with an ordered array of `{ from, to, migrate(data) }`. On load, run every
   applicable migration in order, in one transaction, writing a pre-migration snapshot to a
   `backups` store first. Migrations must be pure functions over `AllData` so they are testable.

2. **Archive format v2.** Export becomes a versioned envelope:
   ```jsonc
   {
     "format": "afterlight-archive",
     "version": 2,
     "schema_version": 3,
     "exported_at": "2026-09-08T10:00:00Z",
     "app_version": "0.2.0",
     "counts": { "symptoms": 412, "drawings": 63, "imaging": 18, "files": 21 },
     "checksum": "sha256-...",      // over the canonicalised payload
     "data": { ... },               // AllData
     "files": [ { "id": "...", "name": "...", "mime": "...", "b64": "..." } ]
   }
   ```
   Import validates `format`, migrates from any older `schema_version`, verifies the checksum, and
   **shows a diff before writing**: "This archive holds 412 symptom entries from 4 Jan 2026 to
   8 Sep 2026. Your current record holds 12. Replace / Merge / Cancel." Never silently replace.

3. **Merge import.** Implement merge by `id` with `updated_at` as the tiebreaker, reporting
   `added / updated / skipped` counts. This is what makes two devices possible without a server.

4. **Optional passphrase encryption.** Export can be encrypted with WebCrypto AES-GCM, key derived
   via PBKDF2 (≥ 250k iterations, random salt). Encrypted archives carry
   `"encryption": {"kdf":"PBKDF2-SHA256","iterations":250000,"salt":"...","iv":"..."}` in cleartext
   so import can decrypt. State plainly in the UI: **there is no recovery if the passphrase is
   lost.** Never store the passphrase.

5. **Backup state & nudge.** Track `last_export_at` in meta. `BackupNudge` shows a calm, dismissible
   line on Settings and Today when the last export is older than 30 days *and* the record has
   changed since: "Your record has 46 entries not yet in a backup. Last export: 12 Jul."
   One button: export. No badges, no red, no nagging more than once a week.

6. **Storage quota handling.** Use `navigator.storage.estimate()` to show usage in Settings
   ("Imaging is using 41 MB of an estimated 2 GB available"). Call
   `navigator.storage.persist()` on first successful save and report the result honestly — if the
   browser declines persistence, say that the record may be evicted and that export is the
   protection. Handle `QuotaExceededError` on file save with a clear, actionable message.

7. **Restore drill.** Settings gets **"Test my backup"**: pick an archive file, validate and
   summarise it *without* importing. This turns backup from a hope into something a patient can
   verify.

8. **Write safety.** Wrap multi-record writes (demo seeding, import, migrations) in a single
   IndexedDB transaction so a failure cannot leave a half-written record.

## Acceptance criteria

- [ ] A v1 archive (hand-crafted fixture) imports cleanly into the current schema via migrations.
- [ ] A corrupted archive (mutated byte) is rejected with a clear message, and the existing record
      is untouched.
- [ ] Merge import of an overlapping archive reports accurate `added/updated/skipped` counts and
      never duplicates a record by `id`.
- [ ] Encrypted export → import round-trips with the right passphrase; the wrong passphrase fails
      with a plain message and no data loss.
- [ ] Export → clear all site data → import restores drawings, images and documents byte-identical
      (assert blob hashes).
- [ ] Backup nudge appears only under the stated conditions and never more than weekly.
- [ ] Migration tests cover every version step, including a no-op migration.

## Risks & non-goals

- **Not** building sync, cloud backup, or accounts. Merge import *is* the sync story.
- Base64 in JSON inflates archives ~33%; that is an accepted trade for a single-file archive that
  works everywhere. If archives exceed ~200 MB in practice, revisit with a ZIP container in a later
  phase — do not pre-optimise here.
- Encryption must be genuinely optional and off by default; a lost passphrase is worse than an
  unencrypted file in a folder the patient controls.

## Agent brief

> Execute `docs/plan/phase-01-data-integrity.md`. Add schema versioning with tested migrations, an
> archive v2 envelope with checksum and counts, import with a preview diff and replace/merge modes,
> optional WebCrypto passphrase encryption, backup-age tracking with a calm nudge, storage quota
> reporting with `navigator.storage.persist()`, a non-destructive "test my backup" validator, and
> transactional multi-record writes. Prove the round trip by exporting, wiping IndexedDB, and
> importing, asserting blob-level identity for drawings and imaging.
