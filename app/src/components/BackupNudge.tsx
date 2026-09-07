import { useState } from "react";
import { backupState, shouldNudge } from "../lib/backup";
import { downloadArchive } from "../lib/archive";
import { toAllData, useStore } from "../lib/store";
import { formatDate, todayLocal } from "../lib/util";

const LAST_NUDGE_KEY = "afterlight.last-backup-nudge";

function readLastNudge(): string | null {
  try {
    return localStorage.getItem(LAST_NUDGE_KEY);
  } catch {
    return null;
  }
}

function writeLastNudge(v: string) {
  try {
    localStorage.setItem(LAST_NUDGE_KEY, v);
  } catch {
    // A browser that refuses storage is a browser that will lose the record; the Settings page
    // says so plainly. Nothing to do here.
  }
}

/**
 * One quiet line about backing up, at most once a week, and only when there is genuinely
 * something unsaved. No badge, no colour, no counting of missed days.
 */
export default function BackupNudge() {
  const store = useStore();
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<"idle" | "working" | "done">("idle");

  const state = backupState(toAllData(store), store.meta);
  if (dismissed || !shouldNudge(state, readLastNudge())) return null;

  const dismiss = () => {
    writeLastNudge(new Date().toISOString());
    setDismissed(true);
  };

  return (
    <div className="card nudge" role="status">
      <p style={{ margin: 0, color: "var(--text-2)", fontSize: "0.92rem" }}>
        {state.neverExported
          ? `Your record holds ${state.totalRecords} entries and has never been exported. If this browser's data is cleared, they are gone.`
          : `${state.unsavedChanges} ${state.unsavedChanges === 1 ? "entry has" : "entries have"} changed since your last export on ${formatDate(state.lastExportAt!.slice(0, 10))}.`}
      </p>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button
          className="btn"
          disabled={status === "working"}
          onClick={async () => {
            setStatus("working");
            const archive = await downloadArchive();
            await store.setMeta({ last_export_at: archive.exported_at, changes_since_export: 0 });
            writeLastNudge(new Date().toISOString());
            setStatus("done");
          }}
        >
          {status === "working" ? "Exporting…" : "⭳ Export now"}
        </button>
        <button className="btn subtle" onClick={dismiss}>
          Not now
        </button>
      </div>
      {status === "done" && (
        <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Exported {formatDate(todayLocal())}. Keep the file somewhere safe.
        </p>
      )}
    </div>
  );
}
