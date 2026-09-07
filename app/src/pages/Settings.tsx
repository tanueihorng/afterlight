import { useRef, useState } from "react";
import { useStore } from "../lib/store";
import { STORES, dbClear, dbPutMany, type AllData } from "../lib/db";
import { seedDemo, removeDemoData } from "../lib/demo";
import { dataURLToBlob, downloadArchive } from "../lib/archive";
import { ConfirmButton, PageHeader, SafetyNotice } from "../components/ui";


export default function Settings() {
  const store = useStore();
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const theme = store.meta?.theme ?? "dark";

  const exportAll = async () => {
    setStatus("Preparing export…");
    await downloadArchive();
    setStatus("Export downloaded. Keep it somewhere safe — it contains sensitive health information.");
  };

  const importAll = async (file: File) => {
    setStatus("Importing…");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { app: string; data: unknown };
      if (parsed.app !== "afterlight") throw new Error("Not an Afterlight export");
      const d = parsed.data as AllData & {
        files?: { id: string; name: string; mime: string; data: string }[];
        meta?: { id: string };
      };
      for (const s of STORES) await dbClear(s);
      const put = <T,>(store: keyof AllData, list: T[] | undefined) =>
        list ? dbPutMany(store as never, list) : Promise.resolve();
      await put("symptoms", d.symptoms);
      await put("dailyLogs", d.dailyLogs);
      await put("floaters", d.floaters);
      await put("drawings", d.drawings);
      await put("appointments", d.appointments);
      await put("questions", d.questions);
      await put("diagnoses", d.diagnoses);
      await put("procedures", d.procedures);
      await put("medications", d.medications);
      await put("prescriptions", d.prescriptions);
      await put("measurements", d.measurements);
      await put("imaging", d.imaging);
      await put("documents", d.documents);
      await put("baselines", d.baselines);
      await put("briefs", d.briefs);
      for (const f of d.files ?? []) {
        const blob = dataURLToBlob(f.data);
        await dbPutMany("files", [{ id: f.id, name: f.name, mime: blob.type || f.mime, blob }]);
      }
      if (d.meta) await dbPutMany("meta", [d.meta]);
      setStatus("Import complete. Reloading…");
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setStatus(`Import failed: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        sub="Your data lives in this browser on this device. Export it, import it elsewhere, or delete it — you are never locked in."
      />

      <section className="card">
        <div className="card-title">Appearance</div>
        <div className="btn-row">
          <button
            className={`btn ${theme === "dark" ? "primary" : ""}`}
            onClick={() => store.setMeta({ theme: "dark" })}
            aria-pressed={theme === "dark"}
          >
            ◐ Dark
          </button>
          <button
            className={`btn ${theme === "light" ? "primary" : ""}`}
            onClick={() => store.setMeta({ theme: "light" })}
            aria-pressed={theme === "light"}
          >
            ◑ Light
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-title">Demo data</div>
        <p className="muted" style={{ marginTop: 0 }}>
          Demo data is synthetic and clearly labelled — useful for exploring Afterlight before
          trusting it with your own record. It can be removed at any time without touching your
          real entries.
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
          {store.meta?.demo_seeded && <span className="badge demo">Demo data is currently loaded</span>}
        </div>
      </section>

      <section className="card">
        <div className="card-title">Export & import</div>
        <p className="muted" style={{ marginTop: 0 }}>
          A full archive as a single JSON file: every record, drawing and original image. Sensitive
          — store it accordingly.
        </p>
        <div className="btn-row">
          <button className="btn primary" onClick={exportAll}>
            ⭳ Export everything (JSON)
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⭱ Import from export
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importAll(f);
              e.target.value = "";
            }}
          />
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>Import replaces everything currently stored on this device.</p>
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

      <section className="card">
        <div className="card-title">Privacy & boundaries</div>
        <ul style={{ color: "var(--text-2)", fontSize: "0.9rem", margin: 0, paddingLeft: 20 }}>
          <li>All records, images and documents stay on this device. Nothing is uploaded.</li>
          <li>Afterlight is a personal record — it does not diagnose disease and does not replace an ophthalmologist.</li>
          <li>Symptom logging is not a substitute for urgent assessment when something is sudden or severe.</li>
          <li>Missing information is shown as “Not recorded”, never as a normal result.</li>
          <li>Patient drawings are subjective representations; visualisations are educational.</li>
        </ul>
        <div style={{ marginTop: 14 }}>
          <SafetyNotice>
            If you notice sudden floaters, flashes, a curtain or shadow over your vision, or a
            sudden drop in vision, contact an ophthalmologist or emergency eye service promptly.
          </SafetyNotice>
        </div>
      </section>

      {status && (
        <p role="status" style={{ color: "var(--text-2)", marginTop: 14 }}>
          {status}
        </p>
      )}
    </>
  );
}


