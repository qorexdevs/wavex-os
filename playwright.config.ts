import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Each test run gets its own isolated state dir + db so the operator's
// real ~/.wavex-os/ is never touched. Vault master key is fixed so vault
// reads/writes are deterministic across runs.
const stateDir = process.env.WAVEX_OS_STATE_DIR ?? mkdtempSync(join(tmpdir(), "wavex-pw-"));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,           // single-state-dir → tests must run serially
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      WAVEX_OS_STATE_DIR: stateDir,
      PAPERCLIP_DATA_DIR: stateDir,
      WAVEX_DB_DATA_DIR: join(stateDir, "db"),
      WAVEX_AUTH_MODE: "dev",
      WAVEX_COMPOSIO_DISABLED: "1",
      CREDENTIAL_VAULT_MASTER_KEY: "0".repeat(64),
    },
  },
});
