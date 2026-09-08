#!/usr/bin/env node
// Emit the single-file offline explorer.
//
// A clinic PC with no internet is a real use case, and the current EyeExplorer.html has that
// property. This keeps it: one HTML file, everything inlined, opens from a USB stick.

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(app, "dist-standalone");
const BUDGET_MB = 5;

execFileSync(
  "npx",
  [
    "vite",
    "build",
    "--config",
    "vite.standalone.config.ts",
  ],
  { cwd: app, stdio: "inherit" },
);

const htmlPath = join(out, "index.html");
if (!existsSync(htmlPath)) {
  console.error("build-standalone: no index.html was produced");
  process.exit(1);
}

// Inline every asset the built page references, so nothing is loaded from anywhere.
let html = readFileSync(htmlPath, "utf8");

html = html.replace(
  /<script[^>]*src="([^"]+)"[^>]*><\/script>/g,
  (_match, src) => `<script type="module">${readFileSync(join(out, src.replace(/^\//, "")), "utf8")}</script>`,
);
html = html.replace(
  /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  (_match, href) => `<style>${readFileSync(join(out, href.replace(/^\//, "")), "utf8")}</style>`,
);
writeFileSync(htmlPath, html);

const sizeMb = statSync(htmlPath).size / (1024 * 1024);
console.log(`standalone file: ${sizeMb.toFixed(2)} MB of a ${BUDGET_MB} MB budget`);
// Everything must be inlined: a single external reference means it does not work from a stick.
const external = [...html.matchAll(/(?:src|href)="(?!data:)([^"]+)"/g)].map((m) => m[1]);
if (external.length > 0) {
  console.error(`build-standalone: ${external.length} external reference(s) remain:`, external);
  process.exit(1);
}

if (sizeMb > BUDGET_MB) {
  console.error(`build-standalone: ${sizeMb.toFixed(2)} MB exceeds the ${BUDGET_MB} MB budget`);
  process.exit(1);
}

// Emitted alongside the original rather than over it. EyeExplorer.html still carries the disease
// scenarios and the diagnose flow that this engine does not have yet; it is replaced only when
// Phase 07 reaches parity, and that is a deliberate decision for a human to make.
writeFileSync(join(app, "..", "EyeExplorer-engine.html"), html);
rmSync(out, { recursive: true, force: true });
console.log("✓ EyeExplorer-engine.html written, fully self-contained");
console.log("  The original EyeExplorer.html is untouched until the engine reaches parity.");
