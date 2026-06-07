import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base must match the GitHub Pages repo path for the WordPress iframe to resolve assets.
export default defineConfig({
  plugins: [react()],
  base: "/wpr-property-transactions/",
});
