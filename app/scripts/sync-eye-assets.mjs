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
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8') !== html) throw new Error('Explorer baked assets have drifted. Run npm run assets:embed.');
  console.log('✓ explorer baked assets match their source');
} else {
  writeFileSync(path, html);
  console.log('Embedded Blender iris assets and shared painter in EyeExplorer.html');
}
