import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@op-omega/plugin-tier-router",
    include: ["src/**/*.test.ts"],
  },
});
