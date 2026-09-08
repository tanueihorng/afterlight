import { useEffect, useMemo, useState } from "react";
import { canShareFiles, downloadBytes, shareFile } from "../lib/briefexport";
import { dbGetAll } from "../lib/db";
import type { AllData } from "../lib/db";
import type { BriefPayload, StoredFile } from "../lib/models";
import { orderedItemsForEye } from "../lib/briefpdf";
import type { Entity } from "../lib/query";
import {
  QR_BOUNDARY,
  QR_TEXT_LIMIT,
  SHAREABLE,
  SHARE_LABELS,
  defaultScope,
  generatePassphrase,
  handoffCardText,
  previewShare,
  sealShareBundle,
  shareFilename,
  type ShareScope,
} from "../lib/share";
import { formatBytes } from "../lib/backup";
import { formatDate, nowISO } from "../lib/util";
import { Field, Modal } from "./ui";
import { QrCode } from "./QrCode";

/**
 * Handing part of the record to someone else.
 *
 * The design rule for this screen is that nothing leaves without the person having read what is
 * in it. The counts are computed from the real scope before a file exists, what is left out is
 * listed as plainly as what is included, and the default selection is the narrow one.
 */
export function ShareBrief({
  data,
  payload,
  title,
  onClose,
}: {
  data: AllData;
  payload: BriefPayload;
  title: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"file" | "card">("file");
  const [scope, setScope] = useState<ShareScope>(() =>
    defaultScope(payload.range_start, payload.range_end),
  );
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [passphrase, setPassphrase] = useState(() => generatePassphrase(4));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    dbGetAll<StoredFile>("files")
      .then((rows) => {
        if (!cancelled) setFiles(rows);
      })
      .catch(() => setFiles([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = useMemo(() => previewShare(data, scope, files), [data, scope, files]);

  const included = SHAREABLE.filter((e) => (preview.counts[e] ?? 0) > 0);

  const toggle = (entity: Entity) =>
    setScope((s) => ({ ...s, include: { ...s.include, [entity]: !s.include[entity] } }));

  const produce = async (how: "save" | "share") => {
    setBusy(true);
    setError("");
    setDone("");
    try {
      const sealed = await sealShareBundle(data, scope, files, passphrase, nowISO());
      const text = JSON.stringify(sealed);
      const name = shareFilename(scope);
      if (how === "share") {
        const shared = await shareFile(text, name, "application/json", "Afterlight extract");
        setDone(shared ? `Shared as ${name}.` : "Nothing was shared.");
      } else {
        downloadBytes(text, name, "application/json");
        setDone(`Saved as ${name}.`);
      }
    } catch (e) {
      setError(`That could not be produced: ${e instanceof Error ? e.message : "unknown error"}`);
    }
    setBusy(false);
  };

  const card = useMemo(() => {
    const lines = (eye: "right" | "left") =>
      // Ordered so that what a QR code has to drop is always the least important line, never the
      // new symptom the appointment is about.
      orderedItemsForEye(payload, eye)
        .filter((i) => i.source_type === "patient_reported" || i.source_type === "patient_drawn")
        .map((i) => `${i.bucket.toUpperCase()} ${i.short ?? i.text}`);
    return handoffCardText(
      {
        title,
        range_start: payload.range_start,
        range_end: payload.range_end,
        right: lines("right"),
        left: lines("left"),
        questions: payload.questions,
      },
      QR_TEXT_LIMIT,
    );
  }, [payload, title]);

  return (
    <Modal title="Share part of my record" onClose={onClose} wide>
      <div className="pill-tabs" role="tablist" aria-label="How to share">
        <button
          role="tab"
          aria-selected={tab === "file"}
          className={tab === "file" ? "active" : ""}
          onClick={() => setTab("file")}
        >
          Encrypted file
        </button>
        <button
          role="tab"
          aria-selected={tab === "card"}
          className={tab === "card" ? "active" : ""}
          onClick={() => setTab("card")}
        >
          Show a code in the room
        </button>
      </div>

      {tab === "file" ? (
        <>
          <p className="muted" style={{ marginTop: 12 }}>
            This makes one encrypted file covering the period below. It is not your whole record.
            The person you give it to needs Afterlight and the passphrase to open it.
          </p>

          <div className="grid-2">
            <Field label="From">
              <input
                type="date"
                value={scope.range_start}
                onChange={(e) => setScope({ ...scope, range_start: e.target.value })}
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                value={scope.range_end}
                onChange={(e) => setScope({ ...scope, range_end: e.target.value })}
              />
            </Field>
          </div>

          <fieldset className="share-scope">
            <legend>What to include</legend>
            {SHAREABLE.map((entity) => (
              <div className="check-row" key={entity}>
                <input
                  id={`share-${entity}`}
                  type="checkbox"
                  checked={!!scope.include[entity]}
                  onChange={() => toggle(entity)}
                />
                <label htmlFor={`share-${entity}`}>{SHARE_LABELS[entity] ?? entity}</label>
              </div>
            ))}
            <div className="check-row">
              <input
                id="share-files"
                type="checkbox"
                checked={scope.includeFiles}
                onChange={(e) => setScope({ ...scope, includeFiles: e.target.checked })}
              />
              <label htmlFor="share-files">
                Original scans and documents (
                {preview.fileIds.length ? formatBytes(preview.fileBytes) : "none selected"})
              </label>
            </div>
          </fieldset>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-title">Exactly what this file will contain</div>
            {preview.totalRecords === 0 ? (
              <p className="muted">Nothing is selected, so there is nothing to share.</p>
            ) : (
              <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
                {included.map((entity) => (
                  <li key={entity}>
                    {preview.counts[entity]} × {SHARE_LABELS[entity] ?? entity}
                  </li>
                ))}
                {preview.fileIds.length > 0 && (
                  <li>
                    {preview.fileIds.length} original file
                    {preview.fileIds.length === 1 ? "" : "s"} ({formatBytes(preview.fileBytes)})
                  </li>
                )}
              </ul>
            )}
            <div className="card-title" style={{ marginTop: 10 }}>
              And what it will not
            </div>
            {preview.omitted.length === 0 && preview.danglingFiles === 0 ? (
              <p className="muted">Nothing else falls in this period.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {preview.omitted.map((o) => (
                  <li key={o.entity} className="muted">
                    {o.count} × {o.label}
                  </li>
                ))}
                {preview.danglingFiles > 0 && (
                  <li className="muted">
                    {preview.danglingFiles} original file
                    {preview.danglingFiles === 1 ? "" : "s"} the selected records point at
                  </li>
                )}
              </ul>
            )}
          </div>

          <Field label="Passphrase — say this to them, do not send it with the file">
            <div className="btn-row">
              <input
                type="text"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                style={{ flex: 1, minWidth: 220, fontFamily: "var(--font-mono, monospace)" }}
              />
              <button className="btn subtle" onClick={() => setPassphrase(generatePassphrase(4))}>
                New passphrase
              </button>
            </div>
          </Field>
          <p className="muted">
            The file cannot be opened without it, and Afterlight has no way to recover it. If the
            passphrase is lost, so is the file — which is the point.
          </p>

          {error && (
            <p role="alert" className="save-error">
              {error}
            </p>
          )}
          {done && (
            <p role="status" className="muted">
              {done}
            </p>
          )}

          <div className="modal-actions">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            {canShareFiles() && (
              <button
                className="btn"
                disabled={busy || preview.totalRecords === 0 || !passphrase}
                onClick={() => produce("share")}
              >
                Share…
              </button>
            )}
            <button
              className="btn primary"
              disabled={busy || preview.totalRecords === 0 || !passphrase}
              onClick={() => produce("save")}
            >
              {busy ? "Encrypting…" : "Save encrypted file"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 12 }}>
            A short summary someone can scan off your screen, for {formatDate(payload.range_start)}{" "}
            to {formatDate(payload.range_end)}.
          </p>
          <p className="safety" role="note">
            {QR_BOUNDARY}
          </p>
          {card.fits ? (
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
              <QrCode text={card.text} size={260} label={`QR code containing: ${card.text}`} />
              <div style={{ flex: 1, minWidth: 240 }}>
                <div className="card-title">What the code says</div>
                <pre className="qr-card-text">{card.text}</pre>
                <p className="muted">
                  {card.bytes} of {QR_TEXT_LIMIT} characters.
                  {card.truncated
                    ? " It was shortened to fit, and says so on the code itself."
                    : ""}
                </p>
              </div>
            </div>
          ) : (
            <p role="alert" className="save-error">
              There is too much in this period to fit in a code someone can scan. Use the encrypted
              file instead, or narrow the period.
            </p>
          )}
          <div className="modal-actions">
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
