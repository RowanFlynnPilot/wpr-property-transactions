import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// base must match the GitHub Pages repo path for the WordPress iframe to resolve assets.
// publicDir points at the repo's data/ so the committed feed (the single source of
// truth the scraper writes) is copied to the site root and served at
// `${BASE_URL}transactions.json` — exactly what App.jsx fetches. No copy step needed.
export default defineConfig({
  plugins: [react()],
  base: "/wpr-property-transactions/",
  publicDir: fileURLToPath(new URL("../data", import.meta.url)),
  build: {
    rollupOptions: {
      output: {
        // Split stable vendor libs into their own cacheable chunks. Leaflet/
        // react-leaflet are excluded on purpose: they're reached only through the
        // lazy map import (App.jsx), so Rollup already emits them as a separate
        // on-demand chunk. Weekly feed-only deploys don't change these, so
        // returning visitors re-use the cached vendor chunks.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("leaflet")) return; // stays in the lazy map chunk
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id))
            return "react";
          return "charts"; // recharts + its d3/lodash deps
        },
      },
    },
  },
});
