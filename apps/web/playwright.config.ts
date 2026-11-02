import { defineConfig, devices } from "@playwright/test";

// Local preview checks must not pass through a proxy inherited from the shell.
process.env.NO_PROXY = [process.env.NO_PROXY, "localhost", "127.0.0.1"]
  .filter(Boolean)
  .join(",");
const external = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 1,
  fullyParallel: false,
  use: {
    ...devices["Desktop Chrome"],
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === "darwin" ? "chrome" : undefined),
    baseURL: external || "http://localhost:3010",
    locale: "zh-CN",
    trace: "retain-on-failure",
  },
  webServer: external
    ? undefined
    : {
        command:
          "pnpm --config.verify-deps-before-run=false exec next start --port 3010",
        url: "http://localhost:3010",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
