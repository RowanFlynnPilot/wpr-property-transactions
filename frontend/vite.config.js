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
        // Split React into its own long-lived cacheable chunk. Everything else is
        // left to Rollup on purpose: recharts and Leaflet are reached only through
        // lazy imports (App.jsx, KpiHero.jsx), so Rollup emits each as its own
        // on-demand chunk. A catch-all "vendor" chunk here would be a trap — it
        // also swallows small libraries the entry needs (html-to-image for the
        // share card), which makes the entry depend on the whole chart library
        // and preloads it on every page view.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id))
            return "react";
        },
      },
    },
  },
});
