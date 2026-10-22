import { defineConfig, devices } from "@playwright/test";

// E2E contra el build de producción (vite preview). La API se simula con page.route y
// datos ficticios: no se necesita backend ni se accede a servicios externos.
const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "es-ES",
    timezoneId: "America/Lima",
    trace: "retain-on-failure",
    // Sin GPU (CI, WSL): WebGL por software para que el globo Cesium se dibuje.
    launchOptions: {
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [
    {
      name: "escritorio",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "tableta",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    {
      name: "movil",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 }, hasTouch: true },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm exec vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
