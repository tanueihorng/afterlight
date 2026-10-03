import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // the Blender-authored model binary inlines as a data URL so the lazy renderer chunk
  // carries it with no fetch (the nonetwork gate checks the built output)
  assetsInclude: ["**/*.bin"],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
});
