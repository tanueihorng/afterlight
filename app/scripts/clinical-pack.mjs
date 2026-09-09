#!/usr/bin/env node
// Collect every string a clinician needs to read into one document.
//
// A reviewer should not have to clone a repository. This pulls the safety wording, the boundary
// statements, the condition profiles and the atlas lines out of the source, attaches the question
// each one needs answering, and writes a single file to send.
//
// It reads the source rather than a hand-maintained list, so a string added after this was written
// still turns up.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = resolve(appDir, "..");
const srcDir = join(appDir, "src");

const read = (relPath) => {
  const full = join(srcDir, relPath);
  return existsSync(full) ? readFileSync(full, "utf8") : "";
};

/** Join a run of string literals, as written across several lines with `+`. */
function joinLiterals(source) {
  return [...source.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)]
    .map((m) => (m[1] ?? m[2]).replace(/\\"/g, '"').replace(/\\'/g, "'"))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prose a person would read, pulled out of source.
 *
 * The naive version of this — grep the file for a keyword — returns identifiers and half
 * sentences, which is worse than useless in a document someone is being asked to read carefully.
 * So: take string literals and JSX text nodes only, and keep what reads like a sentence.
 */
function proseFrom(text) {
  const candidates = [];
  for (const match of text.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/g)) {
    candidates.push(match[1] ?? match[2]);
  }
  // JSX text: what sits between tags, with expressions removed.
  for (const match of text.matchAll(/>([^<>{}]{40,})</g)) candidates.push(match[1]);

  const out = new Set();
  for (const raw of candidates) {
    const value = raw.replace(/\s+/g, " ").trim();
    if (value.length < 40) continue;
    if (/[{}();=]|=>|\bconst\b|\bimport\b|_[A-Z]|[A-Z]{3,}_/.test(value)) continue;
    if (!/[a-z]/.test(value)) continue;
    if (value.split(" ").length < 7) continue;
    if (!/[.?!]/.test(value)) continue;
    out.add(value);
  }
  return [...out];
}

/** Pull `export const NAME = "…"` or a concatenated string literal. */
function constant(text, name) {
  const match = text.match(
    new RegExp(`export const ${name}\\s*(?::[^=]+)?=\\s*((?:"[^"]*"|'[^']*'|\\s*\\+\\s*)+)`),
  );
  return match ? joinLiterals(match[1]) : null;
}

const sections = [];

/* ---------- 1. safety ---------- */

const models = read("lib/models.ts");
const ui = read("components/ui.tsx");
const today = read("pages/Today.tsx");

const urgent = models.match(/export const URGENT_SYMPTOMS[^=]*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
const urgentList = [...urgent.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const SAFETY_WORDS = /ophthalmologist|emergency eye|urgent|optometrist|seek .*assessment|A&E/i;
const safetyFiles = {
  "components/ui.tsx": ui,
  "pages/Today.tsx": today,
  "pages/Settings.tsx": read("pages/Settings.tsx"),
  "pages/SelfTests.tsx": read("pages/SelfTests.tsx"),
  "pages/WhatISee.tsx": read("pages/WhatISee.tsx"),
  "components/Atlas.tsx": read("components/Atlas.tsx"),
};
const safetySentences = [];
const seenSafety = new Set();
for (const [where, text] of Object.entries(safetyFiles)) {
  for (const sentence of proseFrom(text)) {
    if (!SAFETY_WORDS.test(sentence) || seenSafety.has(sentence)) continue;
    seenSafety.add(sentence);
    safetySentences.push({ where, text: sentence });
  }
}

sections.push({
  title: "1. Emergency and safety wording",
  intro:
    "The sentences that tell someone to seek urgent care, and the list of symptoms that make them " +
    "appear. Highest priority: a wrong word here either sends someone to hospital unnecessarily " +
    "or, much worse, reassures someone who should have gone.",
  questions: [
    "Is this wording right for a general patient audience?",
    "Is the trigger list complete, and is anything on it that should not be?",
    "Does it appear often enough to matter and rarely enough to still be read?",
  ],
  items: [
    ...safetySentences,
    {
      where: "lib/models.ts → URGENT_SYMPTOMS",
      text: `The symptoms that attach the notice: ${urgentList.join(", ")}.`,
    },
  ],
});

/* ---------- 2. boundary statements ---------- */

const boundaries = [
  ["lib/selftest.ts", "SELF_TEST_BOUNDARY"],
  ["engine/index.ts", "GENERIC_MODEL_BOUNDARY"],
  ["engine/simulate/vision.ts", "SIMULATION_BOUNDARY"],
  ["lib/briefpdf.ts", "PATIENT_GENERATED_FOOTER"],
  ["lib/briefpdf.ts", "HOW_TO_READ"],
  ["lib/share.ts", "QR_BOUNDARY"],
  ["lib/ingest.ts", "OCR_BOUNDARY"],
  ["lib/ingest.ts", "OCR_NOT_INSTALLED"],
];

sections.push({
  title: "2. Boundary statements",
  intro:
    "Each of these is the one sentence standing between a feature and a misunderstanding. They are " +
    "defined once and used everywhere, so a change here changes every screen that carries it.",
  questions: [
    "Does the sentence actually close the misunderstanding it is there to close?",
    "Is it plain enough to be understood by someone anxious and tired?",
    "Does any of it overclaim, or read as reassurance?",
  ],
  items: boundaries
    .map(([file, name]) => ({ where: `${file} → ${name}`, text: constant(read(file), name) }))
    .filter((item) => item.text),
});

/* ---------- 3. condition profiles ---------- */

const conditions = read("lib/conditions.ts");
const profiles = [...conditions.matchAll(/label:\s*"([^"]+)"[\s\S]{0,400}?blurb:\s*"([^"]+)"/g)].map(
  ([, label, blurb]) => ({ where: `lib/conditions.ts → ${label}`, text: blurb }),
);

sections.push({
  title: "3. Condition profiles",
  intro:
    "Thirteen profiles a person may switch on. They reorder the symptom list and offer relevant " +
    "measurements and checks. They never shorten anything, and they are never presented as a " +
    "diagnosis — the wording has to hold that line.",
  questions: [
    "Does any blurb read as telling the person what they have?",
    "Is the description accurate enough to be worth showing at all?",
  ],
  items: profiles,
});

/* ---------- 4. the atlas ---------- */

const conditionFiles = [
  "engine/conditions/anterior.ts",
  "engine/conditions/vitreoretina.ts",
  "engine/conditions/optic.ts",
];
const atlas = [];
for (const file of conditionFiles) {
  const text = read(file);
  // Each entry is `name: "…"` followed, further down the same object, by `experience: "…"`.
  for (const entry of text.matchAll(
    /name:\s*"([^"]+)"[\s\S]*?\n\s*experience:\s*((?:\s*"[^"]*"|\s*\+)+)/g,
  )) {
    atlas.push({ where: `${file} → ${entry[1]}`, text: joinLiterals(entry[2]) });
  }
}

sections.push({
  title: "4. The atlas — “what people notice”",
  intro:
    "One line per condition, describing how the experience is commonly reported. This is the " +
    "sentence a patient will match themselves against, which makes it the highest-consequence " +
    "line in the atlas. The full entries are in docs/atlas-review.md.",
  questions: [
    "Is any of these descriptions wrong, or misleading by omission?",
    "Would any of them cause someone to dismiss something they should report?",
  ],
  items: atlas,
});

/* ---------- 5. home checks ---------- */

const CHECK_FILES = [
  "lib/selftest.ts",
  "pages/SelfTests.tsx",
  "components/tests/AmslerGrid.tsx",
  "components/tests/AcuityCheck.tsx",
  "components/tests/ContrastCheck.tsx",
  "components/tests/ScreenCalibration.tsx",
  "components/tests/TestConditionsForm.tsx",
];
const instructions = [];
const seenInstruction = new Set();
for (const file of CHECK_FILES) {
  for (const sentence of proseFrom(read(file))) {
    if (seenInstruction.has(sentence)) continue;
    seenInstruction.add(sentence);
    instructions.push({ where: file, text: sentence });
  }
}

sections.push({
  title: "5. Home check instructions",
  intro:
    "The Amsler grid, the card-calibrated distance check and the contrast check. A result cannot " +
    "be saved without recording the distance, lighting and correction used, because without them " +
    "it is not comparable with anything — including the person's own previous attempt.",
  questions: [
    "Are the instructions correct, and are they doable unsupervised at home?",
    "Are the recorded conditions the right ones to demand?",
    "Is the framing — a comparison with your own previous attempt, never a measurement of vision — " +
      "held throughout?",
  ],
  items: instructions,
});

/* ---------- render ---------- */

const lines = [
  "# Clinical review pack",
  "",
  "> Generated by `npm run clinical-pack`. Do not edit by hand — edit the source and regenerate.",
  "",
  "Every piece of writing in Afterlight that touches clinical meaning, in one file, with the",
  "question each section needs answering.",
  "",
  "**Context for the reviewer.** Afterlight is a local-first personal eye diary. It stores what a",
  "patient records about their own vision and what they copy from their own clinic letters. It does",
  "not diagnose, does not interpret imaging, does not estimate risk, and has no model in it — every",
  "answer it gives is a query over stored records, cited. The wording below was drafted without",
  "clinical input, which is what this review is for.",
  "",
  "You are not being asked to approve the software. You are being asked whether these sentences are",
  "true, and whether any of them would mislead a patient.",
  "",
  "Return corrections in any form — a marked-up copy, a list, a phone call. Record the outcome in",
  "`docs/clinical-review.md`.",
  "",
  "---",
  "",
];

let count = 0;
for (const section of sections) {
  lines.push(`## ${section.title}`, "");
  lines.push(section.intro, "");
  lines.push("**Questions:**", "");
  for (const question of section.questions) lines.push(`- ${question}`);
  lines.push("");
  if (section.items.length === 0) {
    lines.push("_Nothing found in the source for this section — check the extractor._", "");
    continue;
  }
  for (const item of section.items) {
    count++;
    lines.push(`### ${count}. \`${item.where}\``, "", `> ${item.text}`, "");
  }
}

lines.push("---", "", `${count} strings, generated from source.`, "");

const target = join(repoDir, "docs/clinical-pack.md");
writeFileSync(target, lines.join("\n"));
console.log(`✓ wrote docs/clinical-pack.md — ${count} strings across ${sections.length} sections`);
