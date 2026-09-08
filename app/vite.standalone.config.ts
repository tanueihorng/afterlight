import { defineConfig } from "vite";
import { resolve } from "node:path";

/**
 * Builds the offline single-file explorer. Everything is inlined — no assets, no imports, no
 * network — so the result opens from a USB stick on a machine that has never seen the internet.
 */
export default defineConfig({
  root: resolve(__dirname, "standalone"),
  build: {
    outDir: resolve(__dirname, "dist-standalone"),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
