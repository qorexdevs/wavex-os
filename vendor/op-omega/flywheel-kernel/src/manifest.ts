import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "op-omega.flywheel-kernel",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Operator Ω · Flywheel Kernel",
  description:
    "R(t+1) coupling equation, 4-condition criticality check, bifurcation B(C) engine, and Monte Carlo inference with 5 canonical strategies.",
  author: "Operator Ω",
  categories: ["automation"],
  capabilities: ["plugin.state.read", "plugin.state.write"],
  entrypoints: {
    worker: "./dist/worker.js",
  },
};

export default manifest;
