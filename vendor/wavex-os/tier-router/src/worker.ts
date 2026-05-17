import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { decide } from "./router.js";
import type { BudgetSnapshot, TierRoutingRequest } from "./types.js";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("wavex-os tier-router plugin starting (library-mode; library consumers import route() directly)");

    // Expose decide() as a plugin data handler for UI/observability probes.
    ctx.data.register("decide", async (params) => {
      const request = (params.request ?? null) as TierRoutingRequest | null;
      const budget = (params.budget ?? null) as BudgetSnapshot | null;
      if (!request || !budget) {
        throw new Error("params.request and params.budget required");
      }
      return decide(request, budget);
    });
  },

  async onHealth() {
    return { status: "ok", message: "wavex-os tier-router ready" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
