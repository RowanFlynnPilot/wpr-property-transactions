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
});
