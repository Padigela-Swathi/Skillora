import { defineConfig } from "@playwright/test";

try { process.loadEnvFile(".env.local"); } catch { /* optional */ }

const PORT = Number(process.env.E2E_PORT ?? 3100);
// Sandbox-only escape hatches (leave unset on a normal machine / CI):
//   E2E_PROXY=http://127.0.0.1:PORT   route browser traffic through a corporate/agent proxy
//   E2E_INSECURE=1                    trust the proxy's re-signed certificates
//   E2E_CHROMIUM=/path/to/chrome      use a pre-installed Chromium instead of `npx playwright install`
const proxy = process.env.E2E_PROXY ? { server: process.env.E2E_PROXY, bypass: "localhost,127.0.0.1" } : undefined;
const insecure = process.env.E2E_INSECURE === "1";

const common = {
  baseURL: `http://localhost:${PORT}`,
  permissions: ["camera", "microphone"] as string[],
  ignoreHTTPSErrors: insecure,
  launchOptions: { proxy, executablePath: process.env.E2E_CHROMIUM || undefined, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", ...(insecure ? ["--ignore-certificate-errors"] : [])] },
  trace: "off" as const,
};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
    env: { NODE_USE_ENV_PROXY: "1" },
  },
  projects: [
    { name: "desktop", use: { ...common, viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...common, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
