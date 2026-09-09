#!/usr/bin/env node
// Assemble what gets published: the landing page, with the built app inside it at /app/.
//
// The app uses relative asset paths and a hash router, so it works from any sub-path without a
// build-time base URL. That keeps the hosted build and the offline single-folder copy identical,
// which is one fewer thing that can differ between what is tested and what ships.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = resolve(appDir, "..");
const dist = join(appDir, "dist");
const target = join(repoDir, "site/app");

if (!existsSync(dist)) {
  console.error("✖ app/dist is missing — run `npm run build` first");
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(dist, target, { recursive: true });

// The explorer is a single self-contained file that also works from a filesystem; publish it too.
for (const file of ["EyeExplorer.html", "EyeExplorer-engine.html"]) {
  const from = join(repoDir, file);
  if (existsSync(from)) cpSync(from, join(repoDir, "site", file));
}

console.log(`✓ site assembled: ${readdirSync(target).length} entries in site/app/`);
