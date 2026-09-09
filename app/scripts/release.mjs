#!/usr/bin/env node
// Cut a release.
//
// This script exists to make one rule mechanical rather than aspirational: **no version ships
// while the clinical wording is unreviewed.** A note in a document is a promise; a script that
// refuses to run is a constraint. `docs/clinical-review.md` carries the status, only a human may
// change it, and this reads it.
//
// It does not push and it does not publish. It prepares a tag and tells you the two commands to
// run yourself, because putting this in front of patients is a human decision (AGENTS.md §5).
//
//   node scripts/release.mjs            check everything, change nothing
//   node scripts/release.mjs --tag      also create the git tag locally

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = resolve(appDir, "..");

const problems = [];
const notes = [];

const git = (...args) =>
  execFileSync("git", args, { cwd: repoDir, encoding: "utf8" }).trim();

const run = (command) => {
  execFileSync("npm", ["run", command], { cwd: appDir, stdio: "inherit" });
};

/* ---------------------------------------------------- 1. clinical review */

const review = readFileSync(join(repoDir, "docs/clinical-review.md"), "utf8");
const status = review.match(/\*\*Status:\s*([A-Z ]+)\*\*/)?.[1]?.trim();

if (status !== "REVIEWED") {
  problems.push(
    `The clinical wording has not been reviewed (docs/clinical-review.md says "${status ?? "nothing readable"}").\n` +
      `    Nothing in this app that describes an eye has been read by someone qualified to say\n` +
      `    whether it is right. Send docs/clinical-pack.md (npm run clinical-pack), record the\n` +
      `    outcome, and let a human change that line.`,
  );
}

/* ------------------------------------------------------- 2. the version */

const changelogSource = readFileSync(join(appDir, "src/lib/changelog.ts"), "utf8");
const version = changelogSource.match(/export const VERSION = "([^"]+)"/)?.[1];
const pkg = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"));

if (!version) problems.push("No VERSION in src/lib/changelog.ts.");
if (version && pkg.version !== version) {
  problems.push(`package.json says ${pkg.version}, changelog.ts says ${version}. They must agree.`);
}

if (version && /^0\./.test(version) && status === "REVIEWED") {
  notes.push(
    `Version is still ${version}. With the clinical review recorded, 1.0.0 is now available — see\n` +
      `    the note on VERSION in changelog.ts.`,
  );
}

const entry = changelogSource.includes(`version: "${version}"`);
if (!entry) problems.push(`changelog.ts has no entry for ${version}.`);

const dateless = new RegExp(`version: "${version}"[\\s\\S]{0,200}?summary:`).test(changelogSource)
  && !new RegExp(`version: "${version}",\\s*\\n\\s*date:`).test(changelogSource);
if (dateless) {
  problems.push(
    `The ${version} entry in changelog.ts has no date. Add today's date — an entry with no date\n` +
      `    means "not released yet", which is exactly what this command is trying to change.`,
  );
}

/* ------------------------------------------------------ 3. the worktree */

if (git("status", "--porcelain")) {
  problems.push("The working tree is dirty. Commit or stash first.");
}

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "main") notes.push(`On branch ${branch}, not main.`);

const tag = `v${version}`;
const existing = git("tag", "--list", tag);
if (existing) problems.push(`Tag ${tag} already exists.`);

/* ------------------------------------------------------------ 4. report */

if (problems.length > 0) {
  console.error(`\n✖ not ready to release${version ? ` ${version}` : ""}:\n`);
  for (const problem of problems) console.error(`  - ${problem}\n`);
  process.exit(1);
}

console.log(`\nReleasing ${version}. Running the full gate first.\n`);
run("verify");
run("changelog:check");

for (const note of notes) console.log(`\n  note: ${note}`);

if (process.argv.includes("--tag")) {
  const summary = changelogSource
    .match(new RegExp(`version: "${version}"[\\s\\S]*?summary:\\s*"([^"]+)"`))?.[1];
  git("tag", "-a", tag, "-m", `${tag} — ${summary ?? "release"}`);
  console.log(`\n✓ tagged ${tag} locally.`);
} else {
  console.log(`\n✓ ${version} is ready. Re-run with --tag to create the tag.`);
}

console.log(
  `\nPublishing is yours to do:\n` +
    `  git push origin main --follow-tags\n` +
    `  gh workflow run pages.yml\n` +
    `\nThis script will not do either. Putting a health tool in front of patients is a decision,\n` +
    `not a build step.\n`,
);
