import { describe, expect, it } from "vitest";
import {
  aDailyLog,
  aDiagnosis,
  aDocument,
  aDrawing,
  aMeasurement,
  aQuestion,
  aSymptom,
  anAllData,
  anImaging,
} from "../test/factories";
import { WrongPassphrase, decryptArchive, inspectArchive } from "./archive";
import type { StoredFile } from "./models";
import {
  PASSPHRASE_WORDLIST_SIZE,
  QR_BOUNDARY,
  buildShareBundle,
  defaultScope,
  generatePassphrase,
  handoffCardText,
  previewShare,
  sealShareBundle,
  selectForShare,
  shareFilename,
} from "./share";

const AT = "2026-09-09T09:00:00.000Z";

function bytes(n: number): ArrayBuffer {
  return new Uint8Array(n).fill(7).buffer;
}

const storedFile = (id: string, size = 1024): StoredFile => ({
  id,
  name: `${id}.jpg`,
  mime: "image/jpeg",
  bytes: bytes(size),
  size,
  stored_at: "2026-08-01T09:00:00.000Z",
});

function record() {
  return anAllData({
    symptoms: [
      aSymptom({ id: "s-in", date_time: "2026-09-02T09:00:00" }),
      aSymptom({ id: "s-before", date_time: "2026-05-02T09:00:00" }),
      aSymptom({ id: "s-after", date_time: "2026-12-02T09:00:00" }),
    ],
    dailyLogs: [aDailyLog({ id: "2026-09-01", date: "2026-09-01" })],
    drawings: [aDrawing({ id: "d-in", date_time: "2026-09-03T09:00:00" })],
    questions: [aQuestion({ id: "q-old", created_at: "2025-01-01T09:00:00" })],
    diagnoses: [aDiagnosis({ id: "dx", first_documented: "2026-09-04" })],
    measurements: [aMeasurement({ id: "m-in", date: "2026-09-05" })],
    imaging: [anImaging({ id: "img", date: "2026-09-06", file_ids: ["f1"], thumb_file_id: "f2" })],
    documents: [aDocument({ id: "doc", date: "2026-09-07", file_id: "f3" })],
  });
}

const SEPT = { start: "2026-09-01", end: "2026-09-30" };

describe("share scope", () => {
  it("defaults to the patient's own entries and nothing else", () => {
    const scope = defaultScope(SEPT.start, SEPT.end);
    expect(scope.include).toEqual({
      symptoms: true,
      dailyLogs: true,
      drawings: true,
      questions: true,
    });
    expect(scope.includeFiles).toBe(false);
    // Nothing that identifies a clinic, a diagnosis or a scan goes out unless it is chosen.
    expect(scope.include.diagnoses).toBeUndefined();
    expect(scope.include.imaging).toBeUndefined();
    expect(scope.include.documents).toBeUndefined();
  });

  it("carries only records inside the range", () => {
    const selected = selectForShare(record(), defaultScope(SEPT.start, SEPT.end));
    expect((selected.symptoms as { id: string }[]).map((s) => s.id)).toEqual(["s-in"]);
  });

  it("keeps questions and baselines outside the range, and says so in the preview", () => {
    // A question carried for eight months is the thing the patient came to ask.
    const selected = selectForShare(record(), defaultScope(SEPT.start, SEPT.end));
    expect((selected.questions as { id: string }[]).map((q) => q.id)).toEqual(["q-old"]);
  });

  it("names what was left out, with counts", () => {
    const preview = previewShare(record(), defaultScope(SEPT.start, SEPT.end));
    const labels = Object.fromEntries(preview.omitted.map((o) => [o.entity, o.count]));
    expect(labels.diagnoses).toBe(1);
    expect(labels.imaging).toBe(1);
    expect(labels.documents).toBe(1);
    expect(labels.measurements).toBe(1);
    expect(preview.omitted.every((o) => o.label.length > 0)).toBe(true);
  });

  it("counts exactly what will be sent", () => {
    const preview = previewShare(record(), defaultScope(SEPT.start, SEPT.end));
    expect(preview.counts).toMatchObject({ symptoms: 1, dailyLogs: 1, drawings: 1, questions: 1 });
    expect(preview.totalRecords).toBe(4);
  });

  it("leaves original scans out by default and reports the references it did not send", () => {
    const scope = { ...defaultScope(SEPT.start, SEPT.end), include: { imaging: true } };
    const files = [storedFile("f1"), storedFile("f2"), storedFile("f3")];
    const preview = previewShare(record(), scope, files);
    expect(preview.fileIds).toEqual([]);
    expect(preview.fileBytes).toBe(0);
    expect(preview.danglingFiles).toBe(2); // the scan and its thumbnail
  });

  it("sends only the files the selected records point at", () => {
    const scope = {
      ...defaultScope(SEPT.start, SEPT.end),
      include: { imaging: true },
      includeFiles: true,
    };
    const files = [storedFile("f1"), storedFile("f2"), storedFile("f3")];
    const preview = previewShare(record(), scope, files);
    // f3 belongs to the document, which was not selected.
    expect(preview.fileIds.sort()).toEqual(["f1", "f2"]);
    expect(preview.fileBytes).toBe(2048);
  });
});

describe("share bundle", () => {
  it("is an archive the ordinary importer accepts, and says it is an extract", async () => {
    const bundle = await buildShareBundle(record(), defaultScope(SEPT.start, SEPT.end), [], AT);
    const summary = await inspectArchive(bundle);
    expect(summary.valid).toBe(true);
    expect(summary.checksumOk).toBe(true);
    expect(summary.totalRecords).toBe(4);
    expect(summary.share?.range_start).toBe("2026-09-01");
    expect(summary.share?.omitted).toContain("Diagnoses");
    expect(summary.share?.files_omitted).toBe(true);
    expect(summary.share?.note).toMatch(/not the whole record/i);
  });

  it("carries no preferences, no demo flag and no meta from the sender", async () => {
    const bundle = await buildShareBundle(record(), defaultScope(SEPT.start, SEPT.end), [], AT);
    expect(bundle.meta).toBeNull();
  });

  it("contains nothing from outside the range, anywhere in the file", async () => {
    const bundle = await buildShareBundle(record(), defaultScope(SEPT.start, SEPT.end), [], AT);
    const text = JSON.stringify(bundle);
    expect(text).toContain("s-in");
    expect(text).not.toContain("s-before");
    expect(text).not.toContain("s-after");
    expect(text).not.toContain("2026-05-02");
  });

  it("encrypts, and the ciphertext holds no plaintext", async () => {
    const sealed = await sealShareBundle(
      record(),
      defaultScope(SEPT.start, SEPT.end),
      [],
      "harbour-lantern-quiet-seven",
      AT,
    );
    expect(sealed.encrypted).toBe(true);
    expect(sealed.encryption.iterations).toBe(250_000);
    const text = JSON.stringify(sealed);
    expect(text).not.toContain("s-in");
    expect(text).not.toContain("floaters");
  });

  it("opens with the passphrase and refuses without it", async () => {
    const sealed = await sealShareBundle(
      record(),
      defaultScope(SEPT.start, SEPT.end),
      [],
      "harbour-lantern-quiet-seven",
      AT,
    );
    const opened = await decryptArchive(sealed, "harbour-lantern-quiet-seven");
    expect((opened.data.symptoms as { id: string }[])[0].id).toBe("s-in");
    await expect(decryptArchive(sealed, "harbour-lantern-quiet-eight")).rejects.toThrow(
      WrongPassphrase,
    );
  });

  it("names the file by its range, so two shares are never confused", () => {
    expect(shareFilename(defaultScope("2026-09-01", "2026-09-30"))).toBe(
      "afterlight-share-2026-09-01-to-2026-09-30.afterlight",
    );
  });
});

describe("passphrase", () => {
  it("is different every time and made of speakable words", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generatePassphrase(4)));
    expect(seen.size).toBeGreaterThan(45);
    for (const phrase of seen) {
      expect(phrase.split("-")).toHaveLength(4);
      expect(phrase).toMatch(/^[a-z-]+$/);
    }
  });

  it("draws from a wordlist large enough to matter", () => {
    expect(PASSPHRASE_WORDLIST_SIZE).toBeGreaterThanOrEqual(100);
  });
});

describe("QR handoff card", () => {
  const parts = {
    title: "9 September 2026 · Retina follow-up",
    range_start: "2026-08-26",
    range_end: "2026-09-09",
    right: ["UNCHANGED floaters, usual strand and dots (6 Sep)"],
    left: [
      "NEW small dark dot, slightly right of centre (4 Sep)",
      "MORE THAN USUAL glare around headlights (7 Sep)",
    ],
    questions: ["Is this new floater anything to be concerned about?"],
  };

  it("says plainly that it is not encrypted", () => {
    expect(QR_BOUNDARY).toMatch(/not encrypted/i);
  });

  it("fits the limit it is given", () => {
    const card = handoffCardText(parts, 600);
    expect(new TextEncoder().encode(card.text).length).toBeLessThanOrEqual(600);
    expect(card.truncated).toBe(false);
    expect(card.text).toContain("NEW small dark dot");
    expect(card.text).toContain("QUESTIONS");
  });

  it("shortens rather than overflowing, and admits it did", () => {
    const card = handoffCardText(parts, 340);
    expect(card.bytes).toBeLessThanOrEqual(340);
    expect(card.fits).toBe(true);
    expect(card.truncated).toBe(true);
    expect(card.text).toMatch(/Shortened to fit/);
    // The first line of each eye survives; the questions are what went.
    expect(card.text).toContain("NEW small dark dot");
    expect(card.text).toContain("UNCHANGED floaters");
  });

  it("never cuts off its own boundary line to fit", () => {
    // A card that lost its "not a clinical record" line because it ran out of room would be
    // worse than no card at all, so an impossible limit is reported rather than obeyed.
    const card = handoffCardText(parts, 80);
    expect(card.fits).toBe(false);
    expect(card.text).toContain("Not a clinical record");
    for (const limit of [80, 200, 340, 900]) {
      expect(handoffCardText(parts, limit).text).toContain("Not a clinical record");
      expect(handoffCardText(parts, limit).text).toContain("AFTERLIGHT");
    }
  });

  it("drops the least important line first, never the new one", () => {
    // The card exists to say what changed. Trimming by position would drop whatever happened to
    // be last; the caller orders by bucket so the cut always falls on the unchanged lines.
    const many = {
      ...parts,
      left: [
        "NEW small dark dot, slightly right of centre (4 Sep)",
        "UNCHANGED blur in the lower half of vision (2 Sep)",
        "UNCHANGED evening haloes around headlights (1 Sep)",
        "UNCHANGED dryness on waking (31 Aug)",
      ],
    };
    const card = handoffCardText(many, 400);
    expect(card.truncated).toBe(true);
    expect(card.bytes).toBeLessThanOrEqual(400);
    expect(card.text).toContain("NEW small dark dot");
    expect(card.text).not.toContain("dryness on waking");
    // The question the patient came to ask outlives the unchanged lines.
    expect(card.text).toContain("QUESTIONS");

    // Squeezed harder, the questions go too — but only after every unchanged line has.
    const tighter = handoffCardText(many, 330);
    expect(tighter.text).toContain("NEW small dark dot");
    expect(tighter.text).not.toContain("QUESTIONS");
  });

  it("says an eye is empty rather than leaving it blank", () => {
    const card = handoffCardText({ ...parts, right: [] }, 600);
    expect(card.text).toContain("RIGHT (OD)\n- nothing recorded");
  });
});
