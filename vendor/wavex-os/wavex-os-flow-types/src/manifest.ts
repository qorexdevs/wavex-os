import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const PLUGIN_ID = "wavex-os.flow-types";
const PLUGIN_VERSION = "0.1.0";

const TASK_TAB_SLOT_ID = "flow-type-tab";
const TASK_TAB_EXPORT = "FlowTypeTab";

const COMMENT_BADGE_SLOT_ID = "flow-type-badge";
const COMMENT_BADGE_EXPORT = "FlowTypeBadge";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Operator Ω · Flow Types",
  description:
    "Tags issues with ASN / TLM / CON / VAL flow types for causal-edge analysis of the revenue flywheel.",
  author: "Operator Ω",
  categories: ["workspace", "ui"],
  capabilities: [
    "issues.read",
    "ui.detailTab.register",
    "ui.commentAnnotation.register",
    "ui.action.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  ui: {
    slots: [
      {
        type: "taskDetailView",
        id: TASK_TAB_SLOT_ID,
        displayName: "Flow Type",
        exportName: TASK_TAB_EXPORT,
        entityTypes: ["issue"],
      },
      {
        type: "commentAnnotation",
        id: COMMENT_BADGE_SLOT_ID,
        displayName: "Flow Type Badge",
        exportName: COMMENT_BADGE_EXPORT,
        entityTypes: ["comment"],
      },
    ],
  },
};

export default manifest;
