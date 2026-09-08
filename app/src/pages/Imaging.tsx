import { useEffect, useMemo, useState } from "react";
import { useStore, newRecord } from "../lib/store";
import {
  getStoredFile,
  fileToStoredFile,
  dbDelete,
  saveStoredFile,
  storedFileURL,
  StorageFullError,
} from "../lib/db";
import type { DocumentRecord, Eye, ImagingModality, ImagingRecord, SourceType } from "../lib/models";
import { EYE_SHORT } from "../lib/models";
import { ConfirmButton, DemoBadge, EmptyState, EyeBadge, Field, Modal, PageHeader, ProvenanceBadge, SourceSelect } from "../components/ui";
import { formatDate, todayLocal } from "../lib/util";

export default function Imaging() {
  const [tab, setTab] = useState<"oct" | "other" | "documents">("oct");
  const [addOpen, setAddOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Imaging & Documents"
        sub="Keep your scans, photographs and clinical paperwork together. Original files are preserved untouched; you choose what details to record."
      />
      <div className="pill-tabs" role="tablist" aria-label="Imaging sections">
        {(
          [
            ["oct", "OCT vault"],
            ["other", "Fundus & other imaging"],
            ["documents", "Documents"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>
            {label}
          </button>
        ))}
      </div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => setAddOpen(true)}>
          ＋ {tab === "documents" ? "Add document" : "Add imaging"}
        </button>
        {tab === "oct" && <span className="muted">Compare OCTs over time below.</span>}
      </div>

      {tab === "oct" && <ImagingList modality="OCT" compare />}
      {tab === "other" && <ImagingList modality="other" />}
      {tab === "documents" && <DocumentsList />}

      {addOpen && <AddRecordModal isDocument={tab === "documents"} defaultModality={tab === "oct" ? "OCT" : "fundus"} onClose={() => setAddOpen(false)} />}
    </>
  );
}

/* ---------------- thumbnail helper ---------------- */

async function makeThumb(blob: Blob): Promise<string | undefined> {
  if (!blob.type.startsWith("image/")) return undefined;
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 360 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return c.toDataURL("image/jpeg", 0.82);
  } catch {
    return undefined;
  }
}

/* ---------------- imaging list ---------------- */

function ImagingList({ modality, compare }: { modality: "OCT" | "other"; compare?: boolean }) {
  const store = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useMemo(
    () =>
      store.imaging.list
        .filter((i) => (modality === "OCT" ? i.modality === "OCT" : i.modality !== "OCT"))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [store.imaging.list, modality]
  );
  const open = list.find((i) => i.id === openId) ?? null;

  return (
    <>
      {list.length === 0 ? (
        modality === "OCT" ? (
          <EmptyState title="Keep your scans together.">
            Add OCT images to build a chronological imaging history for each eye. Original files
            stay on this device.
          </EmptyState>
        ) : (
          <EmptyState title="Fundus photos, visual fields, corneal imaging — all in one place.">
            Add any ophthalmic imaging you have. Each record keeps its original file and its
            provenance.
          </EmptyState>
        )
      ) : (
        <>
          {compare && <OCTCompare records={list} />}
          <div className="gallery" style={{ marginTop: compare ? 16 : 0 }}>
            {list.map((i) => (
              <button key={i.id} className="gallery-item" onClick={() => setOpenId(i.id)}>
                {i.thumb ? (
                  <img src={i.thumb} alt={`${i.modality} ${formatDate(i.date)}`} />
                ) : (
                  <div className="img-ph" style={{ display: "grid", placeItems: "center", color: "var(--text-3)" }}>
                    {i.modality === "OCT" ? "OCT" : "IMG"}
                  </div>
                )}
                <div className="gallery-meta">
                  <span>{formatDate(i.date)}</span>
                  <EyeBadge eye={i.eye} />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      {open && <ImagingDetail record={open} onClose={() => setOpenId(null)} />}
    </>
  );
}

function OCTCompare({ records }: { records: ImagingRecord[] }) {
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [pos, setPos] = useState(50);
  const [thumbA, setThumbA] = useState<string | undefined>();
  const [thumbB, setThumbB] = useState<string | undefined>();
  const a = records.find((r) => r.id === aId);
  const b = records.find((r) => r.id === bId);

  useEffect(() => {
    let urlA: string | undefined;
    let urlB: string | undefined;
    (async () => {
      if (a?.file_ids[0]) {
        const f = await getStoredFile(a.file_ids[0]);
        if (f?.mime.startsWith("image/")) urlA = storedFileURL(f);
        setThumbA(urlA ?? a.thumb);
      } else setThumbA(undefined);
    })();
    (async () => {
      if (b?.file_ids[0]) {
        const f = await getStoredFile(b.file_ids[0]);
        if (f?.mime.startsWith("image/")) urlB = storedFileURL(f);
        setThumbB(urlB ?? b.thumb);
      } else setThumbB(undefined);
    })();
  }, [aId, bId, a, b]);

  if (records.length < 2) return null;
  return (
    <div className="card">
      <div className="card-title">OCT comparison</div>
      <div className="grid-2">
        <Field label="Earlier scan">
          <select value={aId} onChange={(e) => setAId(e.target.value)} aria-label="Earlier OCT">
            <option value="">Choose…</option>
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {formatDate(r.date)} · {r.eye === "right" ? "OD" : r.eye === "left" ? "OS" : "OU"} {r.clinic ? `· ${r.clinic}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Later scan">
          <select value={bId} onChange={(e) => setBId(e.target.value)} aria-label="Later OCT">
            <option value="">Choose…</option>
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {formatDate(r.date)} · {r.eye === "right" ? "OD" : r.eye === "left" ? "OS" : "OU"} {r.clinic ? `· ${r.clinic}` : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {a && b && (
        <>
          <div className="compare-wrap">
            {thumbB ? <img src={thumbB} alt={`Later OCT ${formatDate(b.date)}`} /> : <div className="img-ph" style={{ padding: 40, textAlign: "center" }}>Later scan file</div>}
            {thumbA && (
              <div className="compare-overlay" style={{ width: `${pos}%` }}>
                <img
                  src={thumbA}
                  alt={`Earlier OCT ${formatDate(a.date)}`}
                  style={{ width: `${(100 / pos) * 100}%`, maxWidth: "none", position: "absolute", inset: 0, height: "100%", objectFit: "cover" }}
                />
              </div>
            )}
          </div>
          <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Comparison slider" style={{ marginTop: 12 }} />
          <div className="muted">
            Left: {formatDate(a.date)} · Right: {formatDate(b.date)}. Clinician interpretation
            takes precedence over any visual comparison.
          </div>
          {(a.clinician_interpretation || b.clinician_interpretation) && (
            <div style={{ marginTop: 10, fontSize: "var(--fs-sm)" }}>
              {a.clinician_interpretation && (
                <p>
                  <strong>{formatDate(a.date)}:</strong> {a.clinician_interpretation}
                </p>
              )}
              {b.clinician_interpretation && (
                <p>
                  <strong>{formatDate(b.date)}:</strong> {b.clinician_interpretation}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ImagingDetail({ record, onClose }: { record: ImagingRecord; onClose: () => void }) {
  const store = useStore();
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let revoked: string[] = [];
    (async () => {
      const out: string[] = [];
      for (const fid of record.file_ids) {
        const f = await getStoredFile(fid);
        if (f) out.push(storedFileURL(f));
      }
      setUrls(out);
      revoked = out;
    })();
    return () => {
      for (const u of revoked) URL.revokeObjectURL(u);
    };
  }, [record]);

  return (
    <Modal title={`${record.modality.toUpperCase()} — ${formatDate(record.date)}`} onClose={onClose} wide>
      <div className="btn-row" style={{ marginBottom: 14 }}>
        <EyeBadge eye={record.eye} />
        <ProvenanceBadge source={record.source_type} />
        <DemoBadge demo={record.demo} />
      </div>
      <dl className="kv">
        <dt>Eye</dt>
        <dd>{record.eye === "right" ? "Right Eye (OD)" : record.eye === "left" ? "Left Eye (OS)" : record.eye === "both" ? "Both Eyes (OU)" : "—"}</dd>
        <dt>Clinic</dt>
        <dd>{record.clinic ?? "Not recorded"}</dd>
        <dt>Device</dt>
        <dd>{record.device ?? "Not recorded"}</dd>
        <dt>Findings</dt>
        <dd>{record.findings ?? "Not recorded"}</dd>
        <dt>Clinician interpretation</dt>
        <dd>{record.clinician_interpretation ?? "Not recorded"}</dd>
        {record.patient_notes && (
          <>
            <dt>Your notes</dt>
            <dd>{record.patient_notes}</dd>
          </>
        )}
      </dl>
      <div style={{ marginTop: 14 }}>
        {urls.map((u) => (
          <img key={u} src={u} alt={`${record.modality}, ${EYE_SHORT[record.eye]}, ${formatDate(record.date)}`} style={{ width: "100%", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", marginBottom: 10 }} />
        ))}
      </div>
      <div className="modal-actions">
        <ConfirmButton
          label="Delete record & files"
          onConfirm={async () => {
            for (const fid of record.file_ids) await dbDelete("files", fid);
            await store.imaging.del(record.id);
            onClose();
          }}
        />
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

/* ---------------- documents ---------------- */

function DocumentsList() {
  const store = useStore();
  const list = useMemo(
    () => [...store.documents.list].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [store.documents.list]
  );
  if (list.length === 0) {
    return (
      <EmptyState title="A vault for your eye-health paperwork.">
        Clinic letters, surgical reports, prescriptions, referrals — keep the originals here, with
        the details you extracted from them clearly marked as yours to correct.
      </EmptyState>
    );
  }
  return (
    <div className="card">
      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Type</th>
              <th>Date</th>
              <th>Eye</th>
              <th>Summary</th>
              <th>Source</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id}>
                <td>
                  <button
                    className="btn subtle"
                    style={{ minHeight: "var(--target)", padding: "2px 6px" }}
                    onClick={async () => {
                      const f = await getStoredFile(d.file_id);
                      if (f) window.open(storedFileURL(f), "_blank");
                    }}
                  >
                    📄 {d.title}
                  </button>
                </td>
                <td>{d.doc_type}</td>
                <td>{formatDate(d.date)}</td>
                <td><EyeBadge eye={d.eye} /></td>
                <td style={{ maxWidth: 280 }}>{d.summary ?? "—"}</td>
                <td><ProvenanceBadge source={d.source_type} /> <DemoBadge demo={d.demo} /></td>
                <td>
                  <ConfirmButton label="Delete" onConfirm={async () => {
                    await dbDelete("files", d.file_id);
                    await store.documents.del(d.id);
                  }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- add modal ---------------- */

function AddRecordModal({
  isDocument,
  defaultModality,
  onClose,
}: {
  isDocument: boolean;
  defaultModality: ImagingModality;
  onClose: () => void;
}) {
  const store = useStore();
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [img, setImg] = useState({
    modality: defaultModality as ImagingModality,
    date: todayLocal(),
    eye: "right" as Eye,
    clinic: "",
    device: "",
    findings: "",
    interpretation: "",
    patient_notes: "",
    source_type: "device_measurement" as SourceType,
    confirmed: false,
  });
  const [doc, setDoc] = useState({
    title: "",
    doc_type: "clinic letter",
    date: todayLocal(),
    eye: "not_applicable" as Eye,
    clinic: "",
    clinician: "",
    summary: "",
    source_type: "document_extracted" as SourceType,
    confirmed: false,
  });

  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
    if (isDocument) {
      if (!doc.title.trim()) return setSaving(false);
      let fileId = "";
      if (files[0]) {
        const sf = await fileToStoredFile(files[0]);
        await saveStoredFile(sf);
        fileId = sf.id;
      }
      const rec: DocumentRecord = newRecord({
        title: doc.title.trim(),
        doc_type: doc.doc_type as DocumentRecord["doc_type"],
        date: doc.date,
        eye: doc.eye,
        file_id: fileId,
        clinic: doc.clinic || undefined,
        clinician: doc.clinician || undefined,
        summary: doc.summary || undefined,
        source_type: doc.source_type,
        confirmed: doc.confirmed,
      });
      await store.documents.put(rec);
    } else {
      if (files.length === 0 && !img.findings.trim()) return setSaving(false);
      const fileIds: string[] = [];
      let thumb: string | undefined;
      for (const f of files) {
        const sf = await fileToStoredFile(f);
        await saveStoredFile(sf);
        fileIds.push(sf.id);
        if (!thumb) thumb = await makeThumb(f);
      }
      const rec: ImagingRecord = newRecord({
        modality: img.modality,
        date: img.date,
        eye: img.eye,
        file_ids: fileIds,
        clinic: img.clinic || undefined,
        device: img.device || undefined,
        findings: img.findings || undefined,
        clinician_interpretation: img.interpretation || undefined,
        patient_notes: img.patient_notes || undefined,
        source_type: img.source_type,
        confirmed: img.confirmed,
        thumb,
      });
      await store.imaging.put(rec);
      }
    } catch (e) {
      // A scan the patient believes is saved but is not would be a silent, serious failure.
      setSaveError(
        e instanceof StorageFullError
          ? "This device does not have enough free space for that file. Nothing was saved. Freeing space, or exporting and removing older scans, will make room."
          : `That could not be saved: ${e instanceof Error ? e.message : "unknown error"}`,
      );
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose();
  };

  return (
    <Modal title={isDocument ? "Add document" : "Add imaging"} onClose={onClose} wide>
      {isDocument ? (
        <>
          <div className="grid-2">
            <Field label="Title"><input type="text" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} /></Field>
            <Field label="Document type">
              <select value={doc.doc_type} onChange={(e) => setDoc({ ...doc, doc_type: e.target.value })}>
                {["clinic letter", "prescription", "scan report", "surgical report", "referral", "discharge note", "medication instructions", "insurance", "other"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Document date"><input type="date" value={doc.date} onChange={(e) => setDoc({ ...doc, date: e.target.value })} /></Field>
            <Field label="Eye">
              <select value={doc.eye} onChange={(e) => setDoc({ ...doc, eye: e.target.value as Eye })}>
                <option value="right">Right Eye (OD)</option>
                <option value="left">Left Eye (OS)</option>
                <option value="both">Both Eyes (OU)</option>
                <option value="not_applicable">Not eye-specific</option>
              </select>
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Clinic"><input type="text" value={doc.clinic} onChange={(e) => setDoc({ ...doc, clinic: e.target.value })} /></Field>
            <Field label="Clinician"><input type="text" value={doc.clinician} onChange={(e) => setDoc({ ...doc, clinician: e.target.value })} /></Field>
          </div>
          <Field label="File (PDF, image or text — original is preserved)"><input type="file" accept=".pdf,image/*,.txt,.doc,.docx" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /></Field>
          <Field label="Summary in your own words"><textarea value={doc.summary} onChange={(e) => setDoc({ ...doc, summary: e.target.value })} /></Field>
          <label className="check-row">
            <input type="checkbox" checked={doc.confirmed} onChange={(e) => setDoc({ ...doc, confirmed: e.target.checked })} />
            I have checked these details against the document
          </label>
          <p className="muted">Details are stored as you entered them — Afterlight never invents clinical facts from files.</p>
        </>
      ) : (
        <>
          <div className="grid-2">
            <Field label="Modality">
              <select value={img.modality} onChange={(e) => setImg({ ...img, modality: e.target.value as ImagingModality })}>
                <option value="OCT">OCT</option>
                <option value="fundus">Fundus photograph</option>
                <option value="visual_field">Visual field test</option>
                <option value="corneal">Corneal imaging</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Date"><input type="date" value={img.date} onChange={(e) => setImg({ ...img, date: e.target.value })} /></Field>
          </div>
          <div className="grid-2">
            <Field label="Eye">
              <select value={img.eye} onChange={(e) => setImg({ ...img, eye: e.target.value as Eye })}>
                <option value="right">Right Eye (OD)</option>
                <option value="left">Left Eye (OS)</option>
                <option value="both">Both Eyes (OU)</option>
              </select>
            </Field>
            <Field label="Clinic"><input type="text" value={img.clinic} onChange={(e) => setImg({ ...img, clinic: e.target.value })} /></Field>
          </div>
          <Field label="Device (optional)"><input type="text" value={img.device} onChange={(e) => setImg({ ...img, device: e.target.value })} placeholder="e.g. Spectralis, Optos…" /></Field>
          <Field label="Image files (original is preserved)">
            <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </Field>
          <Field label="Findings as documented"><textarea value={img.findings} onChange={(e) => setImg({ ...img, findings: e.target.value })} /></Field>
          <Field label="Clinician interpretation"><textarea value={img.interpretation} onChange={(e) => setImg({ ...img, interpretation: e.target.value })} /></Field>
          <Field label="Your notes"><textarea value={img.patient_notes} onChange={(e) => setImg({ ...img, patient_notes: e.target.value })} /></Field>
          <div className="grid-2">
            <Field label="Source"><SourceSelect value={img.source_type} onChange={(s) => setImg({ ...img, source_type: s })} /></Field>
            <label className="check-row" style={{ alignSelf: "end" }}>
              <input type="checkbox" checked={img.confirmed} onChange={(e) => setImg({ ...img, confirmed: e.target.checked })} />
              Details confirmed by me
            </label>
          </div>
        </>
      )}
      {saveError && (
        <p role="alert" className="save-error">
          {saveError}
        </p>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
