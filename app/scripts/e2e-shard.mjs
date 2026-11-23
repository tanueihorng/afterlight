#!/usr/bin/env node
// Split one Playwright project's end-to-end tests across CI runners by measured duration.
//
// Every runner keeps one worker: two pages rendering the eye in software GL on one machine starve
// each other (V-107). Speed comes from more runners, not more workers per runner. Playwright's own
// --shard cuts the test list into contiguous chunks by count, which puts all of engine.spec.ts
// (half the desktop run) on one runner; this packs by duration instead.
//
// Nothing is dropped: the full list comes from `playwright test --list`, every test lands in
// exactly one shard, and a test missing from e2e/timings.json is packed at the median duration.
// The timings only balance the shards; they never decide whether a test runs.
//
//   node scripts/e2e-shard.mjs --project desktop --shard 2/5 --out shard.txt
//       write shard 2 of 5 as a Playwright --test-list file
//   node scripts/e2e-shard.mjs --project desktop --shards 5
//       print the plan for every shard, and check that the shards cover the project exactly once
//   node scripts/e2e-shard.mjs --record results/*.json
//       refresh e2e/timings.json from Playwright JSON reports (pass every shard of a project:
//       that project's old timings are replaced, not merged)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const timingsPath = resolve(appDir, "e2e/timings.json");

function fail(message) {
  console.error(`e2e-shard: ${message}`);
  process.exit(1);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** "[project] › file › describe › title", the form --test-list accepts. */
function keyOf(projectName, file, titles) {
  return `[${projectName}] › ${file} › ${titles.join(" › ")}`;
}

/** Visit every test in a Playwright JSON report or listing. */
function eachTest(report, visit) {
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) visit(keyOf(test.projectName, spec.file, [...titles, spec.title]), test);
    }
    for (const child of suite.suites ?? []) walk(child, [...titles, child.title]);
  };
  // The top-level suites are files; their title is the file name, which the key already carries.
  for (const file of report.suites ?? []) walk(file, []);
}

function listTests(project) {
  const out = execFileSync(
    "npx",
    ["playwright", "test", "--list", "--reporter=json", `--project=${project}`],
    { cwd: appDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const report = JSON.parse(out);
  if (report.errors?.length) fail(`listing failed:\n${report.errors.map((e) => e.message).join("\n")}`);
  const keys = [];
  eachTest(report, (key) => keys.push(key));
  if (new Set(keys).size !== keys.length) fail("two tests share a full title; --test-list cannot tell them apart");
  if (keys.length === 0) fail(`no tests found for project "${project}"`);
  return keys;
}

function readTimings() {
  return existsSync(timingsPath) ? JSON.parse(readFileSync(timingsPath, "utf8")) : {};
}

/** Longest-first greedy packing: deterministic, so every runner computes the same plan. */
function pack(keys, timings, count) {
  const known = keys.map((k) => timings[k]).filter((s) => typeof s === "number").sort((a, b) => a - b);
  const fallback = known.length ? known[Math.floor(known.length / 2)] : 1;
  const weighted = keys
    .map((key) => ({ key, seconds: timings[key] ?? fallback }))
    .sort((a, b) => b.seconds - a.seconds || (a.key < b.key ? -1 : 1));
  const shards = Array.from({ length: count }, () => ({ seconds: 0, keys: [] }));
  for (const test of weighted) {
    let target = shards[0];
    for (const shard of shards) if (shard.seconds < target.seconds) target = shard;
    target.keys.push(test.key);
    target.seconds += test.seconds;
  }
  for (const shard of shards) shard.keys.sort();
  return { shards, unknown: keys.filter((k) => timings[k] === undefined).length };
}

function checkCoverage(keys, shards) {
  const seen = new Map();
  for (const shard of shards) for (const key of shard.keys) seen.set(key, (seen.get(key) ?? 0) + 1);
  const missing = keys.filter((k) => !seen.has(k));
  const doubled = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
  if (missing.length || doubled.length || seen.size !== keys.length) {
    fail(`shards do not cover the suite exactly once (missing ${missing.length}, doubled ${doubled.length})`);
  }
  shards.forEach((shard, i) => {
    if (shard.keys.length === 0) fail(`shard ${i + 1} is empty; an empty --test-list would run nothing`);
  });
}

function record(files) {
  if (files.length === 0) fail("--record needs at least one Playwright JSON report");
  const fresh = {};
  for (const file of files) {
    eachTest(JSON.parse(readFileSync(file, "utf8")), (key, test) => {
      const ran = test.results.filter((r) => r.status !== "skipped");
      if (ran.length) fresh[key] = Math.round(ran.at(-1).duration / 100) / 10;
    });
  }
  const projects = new Set(Object.keys(fresh).map((k) => k.slice(0, k.indexOf("]") + 1)));
  const kept = Object.entries(readTimings()).filter(([k]) => !projects.has(k.slice(0, k.indexOf("]") + 1)));
  const merged = Object.fromEntries([...kept, ...Object.entries(fresh)].sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(timingsPath, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`e2e-shard: recorded ${Object.keys(fresh).length} timings for ${[...projects].join(", ")}`);
}

if (process.argv.includes("--record")) {
  record(process.argv.slice(process.argv.indexOf("--record") + 1));
  process.exit(0);
}

const project = arg("--project");
if (!project) fail("--project is required");
const shardArg = arg("--shard");
const count = Number(shardArg ? shardArg.split("/")[1] : arg("--shards"));
const index = shardArg ? Number(shardArg.split("/")[0]) : undefined;
if (!Number.isInteger(count) || count < 1) fail("give --shard i/n or --shards n");
if (index !== undefined && !(Number.isInteger(index) && index >= 1 && index <= count)) fail(`bad shard "${shardArg}"`);

const keys = listTests(project);
const { shards, unknown } = pack(keys, readTimings(), count);
checkCoverage(keys, shards);

const minutes = (s) => (s / 60).toFixed(1);
console.error(
  `e2e-shard: ${keys.length} ${project} tests in ${count} shards` +
    (unknown ? ` (${unknown} without a timing, packed at the median)` : ""),
);
shards.forEach((shard, i) => {
  const mark = index === i + 1 ? "→" : " ";
  console.error(`${mark} shard ${i + 1}/${count}: ${shard.keys.length} tests, ~${minutes(shard.seconds)} min`);
});

if (index !== undefined) {
  const out = arg("--out");
  if (!out) fail("--out is required with --shard");
  writeFileSync(out, `${shards[index - 1].keys.join("\n")}\n`);
}
