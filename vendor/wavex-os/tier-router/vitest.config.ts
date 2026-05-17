import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@wavex-os/plugin-tier-router",
    include: ["src/**/*.test.ts"],
  },
});
