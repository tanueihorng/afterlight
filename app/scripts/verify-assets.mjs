#!/usr/bin/env node
// Committed binaries must match the source they claim to come from.
//
// Without this, a baked asset can silently drift from the .blend that produced it, and a year
// later nobody can tell which is right. Runs in CI; Blender does not — this is a hash comparison.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(app, "src/engine/assets");
const manifestPath = join(assetsDir, "manifest.json");
const doc = join(app, "..", "assets-src", "ASSETS.md");

if (!existsSync(assetsDir)) {
  console.log("✓ assets: none committed — the engine is fully procedural");
  process.exit(0);
}

const files = readdirSync(assetsDir).filter((f) => f !== "manifest.json");
if (files.length === 0) {
  console.log("✓ assets: none committed — the engine is fully procedural");
  process.exit(0);
}

if (!existsSync(manifestPath)) {
  console.error("✖ assets exist but there is no manifest.json — they cannot be verified");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const licences = existsSync(doc) ? readFileSync(doc, "utf8") : "";
let failed = false;

for (const file of files) {
  const entry = manifest[file];
  if (!entry) {
    console.error(`✖ ${file} is not in manifest.json`);
    failed = true;
    continue;
  }
  const hash = createHash("sha256").update(readFileSync(join(assetsDir, file))).digest("hex");
  if (hash !== entry.sha256) {
    console.error(`✖ ${file} has drifted from its source (expected ${entry.sha256.slice(0, 16)}…, found ${hash.slice(0, 16)}…)`);
    failed = true;
  }
  if (!licences.includes(file)) {
    console.error(`✖ ${file} has no licence line in assets-src/ASSETS.md`);
    failed = true;
  }
}

for (const name of Object.keys(manifest)) {
  if (!files.includes(name)) {
    console.error(`✖ manifest.json lists ${name}, which is not committed`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`✓ assets: ${files.length} verified against manifest.json and ASSETS.md`);
