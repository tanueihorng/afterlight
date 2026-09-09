import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { STORES, dbClear } from "../lib/db";
import { seedDemo, removeDemoData } from "../lib/demo";
import {
  downloadArchive,
  decryptArchive,
  importArchive,
  inspectArchive,
  isEncryptedArchive,
  readArchiveFile,
  WrongPassphrase,
  type Archive,
  type ArchiveSummary,
  type ImportMode,
} from "../lib/archive";
import {
  backupState,
  formatBytes,
  requestPersistence,
  storageState,
  type StorageState,
} from "../lib/backup";
import { toAllData } from "../lib/store";
import { Field, Modal } from "../components/ui";
import DisplaySettings from "../components/DisplaySettings";
import ConditionProfiles from "../components/ConditionProfiles";
import { formatDate } from "../lib/util";
import { t } from "../lib/i18n";
import { CHANGELOG, CURRENT_RELEASE, VERSION } from "../lib/changelog";

const REPO_URL = "https://github.com/tanueihorng/afterlight";
import { ConfirmButton, PageHeader, SafetyNotice } from "../components/ui";

export default function Settings() {
  const store = useStore();
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const checkRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<{ archive: Archive; summary: ArchiveSummary } | null>(
    null,
  );
  const [sealed, setSealed] = useState<unknown | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [encryptOnExport, setEncryptOnExport] = useState(false);
  const [storage, setStorage] = useState<StorageState>({ supported: false });
  const [inspectOnly, setInspectOnly] = useState(false);

  const backup = backupState(toAllData(store), store.meta);

  useEffect(() => {
    void storageState().then(setStorage);
  }, []);

  const exportAll = async () => {
    if (encryptOnExport && exportPassphrase.length < 8) {
      setStatus("Choose a passphrase of at least 8 characters, or export without encryption.");
      return;
    }
    setStatus("Preparing export…");
    const archive = await downloadArchive(encryptOnExport ? exportPassphrase : undefined);
    await store.setMeta({ last_export_at: archive.exported_at, changes_since_export: 0 });
    setExportPassphrase("");
    setStatus(
      `Export downloaded — ${archive.counts ? Object.values(archive.counts).reduce((a, b) => a + b, 0) : 0} records and ${archive.files.length} files. Keep it somewhere safe; it contains sensitive health information.`,
    );
  };

  const openArchiveFile = async (file: File, justChecking: boolean) => {
    setInspectOnly(justChecking);
    setStatus(justChecking ? "Checking that archive…" : "Reading that archive…");
    try {
      const parsed = await readArchiveFile(file);
      if (isEncryptedArchive(parsed)) {
        setSealed(parsed);
        setStatus("");
        return;
      }
      const summary = await inspectArchive(parsed);
      setPending({ archive: parsed as Archive, summary });
      setStatus("");
    } catch (e) {
      setStatus(`Could not read that file: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  };

  const unseal = async () => {
    try {
      const archive = await decryptArchive(sealed as never, passphrase);
      const summary = await inspectArchive(archive);
      setSealed(null);
      setPassphrase("");
      setPending({ archive, summary });
    } catch (e) {
      setStatus(
        e instanceof WrongPassphrase
          ? "That passphrase does not open this archive. Nothing has been changed."
          : "That archive could not be opened. Nothing has been changed.",
      );
    }
  };

  const runImport = async (mode: ImportMode) => {
    if (!pending) return;
    setStatus("Importing…");
    try {
      const result = await importArchive(pending.archive, mode);
      setPending(null);
      setStatus(
        `Import complete — ${result.added} added, ${result.updated} updated, ${result.skipped} left alone, ${result.files} files. Reloading…`,
      );
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setStatus(
        `Import failed, and nothing was changed: ${e instanceof Error ? e.message : "unknown error"}`,
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        sub="Your data lives in this browser on this device. Export it, import it elsewhere, or delete it — you are never locked in."
      />

      <DisplaySettings />

      <ConditionProfiles />

      <section className="card">
        <div className="card-title">Demo data</div>
        <p className="muted" style={{ marginTop: 0 }}>
          Demo data is synthetic and clearly labelled — useful for exploring Afterlight before
          trusting it with your own record. It can be removed at any time without touching your real
          entries.
        </p>
        <div className="btn-row">
          {!store.meta?.demo_seeded ? (
            <button
              className="btn"
              onClick={async () => {
                setStatus("Generating demo data…");
                await seedDemo(store);
                setStatus("Demo data loaded. Look for the “Demo data” badges.");
              }}
            >
              Load demo data
            </button>
          ) : (
            <ConfirmButton
              label="Remove demo data"
              confirmLabel="Remove all demo records?"
              onConfirm={async () => {
                await removeDemoData(store);
                setStatus("Demo data removed.");
              }}
              className="btn danger"
            />
          )}
          {store.meta?.demo_seeded && (
            <span className="badge demo">Demo data is currently loaded</span>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-title">Backup</div>
        <p className="muted" style={{ marginTop: 0 }}>
          Your record lives in this browser, on this device. Clearing your browser data deletes it.
          An export is the only copy that survives that, so keep a recent one somewhere safe.
        </p>
        <p className="muted" style={{ marginTop: 0 }}>
          This is the most common way people lose years of entries — not a bug, not a crash, just a
          cleared browser or a replaced phone. Where to keep the file, and how to move to a new
          device, is written out in{" "}
          <a
            href={`${REPO_URL}/blob/main/docs/keeping-it-safe.md`}
            target="_blank"
            rel="noreferrer"
          >
            keeping it safe
          </a>
          .
        </p>
        <p style={{ color: "var(--text-2)", fontSize: "var(--fs-base)" }}>
          {backup.neverExported
            ? `This record has never been exported. It holds ${backup.totalRecords} records.`
            : `Last exported ${formatDate(backup.lastExportAt!.slice(0, 10))}${
                backup.daysSinceExport !== undefined ? ` — ${backup.daysSinceExport} days ago` : ""
              }. ${backup.unsavedChanges} record${backup.unsavedChanges === 1 ? "" : "s"} changed since then.`}
        </p>

        <div className="check-row" style={{ marginTop: 10 }}>
          <input
            id="encrypt-export"
            type="checkbox"
            checked={encryptOnExport}
            onChange={(e) => setEncryptOnExport(e.target.checked)}
          />
          <label htmlFor="encrypt-export">Protect this export with a passphrase</label>
        </div>
        {encryptOnExport && (
          <>
            <Field label="Passphrase (at least 8 characters)">
              <input
                type="password"
                value={exportPassphrase}
                onChange={(e) => setExportPassphrase(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>
              There is no way to recover this passphrase. If you lose it, the export cannot be
              opened by anyone, including you.
            </p>
          </>
        )}

        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={exportAll}>
            ⭳ Export everything
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⭱ Import from an export
          </button>
          <button className="btn subtle" onClick={() => checkRef.current?.click()}>
            Test my backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void openArchiveFile(f, false);
              e.target.value = "";
            }}
          />
          <input
            ref={checkRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void openArchiveFile(f, true);
              e.target.value = "";
            }}
          />
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          “Test my backup” opens an archive and tells you what is in it, without changing anything
          on this device.
        </p>
      </section>

      <section className="card">
        <div className="card-title">Storage on this device</div>
        {storage.supported ? (
          <>
            <p style={{ color: "var(--text-2)", fontSize: "var(--fs-base)", marginTop: 0 }}>
              Afterlight is using {formatBytes(storage.usageBytes)}
              {storage.quotaBytes ? ` of roughly ${formatBytes(storage.quotaBytes)} available` : ""}
              .
            </p>
            <p style={{ color: "var(--text-2)", fontSize: "var(--fs-base)" }}>
              {storage.persisted
                ? "This browser has marked your record as persistent, so it will not be cleared automatically to free space."
                : "This browser has not marked your record as persistent, which means it could be cleared automatically if the device runs low on space. Exporting regularly is the protection."}
            </p>
            {!storage.persisted && (
              <button
                className="btn"
                onClick={async () => {
                  const granted = await requestPersistence();
                  setStorage(await storageState());
                  setStatus(
                    granted
                      ? "This browser will now keep your record when space runs low."
                      : "This browser declined to mark the record as persistent. Keep exporting regularly.",
                  );
                }}
              >
                Ask this browser to keep my record
              </button>
            )}
          </>
        ) : (
          <p className="muted" style={{ marginTop: 0 }}>
            This browser does not report how much storage it is using.
          </p>
        )}
      </section>

      <section className="card">
        <div className="card-title">Danger zone</div>
        <ConfirmButton
          label="Delete all records permanently"
          confirmLabel="Delete absolutely everything on this device?"
          className="btn danger"
          onConfirm={async () => {
            for (const s of STORES) await dbClear(s);
            store.clearAll();
            setStatus("All records deleted. Reloading…");
            setTimeout(() => window.location.reload(), 700);
          }}
        />
      </section>

      <AboutSection />

      <section className="card">
        <div className="card-title">Privacy & boundaries</div>
        <ul
          style={{ color: "var(--text-2)", fontSize: "var(--fs-base)", margin: 0, paddingLeft: 20 }}
        >
          <li>{t("boundary.stays_here")}</li>
          <li>{t("boundary.not_a_diagnosis")}</li>
          <li>{t("boundary.not_a_substitute")}</li>
          <li>{t("boundary.missing_is_missing")}</li>
          <li>{t("boundary.drawings_subjective")}</li>
        </ul>
        <div style={{ marginTop: 14 }}>
          <SafetyNotice>{t("safety.settings_notice")}</SafetyNotice>
        </div>
      </section>

      {status && (
        <p role="status" style={{ color: "var(--text-2)", marginTop: 14 }}>
          {status}
        </p>
      )}

      {sealed !== null && (
        <Modal title="This archive is protected" onClose={() => setSealed(null)}>
          <p style={{ color: "var(--text-2)" }}>
            Enter the passphrase this export was created with. Nothing on this device changes until
            you choose to import.
          </p>
          <Field label="Passphrase">
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <div className="modal-actions">
            <button className="btn" onClick={() => setSealed(null)}>
              Cancel
            </button>
            <button className="btn primary" onClick={unseal}>
              Open archive
            </button>
          </div>
        </Modal>
      )}

      {pending && (
        <Modal
          title={inspectOnly ? "What is in this backup" : "Import this archive?"}
          onClose={() => setPending(null)}
          wide
        >
          <ArchivePreview summary={pending.summary} current={backup.totalRecords} />
          {pending.summary.problems.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <SafetyNotice>
                {pending.summary.problems.join(" ")} Importing it could bring in damaged records.
              </SafetyNotice>
            </div>
          )}
          <div className="modal-actions">
            <button className="btn" onClick={() => setPending(null)}>
              {inspectOnly ? "Close" : "Cancel"}
            </button>
            {!inspectOnly && (
              <>
                <button className="btn" onClick={() => runImport("merge")}>
                  Merge into my record
                </button>
                <ConfirmButton
                  label="Replace everything"
                  confirmLabel="Replace all records on this device?"
                  className="btn danger"
                  onConfirm={() => runImport("replace")}
                />
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function ArchivePreview({ summary, current }: { summary: ArchiveSummary; current: number }) {
  return (
    <>
      <p style={{ color: "var(--text-2)" }}>
        This archive holds <strong>{summary.totalRecords}</strong> records
        {summary.earliest && summary.latest
          ? ` from ${formatDate(summary.earliest)} to ${formatDate(summary.latest)}`
          : ""}
        , and {summary.fileCount} file{summary.fileCount === 1 ? "" : "s"} (
        {formatBytes(summary.fileBytes)}). This device currently holds <strong>{current}</strong>{" "}
        records.
      </p>
      <p className="muted">
        Exported{" "}
        {summary.exported_at
          ? formatDate(summary.exported_at.slice(0, 10))
          : "at an unrecorded time"}
        {summary.checksumOk === true && " · contents match its checksum"}
        {summary.checksumOk === false && " · contents do NOT match its checksum"}
        {summary.checksumOk === undefined && " · no checksum recorded (an older export)"}
        {summary.needsMigrationFrom !== undefined &&
          ` · will be upgraded from schema version ${summary.needsMigrationFrom}`}
      </p>
      <table className="kv-table">
        <tbody>
          {Object.entries(summary.counts)
            .filter(([, n]) => n > 0)
            .map(([store, n]) => (
              <tr key={store}>
                <td style={{ color: "var(--text-3)", paddingRight: 16 }}>{store}</td>
                <td>{n}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>
        Merge keeps everything on this device and adds what is missing, preferring whichever copy of
        a record was updated more recently. Replace discards what is here first.
      </p>
    </>
  );
}

/**
 * Version, what changed, and where the boundaries are written down.
 *
 * The changelog is the same list the repository publishes, worded for the person using the app
 * rather than for whoever wrote it. The unreviewed-clinical-wording notice is here rather than
 * buried in a document, because someone deciding whether to trust this deserves to be told
 * without having to go looking.
 */
function AboutSection() {
  const [open, setOpen] = useState(false);
  return (
    <section className="card">
      <div className="card-title">About Afterlight</div>
      <p style={{ color: "var(--text-2)", fontSize: "var(--fs-base)", marginTop: 0 }}>
        Version <span className="mono">{VERSION}</span>
        {CURRENT_RELEASE ? ` — ${CURRENT_RELEASE.summary}` : ""}
      </p>

      <div className="safety" role="note" style={{ marginBottom: 14 }}>
        <span className="safety-icon" aria-hidden>
          ◇
        </span>
        <div>
          The wording in this app that describes eye conditions, the home checks and the urgent-care
          notices has not yet been reviewed by an ophthalmologist or optometrist. Until it has,
          treat every explanation here as background reading rather than as advice about your eyes.
        </div>
      </div>

      {/* Links, styled as links. Dressing them as buttons would say they do something here,
          and each one opens a page elsewhere. */}
      <ul className="doc-links">
        <li>
          <a href={`${REPO_URL}/blob/main/docs/guide.md`} target="_blank" rel="noreferrer">
            User guide
          </a>{" "}
          <span className="muted">— the daily habit, drawing, appointments, and the rest</span>
        </li>
        <li>
          <a
            href={`${REPO_URL}/blob/main/docs/keeping-it-safe.md`}
            target="_blank"
            rel="noreferrer"
          >
            Keeping it safe
          </a>{" "}
          <span className="muted">— backup, restore, and moving to a new device</span>
        </li>
        <li>
          <a href={`${REPO_URL}/blob/main/docs/boundaries.md`} target="_blank" rel="noreferrer">
            What it will not do
          </a>{" "}
          <span className="muted">— and why not</span>
        </li>
        <li>
          <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">
            Report a problem
          </a>{" "}
          <span className="muted">
            — an accessibility barrier or a wrong word both go to a person
          </span>
        </li>
      </ul>

      <button className="btn subtle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide what changed" : "What changed"}
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          {CHANGELOG.map((release) => (
            <div key={release.version} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, color: "var(--text)" }}>
                {release.version}
                {release.date ? ` · ${formatDate(release.date)}` : " · not released yet"}
              </div>
              <div className="muted" style={{ marginBottom: 4 }}>
                {release.summary}
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  color: "var(--text-2)",
                  fontSize: "var(--fs-sm)",
                }}
              >
                {release.changes.map((change, i) => (
                  <li key={i} style={{ marginBottom: 3 }}>
                    {change}
                  </li>
                ))}
              </ul>
              {release.notes?.map((note, i) => (
                <p key={i} className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 6 }}>
                  {note}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      <p className="muted" style={{ fontSize: "var(--fs-xs)", marginTop: 10 }}>
        MIT licensed. Built with React and Three.js, both MIT licensed. No other runtime
        dependencies, no fonts or code loaded from anywhere else.
      </p>
    </section>
  );
}
