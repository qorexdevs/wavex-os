import { definePlugin, runWorker, type PluginContext } from "@paperclipai/plugin-sdk";
import { ENTITY_TYPE, isFlowType, type FlowType } from "./flow-types.js";

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`missing or invalid ${field}`);
  }
  return value;
}

async function getFlowType(ctx: PluginContext, issueId: string): Promise<FlowType | null> {
  const records = await ctx.entities.list({
    entityType: ENTITY_TYPE,
    scopeKind: "issue",
    scopeId: issueId,
    limit: 1,
  });
  if (records.length === 0) return null;
  const value = records[0]?.data?.flowType;
  return isFlowType(value) ? value : null;
}

async function setFlowType(
  ctx: PluginContext,
  issueId: string,
  flowType: FlowType,
): Promise<void> {
  await ctx.entities.upsert({
    entityType: ENTITY_TYPE,
    scopeKind: "issue",
    scopeId: issueId,
    externalId: issueId,
    title: flowType,
    status: "active",
    data: { flowType, issueId, setAt: new Date().toISOString() },
  });
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("wavex-os flow-types plugin starting");

    ctx.data.register("flow-type", async (params) => {
      const issueId = requireString(params.issueId, "issueId");
      const flowType = await getFlowType(ctx, issueId);
      return { issueId, flowType };
    });

    ctx.data.register("flow-type-list", async (params) => {
      const companyId = requireString(params.companyId, "companyId");
      const records = await ctx.entities.list({
        entityType: ENTITY_TYPE,
        scopeKind: "issue",
        limit: 500,
      });
      const filtered = typeof params.flowType === "string"
        ? records.filter((r) => r.data?.flowType === params.flowType)
        : records;
      return filtered.map((r) => ({
        issueId: r.scopeId,
        flowType: r.data?.flowType,
        updatedAt: r.updatedAt,
        companyId,
      }));
    });

    ctx.actions.register("set-flow-type", async (params) => {
      const issueId = requireString(params.issueId, "issueId");
      const value = requireString(params.flowType, "flowType");
      if (!isFlowType(value)) {
        throw new Error(`invalid flowType: ${value}`);
      }
      await setFlowType(ctx, issueId, value);
      return { issueId, flowType: value, ok: true };
    });

    ctx.actions.register("clear-flow-type", async (params) => {
      const issueId = requireString(params.issueId, "issueId");
      await ctx.entities.upsert({
        entityType: ENTITY_TYPE,
        scopeKind: "issue",
        scopeId: issueId,
        externalId: issueId,
        title: null as unknown as string,
        status: "cleared",
        data: { flowType: null, issueId, clearedAt: new Date().toISOString() },
      });
      return { issueId, ok: true };
    });
  },

  async onHealth() {
    return { status: "ok", message: "wavex-os flow-types ready" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
