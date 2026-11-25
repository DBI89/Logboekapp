import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

/** Levert het PGlite-bestandssysteem mee als assets/pglite-fs.wasm (de artifact-host serveert geen .data). */
function pgliteBundel(): Plugin {
  const bron = path.resolve(__dirname, "node_modules/@electric-sql/pglite/dist/pglite.data");
  return {
    name: "pglite-fs-bundel",
    configureServer(server) {
      server.middlewares.use("/assets/pglite-fs.wasm", (_req, res) => res.end(readFileSync(bron)));
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "assets/pglite-fs.wasm", source: readFileSync(bron) });
    },
  };
}

const shim = (naam: string) => path.resolve(__dirname, "browser/shims", naam);

/** Browserversie van de demo: dezelfde schermen en domeincode, met database en "server" in de browser. */
export default defineConfig({
  root: "browser",
  base: "./",
  plugins: [react(), tailwindcss(), pgliteBundel()],
  resolve: {
    alias: [
      { find: /^@\/db\/client$/, replacement: shim("db-client.ts") },
      { find: /^next\/link$/, replacement: shim("next-link.tsx") },
      { find: /^next\/navigation$/, replacement: shim("next-navigation.ts") },
      { find: /^next\/headers$/, replacement: shim("next-headers.ts") },
      { find: /^next\/cache$/, replacement: shim("next-cache.ts") },
      { find: /^server-only$/, replacement: shim("leeg.ts") },
      { find: /^@anthropic-ai\/sdk.*$/, replacement: shim("leeg.ts") },
      { find: /^@\//, replacement: path.resolve(__dirname, "src") + "/" },
    ],
  },
  css: { postcss: { plugins: [] } },
  esbuild: { charset: "ascii" },
  define: { "process.env": "{}" },
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  build: {
    outDir: path.resolve(__dirname, ".data/browser-dist"),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 8000,
    target: "es2022",
  },
});
