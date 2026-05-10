import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("op-omega onboarding starting (library-mode; server routes import handlers directly)");
  },

  async onHealth() {
    return { status: "ok", message: "op-omega onboarding ready" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
