import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@op-omega/plugin-flywheel-kernel",
    include: ["src/**/*.test.ts"],
  },
});
