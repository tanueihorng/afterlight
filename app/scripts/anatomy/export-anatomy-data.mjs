// Export the anatomy constants and the default vessel tree so Blender authors against exactly
// the numbers the browser uses — there is no second anatomy table to drift.
//
//   node scripts/anatomy/export-anatomy-data.mjs
//
// Writes assets-src/generated/params.json (dimensions.ts as data) and
// assets-src/generated/vessels-default.json (the seeded vessel tree mapped onto the retina in
// eye-local millimetres, right eye: +x nasal, +y superior, -z posterior). Blender needs no
// TypeScript; the browser needs no Python. Both files are committed so the pipeline is
// reproducible without rerunning this step.

import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const root = resolve(app, "..");
const outDir = resolve(root, "assets-src/generated");
mkdirSync(outDir, { recursive: true });

// dimensions/fundus/vessels are pure TypeScript with no DOM at import time, so one bundled
// entry reads them without a runtime TS loader. The bundle is written to a temp module and
// imported — esbuild cannot emit in-memory ESM that node can import directly.
const entry = `
  export * from ${JSON.stringify(resolve(app, "src/engine/anatomy/dimensions.ts"))};
  export { fundusLayout, DEFAULT_FUNDUS } from ${JSON.stringify(resolve(app, "src/engine/anatomy/fundus.ts"))};
`;
const bundled = await build({
  stdin: { contents: entry, resolveDir: app, loader: "ts" },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const tmp = resolve(tmpdir(), "afterlight-bundled-anatomy.mjs");
writeFileSync(tmp, bundled.outputFiles[0].text);
const { EYE, SCENE_SCALE, fundusLayout, DEFAULT_FUNDUS } = await import(
  new URL(`file://${tmp}`).href
);

const layout = fundusLayout({ ...DEFAULT_FUNDUS, eye: "right", seed: 1 });

// Map normalised fundus coordinates (canvas convention, disc at 0.68 for a right eye) onto the
// inner retinal hemisphere with the same projection the renderer's retina UVs sample through
// (u = 0.5 + x/2R, gl v = 0.5 + y/2R, flipY against the canvas row), so Blender study vessels
// sit exactly where the browser's runtime tubes will.
//
// Layer radii must agree with assets-src/build-anatomy.py, which reads this file's params.json:
// sclera 1.0 posterior → choroid (×3 illustrative magnification, labelled) → retina 0.25.
const CHOROID_MAGNIFICATION = 3;
const retinaInnerRadiusMm =
  EYE.axialLength / 2 -
  EYE.sclera.thicknessPosterior -
  EYE.choroid.thickness * CHOROID_MAGNIFICATION -
  EYE.retina.thickness;
const round = (n) => Math.round(n * 1000) / 1000;
const to3D = (fx, fy) => {
  const x = (2 * fx - 1) * retinaInnerRadiusMm;
  const y = (2 * (1 - fy) - 1) * retinaInnerRadiusMm;
  const z = -Math.sqrt(Math.max(0, retinaInnerRadiusMm ** 2 - x * x - y * y));
  return [round(x), round(y), round(z)];
};

// A segment width of 1 means the full fundus width; the visible fundus spans roughly 14 mm of
// tissue, so widths convert at that scale (a major artery lands near 0.15 mm, its vein ~0.22).
const FUNDUS_SPAN_MM = 14;
const widthMm = (w) => round(w * FUNDUS_SPAN_MM);

const vessels = {
  note: "Default seeded vessel tree, right eye, eye-local mm, on the inner retinal surface.",
  retinaInnerRadiusMm,
  disc3d: to3D(layout.disc.x, layout.disc.y),
  fovea3d: to3D(layout.fovea.x, layout.fovea.y),
  segments: layout.segments.map((s) => ({
    kind: s.kind,
    depth: s.depth,
    widthMm: widthMm(s.width),
    points: s.points.map((p) => to3D(p.x, p.y)),
  })),
};

writeFileSync(
  resolve(outDir, "params.json"),
  JSON.stringify({ EYE, SCENE_SCALE, model: { choroidMagnification: CHOROID_MAGNIFICATION } }, null, 1) + "\n",
);
writeFileSync(resolve(outDir, "vessels-default.json"), JSON.stringify(vessels, null, 1) + "\n");
console.log(
  `✓ params.json (${Object.keys(EYE).length} sections) and vessels-default.json (${vessels.segments.length} segments) written to assets-src/generated/`,
);
