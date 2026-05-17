import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@wavex-os/plugin-flywheel-kernel",
    include: ["src/**/*.test.ts"],
  },
});
