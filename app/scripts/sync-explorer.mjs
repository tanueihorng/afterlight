// EyeExplorer.html is the canonical, self-contained 3D explorer at the repo root.
// Vite serves it from public/, so copy it in before dev/build rather than committing it twice.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../EyeExplorer.html");
const dest = resolve(here, "../public/EyeExplorer.html");

if (!existsSync(src)) {
  console.error(`sync-explorer: missing ${src}`);
  process.exit(1);
}

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log("sync-explorer: EyeExplorer.html → app/public/");
