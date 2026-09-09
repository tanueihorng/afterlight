#!/usr/bin/env node
// The privacy claim, checked against the thing that actually ships.
//
// The guard checks the source. This checks the built output and the landing page — the bytes a
// patient's browser will run. A dependency that inlines a font URL, a favicon that points at a CDN,
// or a stray analytics snippet would all pass a source review and break the promise in production.
//
// It fails only on references a browser would *fetch*: src, href, url(), @import, importScripts,
// new Worker, fetch. Everything else external is listed so a human can see it and decide, because
// a URL inside an error message is not a request.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = resolve(appDir, "..");

const TARGETS = [join(appDir, "dist"), join(repoDir, "site")];

/** Hosts that are never fetched: XML namespaces are identifiers, not addresses. */
const NAMESPACE_HOSTS = /^https?:\/\/www\.w3\.org\//;

/**
 * Contexts a browser resolves and loads.
 *
 * `<a href>` is deliberately absent: a link someone chooses to follow is not a request this page
 * makes, and the landing page has several to the repository. `<link href>` *is* a request, so that
 * one is matched by tag rather than by attribute.
 */
const FETCHING = [
  [/\bsrc\s*=\s*["']?(https?:\/\/[^"'\s>)]+)/gi, "src="],
  [/<link\b[^>]*?\bhref\s*=\s*["']?(https?:\/\/[^"'\s>)]+)/gi, "<link href="],
  [/\burl\(\s*["']?(https?:\/\/[^"')]+)/gi, "url()"],
  [/@import\s+["'](https?:\/\/[^"']+)/gi, "@import"],
  [/\bimportScripts\(\s*["'](https?:\/\/[^"']+)/gi, "importScripts()"],
  [/\bnew\s+Worker\(\s*["'](https?:\/\/[^"']+)/gi, "new Worker()"],
  [/\bfetch\(\s*["'](https?:\/\/[^"']+)/gi, "fetch()"],
  [/\bnew\s+(?:WebSocket|EventSource)\(\s*["'](wss?:\/\/|https?:\/\/)[^"']+/gi, "socket"],
];

const ANY_URL = /(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'`)<>]*/gi;

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".webmanifest",
  ".svg",
  ".txt",
  ".map",
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const failures = [];
const mentions = new Map();
let scanned = 0;

for (const target of TARGETS) {
  if (!existsSync(target)) continue;
  for (const file of walk(target)) {
    if (!TEXT_EXTENSIONS.has(extname(file))) continue;
    const text = readFileSync(file, "utf8");
    scanned++;
    const where = relative(repoDir, file);

    for (const [pattern, label] of FETCHING) {
      for (const match of text.matchAll(pattern)) {
        const url = match[1] ?? match[0];
        if (NAMESPACE_HOSTS.test(url)) continue;
        failures.push({ where, label, url });
      }
    }

    for (const match of text.matchAll(ANY_URL)) {
      const url = match[0];
      if (NAMESPACE_HOSTS.test(url)) continue;
      if (/localhost|127\.0\.0\.1/.test(url)) continue;
      if (!mentions.has(url)) mentions.set(url, new Set());
      mentions.get(url).add(where);
    }
  }
}

if (scanned === 0) {
  console.error("✖ nothing to check — run `npm run build` first");
  process.exit(1);
}

if (mentions.size > 0) {
  console.log(`\nExternal addresses mentioned in the shipped files (not fetched):`);
  for (const [url, files] of [...mentions].sort()) {
    console.log(`  ${url}\n    ${[...files].join(", ")}`);
  }
}

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} third-party request(s) in the shipped build:\n`);
  for (const f of failures) console.error(`  ${f.where}  [${f.label}] ${f.url}`);
  console.error(
    `\nThe README says nothing is transmitted because there is nowhere for it to be\n` +
      `transmitted to. That has to be true of the built files, not only of the source.\n`,
  );
  process.exit(1);
}

console.log(`\n✓ no third-party requests: ${scanned} shipped files checked`);
