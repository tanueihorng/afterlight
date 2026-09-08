#!/usr/bin/env node
// The daily loop must stay fast on a phone. This fails the build if the initial download grows.

import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const BUDGET_KB = 120; // initial JS, gzipped
const CSS_BUDGET_KB = 20;

function gzipKB(path) {
  return gzipSync(readFileSync(path)).length / 1024;
}

const html = readFileSync(join(dist, "index.html"), "utf8");
const entry = [...html.matchAll(/src="\.?\/?(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
const preloaded = [...html.matchAll(/href="\.?\/?(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
const initialJs = [...new Set([...entry, ...preloaded])];

if (initialJs.length === 0) {
  console.error("check-bundle: could not find the entry script in dist/index.html");
  process.exit(1);
}

let jsKB = 0;
for (const file of initialJs) jsKB += gzipKB(join(dist, file));

const cssFiles = readdirSync(join(dist, "assets")).filter((f) => f.endsWith(".css"));
let cssKB = 0;
for (const file of cssFiles) cssKB += gzipKB(join(dist, "assets", file));

const lazy = readdirSync(join(dist, "assets"))
  .filter((f) => f.endsWith(".js") && !initialJs.includes(`assets/${f}`))
  .map((f) => ({ file: f, kb: gzipKB(join(dist, "assets", f)) }))
  .sort((a, b) => b.kb - a.kb);

console.log(`initial JS (gzip): ${jsKB.toFixed(1)} KB of ${BUDGET_KB} KB budget`);
for (const file of initialJs) console.log(`  ${file}  ${gzipKB(join(dist, file)).toFixed(1)} KB`);
console.log(`CSS (gzip): ${cssKB.toFixed(1)} KB of ${CSS_BUDGET_KB} KB budget`);
console.log(`lazy chunks: ${lazy.length}, largest ${lazy[0]?.file ?? "none"} ${(lazy[0]?.kb ?? 0).toFixed(1)} KB`);

let failed = false;
if (jsKB > BUDGET_KB) {
  console.error(`✖ initial JS is ${jsKB.toFixed(1)} KB, over the ${BUDGET_KB} KB budget`);
  failed = true;
}
if (cssKB > CSS_BUDGET_KB) {
  console.error(`✖ CSS is ${cssKB.toFixed(1)} KB, over the ${CSS_BUDGET_KB} KB budget`);
  failed = true;
}

// The explorer and the file-heavy pages must not be in the initial download.
const shouldBeLazy = ["Visualize", "Imaging", "WhatISee", "Settings", "Appointments", "MyEyes"];
for (const name of shouldBeLazy) {
  if (initialJs.some((f) => f.includes(name))) {
    console.error(`✖ ${name} is in the initial download; it must stay lazy`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("✓ bundle within budget");
