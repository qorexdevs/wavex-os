/**
 * WaveX plugin worker.
 *
 * Registers four data handlers consumed by the UI bundles:
 *
 *   - expert-agents-list  → { agents: Array<{id, displayName, activeHires}> }
 *   - deliverables-list   → { deliverables: Array<{assignedAgent, planRef, ...}> }
 *   - inception-status    → { agentsTotal, agentsReady, finalizedAt, goalKpiId }
 *   - subscription-info   → { tier, status, currentPeriodEnd, expertAgentsHired }
 *
 * Data sources, in order of preference:
 *
 *   1. wavex-os op-omega-server (default http://127.0.0.1:3101) — fetches
 *      finalized manifest + handoff state. Works on the customer's local
 *      install OR an operator-side deployment.
 *
 *   2. Supabase RPCs (wavex_os_ops_*) — only when supabaseUrl +
 *      supabasePublishableKey are configured. Provides cross-customer
 *      aggregates (catalog hires) that the local server can't see alone.
 *
 * No writes. No third-party HTTP. The plugin is intentionally read-only —
 * any state-changing action requires the operator to use Paperclip's
 * native flows (issue creation, agent commands, etc.) so the plugin can
 * never get out of sync with the host.
 */
import { definePlugin, runWorker } from "@wavex-os/plugin-sdk-shim";

interface PluginConfig {
  wavexApiBase?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
}

const DEFAULT_WAVEX_BASE = "http://127.0.0.1:3101";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("WaveX plugin worker starting");

    // -------------------------------------------------------------------
    // expert-agents-list — reads catalog + hire counts from Supabase RPC
    //   (falls back to an empty list when supabase config is absent).
    // -------------------------------------------------------------------
    ctx.data.register("expert-agents-list", async () => {
      const cfg = (await ctx.config.get()) as PluginConfig | null;
      if (!cfg?.supabaseUrl || !cfg.supabasePublishableKey) {
        return { agents: [], source: "no-supabase-config" };
      }
      try {
        const r = await ctx.http.fetch(
          `${cfg.supabaseUrl}/rest/v1/rpc/wavex_os_ops_catalog_hire_counts`,
          {
            method: "POST",
            headers: {
              apikey: cfg.supabasePublishableKey,
              Authorization: `Bearer ${cfg.supabasePublishableKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          },
        );
        if (!r.ok) {
          ctx.logger.warn("ops_catalog_hire_counts RPC failed", { status: r.status });
          return { agents: [], source: "rpc-failed", status: r.status };
        }
        type Row = { catalog_id: string; display_name: string; active_hires: number };
        const data = (await r.json()) as Row[];
        return {
          agents: data.map((row) => ({
            id: row.catalog_id,
            displayName: row.display_name,
            activeHires: row.active_hires,
          })),
          source: "supabase",
        };
      } catch (err) {
        ctx.logger.error("expert-agents-list handler crashed", { err: String(err) });
        return { agents: [], source: "exception", error: String(err) };
      }
    });

    // -------------------------------------------------------------------
    // deliverables-list — recent deliverable_ledger rows from Supabase RPC
    //   (falls back to an empty list when supabase config is absent).
    // -------------------------------------------------------------------
    ctx.data.register("deliverables-list", async () => {
      const cfg = (await ctx.config.get()) as PluginConfig | null;
      if (!cfg?.supabaseUrl || !cfg.supabasePublishableKey) {
        return { deliverables: [], source: "no-supabase-config" };
      }
      try {
        const r = await ctx.http.fetch(
          `${cfg.supabaseUrl}/rest/v1/rpc/wavex_os_ops_deliverable_summary`,
          {
            method: "POST",
            headers: {
              apikey: cfg.supabasePublishableKey,
              Authorization: `Bearer ${cfg.supabasePublishableKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          },
        );
        if (!r.ok) {
          ctx.logger.warn("ops_deliverable_summary RPC failed", { status: r.status });
          return { deliverables: [], source: "rpc-failed", status: r.status };
        }
        type Row = {
          id: string;
          assigned_agent: string | null;
          plan_ref: string | null;
          expected_response: string | null;
          kind: string;
          status: string;
          issue_id: string | null;
          total_tokens: number;
        };
        const data = (await r.json()) as Row[];
        return {
          deliverables: data.map((row) => ({
            id: row.id,
            assignedAgent: row.assigned_agent,
            planRef: row.plan_ref,
            expectedResponse: row.expected_response,
            kind: row.kind,
            status: row.status,
            issueId: row.issue_id,
            totalTokens: row.total_tokens,
          })),
          source: "supabase",
        };
      } catch (err) {
        ctx.logger.error("deliverables-list handler crashed", { err: String(err) });
        return { deliverables: [], source: "exception", error: String(err) };
      }
    });

    // -------------------------------------------------------------------
    // inception-status — reads /api/companies/<id>/agents from op-omega
    //   server. Returns ready/total counts + manifest goal/signed_at.
    // -------------------------------------------------------------------
    ctx.data.register("inception-status", async ({ companyId }) => {
      const cfg = (await ctx.config.get()) as PluginConfig | null;
      const base = cfg?.wavexApiBase ?? DEFAULT_WAVEX_BASE;
      try {
        const r = await ctx.http.fetch(
          `${base}/api/companies/${encodeURIComponent(String(companyId))}/agents`,
        );
        if (!r.ok) {
          return {
            agentsTotal: 0,
            agentsReady: 0,
            source: "wavex-api-error",
            status: r.status,
          };
        }
        const list = (await r.json()) as Array<{ slot: string; status: string }>;
        const ready = list.filter(
          (a) => a.status === "active" || a.status === "ready" || a.status === "idle",
        ).length;
        return {
          agentsTotal: list.length,
          agentsReady: ready,
          source: "wavex-api",
        };
      } catch (err) {
        return {
          agentsTotal: 0,
          agentsReady: 0,
          source: "exception",
          error: String(err),
        };
      }
    });

    // -------------------------------------------------------------------
    // subscription-info — looks at the subscriptions table + hire count.
    // -------------------------------------------------------------------
    ctx.data.register("subscription-info", async () => {
      const cfg = (await ctx.config.get()) as PluginConfig | null;
      if (!cfg?.supabaseUrl || !cfg.supabasePublishableKey) {
        return { configured: false };
      }
      try {
        const [hireRes, lastWebhookRes] = await Promise.all([
          ctx.http.fetch(
            `${cfg.supabaseUrl}/rest/v1/rpc/wavex_os_ops_catalog_hire_counts`,
            {
              method: "POST",
              headers: {
                apikey: cfg.supabasePublishableKey,
                Authorization: `Bearer ${cfg.supabasePublishableKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            },
          ),
          ctx.http.fetch(
            `${cfg.supabaseUrl}/rest/v1/rpc/wavex_os_ops_last_webhook_at`,
            {
              method: "POST",
              headers: {
                apikey: cfg.supabasePublishableKey,
                Authorization: `Bearer ${cfg.supabasePublishableKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            },
          ),
        ]);
        type HireRow = { catalog_id: string; active_hires: number };
        type WebhookRow = { processed_at: string; type: string };
        const hires = hireRes.ok ? ((await hireRes.json()) as HireRow[]) : [];
        const webhook = lastWebhookRes.ok
          ? ((await lastWebhookRes.json()) as WebhookRow[])
          : [];
        return {
          configured: true,
          expertAgentsHired: hires.reduce((acc, h) => acc + (h.active_hires ?? 0), 0),
          lastStripeWebhookAt: webhook[0]?.processed_at ?? null,
          lastStripeWebhookType: webhook[0]?.type ?? null,
        };
      } catch (err) {
        return { configured: true, error: String(err) };
      }
    });
  },

  async onHealth() {
    return {
      status: "ok",
      message: "WaveX plugin worker idle (read-only data handlers registered)",
    };
  },

  async onValidateConfig(config: Record<string, unknown>) {
    const cfg = config as PluginConfig;
    const errors: string[] = [];
    if (cfg.supabaseUrl && !cfg.supabasePublishableKey) {
      errors.push("Supabase URL is set but publishable key is missing.");
    }
    if (cfg.supabasePublishableKey?.startsWith("sb_service_")) {
      errors.push(
        "Refusing a service-role key. Use a publishable/anon key instead — the worker only needs RPC read access.",
      );
    }
    return errors.length > 0 ? { ok: false, errors } : { ok: true };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
