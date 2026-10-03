import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '..');
const result = await build({
  entryPoints: [resolve(app, 'src/engine/materials/iris-detail.ts')],
  bundle: true, write: false, format: 'iife', globalName: 'AfterlightIris',
  loader: { '.png': 'dataurl' }, minify: true,
  plugins: [{ name: 'inline-png', setup(builder) {
    builder.onResolve({ filter: /\.png\?inline$/ }, (args) => ({ path: resolve(dirname(args.importer), args.path.replace(/\?inline$/, '')) }));
  } }],
});
const path = resolve(root, 'EyeExplorer.html');
let html = readFileSync(path, 'utf8');
const block = `/* BEGIN BLENDER IRIS */\n${result.outputFiles[0].text}\n/* END BLENDER IRIS */`;
if (html.includes('/* BEGIN BLENDER IRIS */')) {
  html = html.replace(/\/\* BEGIN BLENDER IRIS \*\/[\s\S]*?\/\* END BLENDER IRIS \*\//, () => block);
} else {
  html = html.replace('const R_SCLERA =', () => `${block}\nconst R_SCLERA =`);
}

// the shared anatomical model + its r160 adapter, as a second generated block
const modelBuild = await build({
  entryPoints: [resolve(app, 'src/engine/legacy/afterlight-model.ts')],
  bundle: true, write: false, format: 'iife', globalName: 'AfterlightModel',
  minify: true,
});
const modelBlock = `/* BEGIN AFTERLIGHT MODEL */\n${modelBuild.outputFiles[0].text}\n/* END AFTERLIGHT MODEL */`;
if (html.includes('/* BEGIN AFTERLIGHT MODEL */')) {
  html = html.replace(/\/\* BEGIN AFTERLIGHT MODEL \*\/[\s\S]*?\/\* END AFTERLIGHT MODEL \*\//, () => modelBlock);
} else {
  html = html.replace('/* BEGIN BLENDER IRIS */', () => `${modelBlock}\n/* BEGIN BLENDER IRIS */`);
}

if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8') !== html) throw new Error('Explorer baked assets have drifted. Run npm run assets:embed.');
  console.log('✓ explorer baked assets match their source');
} else {
  writeFileSync(path, html);
  console.log('Embedded Blender iris assets, shared painter and the anatomical model in EyeExplorer.html');
}
