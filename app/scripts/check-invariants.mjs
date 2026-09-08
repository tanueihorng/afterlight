#!/usr/bin/env node
// Mechanical enforcement of the non-negotiables in AGENTS.md.
// Cheap, boring checks that catch the failures an agent is most likely to introduce.
// Anything that needs judgement is deliberately NOT here — see "What requires a human".

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(appDir, "src");
const repoDir = resolve(appDir, "..");

const failures = [];
const warnings = [];

const fail = (file, line, rule, detail) =>
  failures.push({ file: relative(repoDir, file), line, rule, detail });
const warn = (file, line, rule, detail) =>
  warnings.push({ file: relative(repoDir, file), line, rule, detail });

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if ([".ts", ".tsx", ".css", ".html"].includes(extname(entry))) out.push(full);
  }
  return out;
}

const files = walk(srcDir);

/* ---------- 1. Local-first: no network, no third-party assets ---------- */

const NETWORK_PATTERNS = [
  [/\bfetch\s*\(/, "fetch() call"],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/navigator\.sendBeacon/, "sendBeacon"],
  [/\bnew\s+WebSocket\b/, "WebSocket"],
  [/\bnew\s+EventSource\b/, "EventSource"],
  [/https?:\/\/(?!localhost|127\.0\.0\.1)[a-z0-9.-]+\.[a-z]{2,}/i, "remote URL"],
];

// Allowed: links a user may deliberately open, and the mm-accurate anatomy citations in comments.
const URL_ALLOW = /(^\s*(\/\/|\*|<!--))|href=|xmlns|schema|w3\.org|shields\.io/;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const [re, label] of NETWORK_PATTERNS) {
      if (!re.test(line)) continue;
      if (label === "remote URL" && URL_ALLOW.test(line)) continue;
      if (/eslint-disable.*local-first/.test(line)) continue;
      fail(file, i + 1, "local-first", `${label}: ${line.trim().slice(0, 100)}`);
    }
  });
}

/* ---------- 2. No diagnosis, no risk scores, no false reassurance ---------- */

const BANNED_COPY = [
  [/\byou (probably|likely|may|might|could|most likely|appear to) have\b/i, "tells the user what they have"],
  [/\brisk score\b|\brisk level\b|\bseverity score\b/i, "risk scoring"],
  [/\b\d+\s?%\s?(chance|risk|probability|likelihood)\b/i, "probability estimate"],
  [/your (vision|sight|eyes?) (is|are|has been)? ?(getting )?(worse|declining|deteriorating)/i, "prognosis"],
  [/\b(you'?re|you are) (fine|okay|ok|safe|healthy)\b/i, "false reassurance"],
  [/\b(looks|appears|seems) (normal|healthy|fine)\b/i, "interpretation as normal"],
  [/\bno cause for concern\b|\bnothing to worry about\b/i, "false reassurance"],
  [/\b(diagnos(is|e|ed) suggests?|suggests? (that )?you)\b/i, "diagnostic suggestion"],
];

for (const file of files) {
  if (file.endsWith(".css")) continue;
  // Tests quote the very phrases they assert are absent; scanning them flags the guard's own
  // safety net as a violation.
  if (/\.test\.tsx?$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  const copyLines = text.split("\n");
  copyLines.forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return; // comments are not user-facing
    // A sentence that denies making a claim is not making one: "never suggests what you might
    // have" is the opposite of what this rule exists to catch. Prose wraps, so judge the
    // surrounding sentence rather than a fragment of it.
    const sentence = [copyLines[i - 1] ?? "", line, copyLines[i + 1] ?? ""].join(" ");
    const denies = /\b(never|not|cannot|does not|doesn't|no)\b/i.test(sentence);
    for (const [re, label] of BANNED_COPY) {
      if (re.test(line) && !denies) {
        fail(file, i + 1, "no-interpretation", `${label}: ${line.trim().slice(0, 100)}`);
      }
    }
  });
}

/* ---------- 3. Provenance: every record type declares a source ---------- */

const models = readFileSync(join(srcDir, "lib/models.ts"), "utf8");
const RECORD_EXEMPT = new Set([
  // Not clinical records: app plumbing, derived views, and value objects.
  "AppMeta", "StoredFile", "BriefSection", "BriefPayload", "DrawingMark",
  "TimelineEvent", "GeneratedBrief", "DoctorQuestion", "Appointment",
  "Prescription", "Medication", "Procedure", "EyeBaseline",
]);

for (const match of models.matchAll(/export interface (\w+) \{([\s\S]*?)\n\}/g)) {
  const [, name, body] = match;
  if (RECORD_EXEMPT.has(name)) continue;
  const hasDate = /\b(date|date_time|first_documented|first_seen|start_date)\b/.test(body);
  if (!hasDate) continue;
  if (!/\bsource_type\b/.test(body)) {
    fail(join(srcDir, "lib/models.ts"), 0, "provenance", `${name} has a date but no source_type`);
  }
  // A daily log deliberately spans the whole day, not one eye; its symptoms carry the eye.
  if (name !== "DailyLog" && !/\beye\b/.test(body)) {
    warn(join(srcDir, "lib/models.ts"), 0, "provenance", `${name} has no eye field — is it eye-specific?`);
  }
}

/* ---------- 4. Dependencies stay minimal ---------- */

const pkg = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"));
const ALLOWED_RUNTIME = new Set(["react", "react-dom", "three"]);
for (const dep of Object.keys(pkg.dependencies ?? {})) {
  if (!ALLOWED_RUNTIME.has(dep)) {
    fail(join(appDir, "package.json"), 0, "dependencies", `unapproved runtime dependency: ${dep}`);
  }
}
const TELEMETRY = /analytics|telemetry|sentry|posthog|mixpanel|amplitude|gtag|segment|datadog/i;
for (const dep of [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]) {
  if (TELEMETRY.test(dep)) {
    fail(join(appDir, "package.json"), 0, "local-first", `telemetry dependency: ${dep}`);
  }
}

/* ---------- 5. Generic visualizations carry their boundary ---------- */

const visualize = join(srcDir, "pages/Visualize.tsx");
const visualizeText = readFileSync(visualize, "utf8");
if (!/not a reconstruction of your own|not your (eye|anatomy)|generic and educational/i.test(visualizeText)) {
  fail(visualize, 0, "generic-boundary", "Visualize is missing its 'generic, not your eye' boundary");
}

/* ---------- 6. Self-tests are never presented as clinical measurements ---------- */

const selfTestFiles = files.filter(
  (f) => /selftest|SelfTests|components\/tests\//i.test(f) && !/\.test\.tsx?$/.test(f),
);

if (selfTestFiles.length > 0) {
  const selfTestSource = selfTestFiles.map((f) => readFileSync(f, "utf8")).join("\n");

  // The boundary sentence must exist and must be used, not merely defined.
  if (!/not a measurement of your vision/i.test(selfTestSource)) {
    fail(
      join(srcDir, "lib/selftest.ts"),
      0,
      "self-test-boundary",
      "the self-test boundary wording is missing",
    );
  }

  // A bare Snellen fraction in self-test UI would read as a clinical acuity.
  for (const file of selfTestFiles) {
    const text = readFileSync(file, "utf8");
    text.split("\n").forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;
      if (/["`>]\s*\d+\/\d+\s*["`<]/.test(line)) {
        fail(file, i + 1, "self-test-boundary", `bare acuity fraction: ${line.trim().slice(0, 80)}`);
      }
      // Options the person picks (room lighting "Normal") describe conditions, not results.
      const isChoice = /<option|value=/.test(line);
      if (!isChoice && /\b(pass|fail|passed|failed|normal|abnormal)\b/i.test(line) && /["`]/.test(line)) {
        warn(file, i + 1, "self-test-boundary", `pass/fail language: ${line.trim().slice(0, 80)}`);
      }
    });
  }
}

/* ---------- 7. The ask layer never invents ---------- */

const askPath = join(srcDir, "lib/ask.ts");
const askText = readFileSync(askPath, "utf8");
if (!/I could not find that in your stored records\./.test(askText)) {
  fail(askPath, 0, "no-invention", "the exact not-found sentence is missing from ask.ts");
}
for (const bad of ["openai", "anthropic", "generateText", "llm", "completion("]) {
  if (askText.toLowerCase().includes(bad)) {
    fail(askPath, 0, "no-invention", `ask.ts must stay deterministic — found "${bad}"`);
  }
}

/* ---------- 7b. The atlas is a reference, never a suggestion engine ---------- */

const atlasFiles = files.filter((f) => /engine\/conditions\/|components\/Atlas/.test(f) && !f.includes(".test."));
for (const file of atlasFiles) {
  const text = readFileSync(file, "utf8");
  text.split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    // Ranking conditions against someone's own symptoms would turn a reference into a diagnosis.
    if (/(likely|possible|probable|suspected)\s+(condition|diagnos|cause)/i.test(line)) {
      fail(file, i + 1, "no-interpretation", `suggests a diagnosis: ${line.trim().slice(0, 80)}`);
    }
    if (/(match|rank|score).*(symptom|yourSymptoms)/i.test(line) && !/never|not /i.test(line)) {
      fail(file, i + 1, "no-interpretation", `ranks conditions against symptoms: ${line.trim().slice(0, 80)}`);
    }
  });
}

/* ---------- 7c. Vision simulations keep their soft edges and their boundary ---------- */

const simPath = join(srcDir, "engine/simulate/vision.ts");
if (existsSync(simPath)) {
  const simText = readFileSync(simPath, "utf8");
  if (!/not a measurement of anyone's vision/i.test(simText)) {
    fail(simPath, 0, "simulation-boundary", "the simulation boundary wording is missing");
  }
  simText.split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    // The hard black tunnel is the most misleading picture in this whole subject.
    if (/(fillStyle|strokeStyle|addColorStop)[^\n]*(#000\b|rgba?\(\s*0\s*,\s*0\s*,\s*0)/.test(line)) {
      fail(simPath, i + 1, "simulation-boundary", `field loss painted black: ${line.trim().slice(0, 80)}`);
    }
  });
}

/* ---------- 8. Condition profiles never become diagnoses ---------- */

const conditionsPath = join(srcDir, "lib/conditions.ts");
const conditionsText = readFileSync(conditionsPath, "utf8");
for (const [, blurb] of conditionsText.matchAll(/blurb:\s*"([^"]+)"/g)) {
  if (/\byou have\b(?! had)|\byou are diagnosed\b/i.test(blurb)) {
    fail(conditionsPath, 0, "no-interpretation", `profile blurb reads as a diagnosis: "${blurb}"`);
  }
}

/* ---------- report ---------- */

const line = (f) => `  ${f.file}${f.line ? `:${f.line}` : ""}  [${f.rule}] ${f.detail}`;

if (warnings.length) {
  console.log(`\n⚠  ${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log(line(w)));
}

if (failures.length) {
  console.error(`\n✖ ${failures.length} invariant violation(s):\n`);
  failures.forEach((f) => console.error(line(f)));
  console.error(`\nThese are the non-negotiables in AGENTS.md. Fix them, or if a check is wrong,`);
  console.error(`change the check deliberately and say so in the PR — never silence it quietly.\n`);
  process.exit(1);
}

console.log(`✓ invariants: ${files.length} files checked, no violations`);
