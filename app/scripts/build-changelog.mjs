#!/usr/bin/env node
// CHANGELOG.md is generated from app/src/lib/changelog.ts.
//
// Two copies of the same list drift, and the one that drifts is always the one the user reads.
// The app shows the TypeScript list; this writes the markdown from it. `--check` fails the build
// when they disagree, so the file in the repo is never stale.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = resolve(appDir, "..");
const source = join(appDir, "src/lib/changelog.ts");
const target = join(repoDir, "CHANGELOG.md");

/**
 * Read the list without a TypeScript toolchain: strip the types and evaluate the two exports.
 * Cheap, and it keeps this script runnable with plain node in CI.
 */
function readChangelog() {
  const text = readFileSync(source, "utf8");
  const version = text.match(/export const VERSION = "([^"]+)"/)?.[1];
  const body = text.match(/export const CHANGELOG: Release\[\] = (\[[\s\S]*?\n\]);/)?.[1];
  if (!version || !body) throw new Error("could not read VERSION / CHANGELOG from changelog.ts");
  const releases = new Function(`return ${body}`)();
  return { version, releases };
}

const { version, releases } = readChangelog();

const lines = [
  "# Changelog",
  "",
  "What changed, written for the person using it rather than for whoever wrote it.",
  "",
  "This file is generated from `app/src/lib/changelog.ts`, which is the same list the app shows in",
  "Settings. Edit that file, then run `npm run changelog`.",
  "",
  "Versions follow [semantic versioning](https://semver.org). The number stays below 1.0.0 until",
  "the clinical wording has been reviewed by a qualified clinician — see `docs/clinical-review.md`.",
  "",
];

for (const release of releases) {
  lines.push(`## ${release.version}${release.date ? ` — ${release.date}` : " — unreleased"}`);
  lines.push("");
  lines.push(`**${release.summary}**`);
  lines.push("");
  for (const change of release.changes) lines.push(`- ${change}`);
  if (release.notes?.length) {
    lines.push("");
    for (const note of release.notes) lines.push(`> ${note}`);
  }
  lines.push("");
}

lines.push("---", "", `Current version: **${version}**`, "");

const rendered = lines.join("\n");

if (process.argv.includes("--check")) {
  let existing = "";
  try {
    existing = readFileSync(target, "utf8");
  } catch {
    console.error("✖ CHANGELOG.md is missing — run `npm run changelog`");
    process.exit(1);
  }
  if (existing !== rendered) {
    console.error("✖ CHANGELOG.md is out of date — run `npm run changelog`");
    process.exit(1);
  }
  console.log(`✓ CHANGELOG.md matches changelog.ts (${releases.length} releases, at ${version})`);
} else {
  writeFileSync(target, rendered);
  console.log(`✓ wrote CHANGELOG.md (${releases.length} releases, at ${version})`);
}
