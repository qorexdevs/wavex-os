import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { couple } from "./coupling.js";
import { assessCriticality } from "./criticality.js";
import { bifurcate } from "./bifurcation.js";
import { runMonteCarlo } from "./monte-carlo/simulator.js";
import type { KPISnapshot, BifurcationInput } from "./types.js";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("wavex-os flywheel-kernel starting (library-first; consumers import pure fns)");

    ctx.data.register("couple", async (params) => {
      const input = params.input as KPISnapshot;
      const previous = (params.previous ?? null) as KPISnapshot | null;
      return couple(input, previous ?? undefined);
    });

    ctx.data.register("criticality", async (params) => {
      const history = (params.history ?? []) as KPISnapshot[];
      return assessCriticality(history);
    });

    ctx.data.register("bifurcation", async (params) => {
      const input = params.input as BifurcationInput;
      return bifurcate(input);
    });

    ctx.data.register("monte-carlo", async (params) => {
      const initial = params.initial as KPISnapshot;
      const horizon = (params.horizon_cycles as number) ?? 30;
      const n_runs = (params.n_runs as number) ?? 20;
      const seed = (params.seed as number) ?? 42;
      return runMonteCarlo(initial, horizon, n_runs, seed);
    });
  },

  async onHealth() {
    return { status: "ok", message: "wavex-os flywheel-kernel ready" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
