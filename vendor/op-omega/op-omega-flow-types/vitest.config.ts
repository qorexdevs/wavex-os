import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@op-omega/plugin-flow-types",
    include: ["src/**/*.test.ts"],
  },
});
