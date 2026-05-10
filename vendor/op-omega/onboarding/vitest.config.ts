import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@op-omega/plugin-onboarding",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    testTimeout: 300_000,
  },
});
