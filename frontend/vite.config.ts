import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { defineConfig } from "vitest/config";

// Backend de desarrollo publicado por compose.override.yaml (solo loopback).
const backendUrl = "http://127.0.0.1:8100";

// Cesium necesita sus workers y recursos como archivos estáticos en /cesium/ (ver
// features/explore/globe/cesium-base.ts). La v4 del plugin conserva la ruta de origen:
// stripBase quita node_modules/cesium/Build/Cesium.
const cesiumAssets = ["Workers", "ThirdParty", "Assets", "Widgets"].map((dir) => ({
  src: `node_modules/cesium/Build/Cesium/${dir}`,
  dest: "cesium",
  rename: { stripBase: 4 },
}));

export default defineConfig({
  plugins: [react(), tailwindcss(), viteStaticCopy({ targets: cesiumAssets })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": backendUrl,
      "/health": backendUrl,
    },
  },
  test: {
    // Solo pruebas unitarias y de integración; las E2E de e2e/ las ejecuta Playwright.
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
