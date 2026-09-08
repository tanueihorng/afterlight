import { useCallback, useMemo, useState } from "react";
import { StorageFullError, fileToStoredFile, saveStoredFile } from "../lib/db";
import {
  OCR_BOUNDARY,
  OCR_NOT_INSTALLED,
  PERSON_CONFIRMED,
  extractFromDocument,
  guessFromFilename,
  readDicom,
  readPdfInfo,
  recogniserName,
  type DicomInfo,
} from "../lib/ingest";
import type {
  DocumentRecord,
  DocumentType,
  Eye,
  ImagingModality,
  ImagingRecord,
  StoredFile,
} from "../lib/models";
import { newRecord, useStore } from "../lib/store";
import { storeThumbnailFor } from "../lib/thumbs";
import { formatBytes } from "../lib/backup";
import { todayLocal } from "../lib/util";
import { Field, Modal } from "./ui";

type Kind = "imaging" | "document" | "skip";

interface Row {
  key: string;
  file: File;
  bytes: ArrayBuffer;
  kind: Kind;
  date: string;
  /** Both readings when the filename's date is ambiguous; the person picks. */
  dateChoices?: [string, string];
  eye: Eye;
  modality: ImagingModality;
  docType: DocumentType;
  title: string;
  clinic: string;
  notes: string[];
  dicom?: DicomInfo;
  pages?: number;
  extractedText?: string;
  /** True once the person has said the details are right. Never set by the app. */
  confirmed: boolean;
}

const DOC_TYPES: DocumentType[] = [
  "clinic letter",
  "prescription",
  "scan report",
  "surgical report",
  "referral",
  "discharge note",
  "medication instructions",
  "insurance",
  "other",
];

function isImageLike(file: File): boolean {
  return file.type.startsWith("image/");
}

function looksLikeDicom(file: File, bytes: ArrayBuffer): boolean {
  if (/\.dcm$/i.test(file.name) || file.type === "application/dicom") return true;
  const view = new Uint8Array(bytes);
  return (
    view.length > 132 && String.fromCharCode(view[128], view[129], view[130], view[131]) === "DICM"
  );
}

async function toRow(file: File): Promise<Row> {
  const bytes = await file.arrayBuffer();
  const guess = guessFromFilename(file.name);
  const notes = [...guess.notes];

  let dicom: DicomInfo | undefined;
  let pages: number | undefined;

  if (looksLikeDicom(file, bytes)) {
    dicom = readDicom(bytes);
    if (dicom.reason) notes.push(dicom.reason);
    if (dicom.ok && dicom.studyDate)
      notes.push(`Study date read from the file: ${dicom.studyDate}.`);
  } else if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const info = readPdfInfo(new Uint8Array(bytes));
    pages = info.pages;
    if (info.opaque) {
      notes.push("This PDF's structure is compressed, so its page count could not be read.");
    } else if (info.pages) {
      notes.push(`${info.pages} page${info.pages === 1 ? "" : "s"}.`);
    }
  }

  const kind: Kind = dicom || isImageLike(file) || guess.modality ? "imaging" : "document";

  return {
    key: `${file.name}-${file.size}-${file.lastModified}`,
    file,
    bytes,
    kind,
    // Nothing is dated silently: a filename date, then a DICOM study date, then today, and the
    // notes say which one it was.
    date: dicom?.studyDate ?? guess.date ?? todayLocal(),
    dateChoices: guess.ambiguousDates,
    eye: dicom?.laterality ?? guess.eye ?? "not_applicable",
    modality: guess.modality ?? (dicom?.modality === "OPT" ? "OCT" : "other"),
    docType: guess.docType ?? "clinic letter",
    title: file.name.replace(/\.[a-z0-9]+$/i, ""),
    clinic: dicom?.institution ?? "",
    notes,
    dicom,
    pages,
    confirmed: false,
  };
}

/**
 * Bringing a stack of clinic paperwork in at once.
 *
 * Ten files is the realistic case — a discharge pack, a folder of OCTs — and typing ten dates is
 * why people stop keeping a record. So the filename, the PDF header and the DICOM tags are read
 * for suggestions, and every one of them is shown as an editable field with a note saying where
 * it came from. Nothing is stored as confirmed until the person ticks the box.
 */
export function IngestFiles({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [dragging, setDragging] = useState(false);
  const ocr = recogniserName();

  const add = useCallback(async (files: FileList | File[]) => {
    const next = await Promise.all(Array.from(files).map(toRow));
    setRows((current) => {
      const known = new Set(current.map((r) => r.key));
      return [...current, ...next.filter((r) => !known.has(r.key))];
    });
  }, []);

  const update = (key: string, patch: Partial<Row>) =>
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const applyToAll = (patch: Partial<Row>) =>
    setRows((current) => current.map((r) => ({ ...r, ...patch })));

  const toSave = useMemo(() => rows.filter((r) => r.kind !== "skip"), [rows]);
  const unconfirmed = toSave.filter((r) => !r.confirmed).length;

  const saveAll = async () => {
    setBusy(true);
    setError("");
    let done = 0;
    try {
      for (const row of toSave) {
        setProgress(`Saving ${++done} of ${toSave.length}…`);
        const stored = await fileToStoredFile(row.file);
        await saveStoredFile(stored);

        // A DICOM file is kept exactly as the clinic produced it. When a displayable image was
        // found inside, it is stored alongside as a separate file rather than replacing it.
        let displayFileId: string | undefined;
        if (row.dicom?.image) {
          const extracted: StoredFile = {
            id: crypto.randomUUID(),
            name: `${row.file.name}.jpg`,
            mime: row.dicom.image.mime,
            bytes: row.dicom.image.bytes.slice().buffer,
            size: row.dicom.image.bytes.byteLength,
            stored_at: new Date().toISOString(),
          };
          await saveStoredFile(extracted);
          displayFileId = extracted.id;
        }

        if (row.kind === "imaging") {
          const forThumb = displayFileId
            ? {
                ...stored,
                id: displayFileId,
                mime: row.dicom!.image!.mime,
                bytes: row.dicom!.image!.bytes.slice().buffer,
              }
            : stored;
          const thumbFileId = await storeThumbnailFor(forThumb);
          const record: ImagingRecord = newRecord({
            modality: row.modality,
            date: row.date,
            eye: row.eye,
            file_ids: displayFileId ? [displayFileId, stored.id] : [stored.id],
            clinic: row.clinic || undefined,
            device: row.dicom?.modality ? `DICOM ${row.dicom.modality}` : undefined,
            findings: row.dicom?.seriesDescription || undefined,
            source_type: "document_extracted",
            confirmed: row.confirmed,
            thumb_file_id: thumbFileId,
          });
          await store.imaging.put(record);
        } else {
          const record: DocumentRecord = newRecord({
            title: row.title.trim() || row.file.name,
            doc_type: row.docType,
            date: row.date,
            eye: row.eye,
            file_id: stored.id,
            clinic: row.clinic || undefined,
            summary: row.extractedText ? row.extractedText.slice(0, 400) : undefined,
            source_type: "document_extracted",
            confirmed: row.confirmed,
          });
          await store.documents.put(record);
        }
      }
      setProgress("");
      onClose();
    } catch (e) {
      setError(
        e instanceof StorageFullError
          ? "This device does not have enough free space. Nothing further was saved; the files already added are safe."
          : `That could not be saved: ${e instanceof Error ? e.message : "unknown error"}`,
      );
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <Modal title="Add several files" onClose={onClose} wide>
      <div
        className={`dropzone ${dragging ? "over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void add(e.dataTransfer.files);
        }}
      >
        <p style={{ margin: "0 0 10px" }}>Drop scans, photographs, PDFs or DICOM files here.</p>
        <Field label="Or choose files">
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.dcm,application/dicom,.txt"
            onChange={(e) => {
              if (e.target.files) void add(e.target.files);
            }}
          />
        </Field>
      </div>

      {rows.length > 0 && (
        <>
          <div className="btn-row" style={{ margin: "14px 0" }}>
            <span className="muted">Apply to all:</span>
            <button className="btn subtle" onClick={() => applyToAll({ eye: "right" })}>
              Right eye
            </button>
            <button className="btn subtle" onClick={() => applyToAll({ eye: "left" })}>
              Left eye
            </button>
            <button className="btn subtle" onClick={() => applyToAll({ eye: "both" })}>
              Both eyes
            </button>
            <button
              className="btn subtle"
              onClick={() => applyToAll({ confirmed: PERSON_CONFIRMED })}
            >
              I have checked all of these
            </button>
            <button className="btn subtle" onClick={() => setRows([])}>
              Clear list
            </button>
          </div>

          {rows.map((row) => (
            <div className="ingest-row" key={row.key}>
              <div className="ingest-head">
                <strong>{row.file.name}</strong>
                <span className="muted">{formatBytes(row.file.size)}</span>
                {row.dicom?.ok && <span className="badge">DICOM read</span>}
                {row.dicom && !row.dicom.ok && <span className="badge">Stored as-is</span>}
                {row.pages ? <span className="badge">{row.pages} pages</span> : null}
              </div>

              <div className="grid-2">
                <Field label="Add as">
                  <select
                    value={row.kind}
                    onChange={(e) => update(row.key, { kind: e.target.value as Kind })}
                  >
                    <option value="imaging">Imaging</option>
                    <option value="document">Document</option>
                    <option value="skip">Do not add this file</option>
                  </select>
                </Field>
                <Field label="Date">
                  {row.dateChoices ? (
                    <select
                      value={row.date}
                      onChange={(e) => update(row.key, { date: e.target.value })}
                    >
                      <option value={row.dateChoices[0]}>{row.dateChoices[0]} (day first)</option>
                      <option value={row.dateChoices[1]}>{row.dateChoices[1]} (month first)</option>
                      <option value={todayLocal()}>{todayLocal()} (today)</option>
                    </select>
                  ) : (
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => update(row.key, { date: e.target.value })}
                    />
                  )}
                </Field>
              </div>

              <div className="grid-2">
                <Field label="Eye">
                  <select
                    value={row.eye}
                    onChange={(e) => update(row.key, { eye: e.target.value as Eye })}
                  >
                    <option value="right">Right Eye (OD)</option>
                    <option value="left">Left Eye (OS)</option>
                    <option value="both">Both Eyes (OU)</option>
                    <option value="not_applicable">Not eye-specific</option>
                  </select>
                </Field>
                {row.kind === "imaging" ? (
                  <Field label="Modality">
                    <select
                      value={row.modality}
                      onChange={(e) =>
                        update(row.key, { modality: e.target.value as ImagingModality })
                      }
                    >
                      <option value="OCT">OCT</option>
                      <option value="fundus">Fundus photograph</option>
                      <option value="visual_field">Visual field test</option>
                      <option value="corneal">Corneal imaging</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                ) : (
                  <Field label="Document type">
                    <select
                      value={row.docType}
                      onChange={(e) => update(row.key, { docType: e.target.value as DocumentType })}
                    >
                      {DOC_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              <div className="grid-2">
                {row.kind === "document" && (
                  <Field label="Title">
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) => update(row.key, { title: e.target.value })}
                    />
                  </Field>
                )}
                <Field label="Clinic">
                  <input
                    type="text"
                    value={row.clinic}
                    onChange={(e) => update(row.key, { clinic: e.target.value })}
                  />
                </Field>
              </div>

              {row.notes.length > 0 && (
                <ul className="ingest-notes">
                  {row.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              )}

              <div className="btn-row">
                {ocr ? (
                  <button
                    className="btn subtle"
                    onClick={async () => {
                      const result = await extractFromDocument(row.bytes, row.file.type);
                      update(row.key, {
                        extractedText: result.text,
                        clinic: row.clinic || result.suggestions.clinic || "",
                        notes: [...row.notes, ...result.suggestions.notes, OCR_BOUNDARY],
                        confirmed: false,
                      });
                    }}
                  >
                    Read the text ({ocr})
                  </button>
                ) : null}
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={row.confirmed}
                    onChange={(e) => update(row.key, { confirmed: e.target.checked })}
                  />
                  I have checked these details against the file
                </label>
              </div>
            </div>
          ))}
        </>
      )}

      {!ocr && rows.length > 0 && <p className="muted">{OCR_NOT_INSTALLED}</p>}

      {rows.length > 0 && unconfirmed > 0 && (
        <p className="muted">
          {unconfirmed} of {toSave.length} still unchecked. They will be saved and shown as
          unconfirmed, and stay out of your appointment brief until you confirm them.
        </p>
      )}

      {error && (
        <p role="alert" className="save-error">
          {error}
        </p>
      )}

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={busy || toSave.length === 0} onClick={saveAll}>
          {progress || `Add ${toSave.length} file${toSave.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </Modal>
  );
}
