import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { localSuggestionsPlugin } from "./scripts/local-suggestions.mjs";

export default defineConfig({
  envDir: import.meta.dirname,
  // Keep the live dev server's optimized modules separate from data/build tools.
  cacheDir: path.resolve(import.meta.dirname, "node_modules/.vite-dev"),
  plugins: [localSuggestionsPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    manifest: true,
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    host: true,
  },
});
