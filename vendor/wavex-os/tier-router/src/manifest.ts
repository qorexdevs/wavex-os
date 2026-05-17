import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const PLUGIN_ID = "wavex-os.tier-router";
const PLUGIN_VERSION = "0.1.0";

/**
 * Minimal plugin manifest — tier-router is primarily consumed as a library
 * (in-process) by server code (onboarding, future flywheel-kernel routines).
 * The plugin worker exists so it can be installed, health-checked, and its
 * decision function can be probed via ctx.data.register("decide", …).
 */
const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Operator Ω · Tier Router",
  description:
    "Routes inference by tier: T0 deterministic / T1 Ollama / T2 Claude Code (Max subscription) / T2-overflow (API). Consults rate-limit-budget before every T2 call.",
  author: "Operator Ω",
  categories: ["automation"],
  capabilities: ["http.outbound"],
  entrypoints: {
    worker: "./dist/worker.js",
  },
};

export default manifest;
