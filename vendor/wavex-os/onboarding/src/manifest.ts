import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "wavex-os.onboarding",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Operator Ω · Onboarding",
  description:
    "4-phase manifest-generation pipeline: pillar_responses → connector_manifest → swarm_manifest → workflow_manifest → company.manifest.",
  author: "Operator Ω",
  categories: ["automation"],
  capabilities: ["plugin.state.read", "plugin.state.write"],
  entrypoints: {
    worker: "./dist/worker.js",
  },
};

export default manifest;
