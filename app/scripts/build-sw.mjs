#!/usr/bin/env node
// Inject the built asset list into the service worker.
//
// Caching on first fetch is not enough: the worker activates after the first page has already
// loaded, so nothing from that visit is cached and the next load offline fails. Precaching the
// real, content-hashed filenames is what makes "open it on a train" actually work.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(app, "dist");

const assets = readdirSync(join(dist, "assets"))
  .filter((f) => f.endsWith(".js") || f.endsWith(".css"))
  .map((f) => `./assets/${f}`);

const shell = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", ...assets];

const source = readFileSync(join(dist, "sw.js"), "utf8");
const version = createHash("sha256").update(shell.join("|")).digest("hex").slice(0, 12);

const built = source
  .replace(/const VERSION = "[^"]*";/, `const VERSION = "afterlight-${version}";`)
  .replace(/const SHELL = \[[^\]]*\];/, `const SHELL = ${JSON.stringify(shell)};`);

if (built === source) {
  console.error("build-sw: could not inject the asset list — the markers in sw.js changed");
  process.exit(1);
}

writeFileSync(join(dist, "sw.js"), built);
console.log(`✓ service worker precaches ${shell.length} files (version ${version})`);
