import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@wavex-os/plugin-flow-types",
    include: ["src/**/*.test.ts"],
  },
});
