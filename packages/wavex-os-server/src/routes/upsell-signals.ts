/** Upsell signal evaluation + event writers (WAVAAAA-71).
 *
 *  POST /api/upsell-signals/evaluate
 *    Receives the current metric snapshot for a partner, evaluates all three
 *    upsell signal conditions, writes a row to wavex_os.upsell_signals for
 *    each signal that fires, and sets design_partners.expansion_eligible=true
 *    on the first signal fire.
 *
 *  Signal thresholds (confirmed in WAVAAAA-30 plan, 2026-05-17):
 *    upsell.volume    — test_run_count_30d > 50
 *    upsell.expansion — app_count >= 2
 *    upsell.health    — ci_pass_rate_7d > 80  (percent, 0–100)
 *
 *  GET /api/upsell-signals/:partnerId
 *    Returns all fired signals for a partner (dedup / audit use). */

import { z } from "zod";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";

// ─── thresholds ────────────────────────────────────────────────────────────

const VOLUME_THRESHOLD = 50;    // test-runs / 30 days
const HEALTH_THRESHOLD = 80;    // CI pass rate %, 7-day window

// ─── zod schema ────────────────────────────────────────────────────────────

const evaluateSchema = z.object({
  companyId:           z.string().min(1),
  partner_id:          z.string().min(1),
  partner_name:        z.string().min(1),
  test_run_count_30d:  z.number().int().nonnegative(),
  app_count:           z.number().int().nonnegative(),
  /** 0–100 percentage. Pass null / omit if CI data is unavailable. */
  ci_pass_rate_7d:     z.number().min(0).max(100).nullable().default(null),
});

type EvaluateInput = z.infer<typeof evaluateSchema>;

type SignalType = "upsell.volume" | "upsell.expansion" | "upsell.health";

interface FiredSignal {
  signal_type: SignalType;
  context_json: Record<string, unknown>;
}

// ─── signal evaluation (pure, no I/O) ────────────────────────────────────

export function evaluateSignals(input: EvaluateInput): FiredSignal[] {
  const fired: FiredSignal[] = [];

  if (input.test_run_count_30d > VOLUME_THRESHOLD) {
    fired.push({
      signal_type: "upsell.volume",
      context_json: {
        test_run_count_30d: input.test_run_count_30d,
        threshold: VOLUME_THRESHOLD,
      },
    });
  }

  if (input.app_count >= 2) {
    fired.push({
      signal_type: "upsell.expansion",
      context_json: { app_count: input.app_count },
    });
  }

  if (input.ci_pass_rate_7d !== null && input.ci_pass_rate_7d > HEALTH_THRESHOLD) {
    fired.push({
      signal_type: "upsell.health",
      context_json: {
        ci_pass_rate_7d: input.ci_pass_rate_7d,
        threshold: HEALTH_THRESHOLD,
      },
    });
  }

  return fired;
}

// ─── Supabase writes ───────────────────────────────────────────────────────

interface UpsellSignalRow {
  partner_id: string;
  signal_type: SignalType;
  fired_at: string;
  context_json: Record<string, unknown>;
}

async function writeUpsellSignal(row: UpsellSignalRow): Promise<{ id: string } | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[upsell-signals] Supabase not configured — signal not persisted");
    return null;
  }
  const res = await fetch(`${url}/rest/v1/upsell_signals?schema=wavex_os`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      "Accept-Profile": "wavex_os",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[upsell-signals] DB write failed (${row.signal_type}): ${res.status} ${detail}`);
    return null;
  }
  const [record] = (await res.json().catch(() => [])) as Array<{ id: string }>;
  return record ?? null;
}

async function upsertDesignPartner(partner_id: string, partner_name: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const res = await fetch(`${url}/rest/v1/design_partners?schema=wavex_os`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=representation",
      "Accept-Profile": "wavex_os",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ partner_id, partner_name, expansion_eligible: true }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[upsell-signals] design_partners upsert failed: ${res.status} ${detail}`);
    return false;
  }
  return true;
}

// ─── Paperclip CRO/EXPANSION handoff ─────────────────────────────────────

export interface ExpansionIssueParams {
  partner_id: string;
  partner_name: string;
  signal_type: SignalType;
  context_json: Record<string, unknown>;
  /** Full evaluate input snapshot for body enrichment. */
  snapshot: EvaluateInput;
}

function buildIssueBody(p: ExpansionIssueParams): string {
  const ctx = JSON.stringify(p.context_json, null, 2);
  const ci = p.snapshot.ci_pass_rate_7d !== null ? `${p.snapshot.ci_pass_rate_7d}%` : "N/A";
  return [
    `## Expansion Opportunity`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| Partner | ${p.partner_name} |`,
    `| Partner ID | ${p.partner_id} |`,
    `| Signal | \`${p.signal_type}\` |`,
    `| Apps connected | ${p.snapshot.app_count} |`,
    `| Test-runs (30d) | ${p.snapshot.test_run_count_30d} |`,
    `| CI pass rate (7d) | ${ci} |`,
    ``,
    `## Signal context`,
    `\`\`\`json`,
    ctx,
    `\`\`\``,
    ``,
    `---`,
    `*Auto-created by upsell signal workflow (WAVAAAA-74).*`,
  ].join("\n");
}

export async function createExpansionIssue(
  p: ExpansionIssueParams,
): Promise<{ issue_id: string; identifier: string } | null> {
  const paperclipUrl = process.env.PAPERCLIP_HANDOFF_URL?.replace(/\/+$/, "");
  const apiKey = process.env.PAPERCLIP_OPS_API_KEY;
  const companyId = process.env.PAPERCLIP_OPS_COMPANY_ID;
  const agentId = process.env.PAPERCLIP_OPS_EXPANSION_AGENT_ID;

  if (!paperclipUrl || !apiKey || !companyId || !agentId) {
    console.warn("[upsell-signals] Paperclip handoff env vars not set — issue creation skipped");
    return null;
  }

  const body: Record<string, unknown> = {
    title: `[EXPANSION] ${p.partner_name} — ${p.signal_type} opportunity`,
    description: buildIssueBody(p),
    priority: "high",
    assigneeAgentId: agentId,
  };
  const parentId = process.env.PAPERCLIP_OPS_EXPANSION_PARENT_ISSUE_ID;
  const goalId = process.env.PAPERCLIP_OPS_EXPANSION_GOAL_ID;
  if (parentId) body.parentId = parentId;
  if (goalId) body.goalId = goalId;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(`${paperclipUrl}/api/companies/${companyId}/issues`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[upsell-signals] Paperclip issue creation failed: ${res.status} ${detail}`);
      return null;
    }
    const data = (await res.json().catch(() => null)) as { id?: string; identifier?: string } | null;
    if (!data?.id || !data?.identifier) {
      console.error("[upsell-signals] Paperclip issue response missing id/identifier");
      return null;
    }
    return { issue_id: data.id, identifier: data.identifier };
  } catch (e) {
    console.error(`[upsell-signals] Paperclip issue creation error: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

// ─── route helpers ─────────────────────────────────────────────────────────

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

// ─── routes ────────────────────────────────────────────────────────────────

export function registerUpsellSignalsRoutes(app: FastifyInstance): void {
  app.post("/api/upsell-signals/evaluate", async (req: FastifyRequest, reply: FastifyReply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }

    const parsed = evaluateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    }
    assertCompanyAccess(ar, parsed.data.companyId);

    const input = parsed.data;
    const fired = evaluateSignals(input);
    const fired_at = new Date().toISOString();

    if (fired.length === 0) {
      return { ok: true, signals_fired: [], expansion_eligible_set: false };
    }

    // Write all signals in parallel; set partner expansion_eligible; create Paperclip issues.
    const [signalResults, , paperclipResults] = await Promise.all([
      Promise.all(
        fired.map((s) =>
          writeUpsellSignal({
            partner_id: input.partner_id,
            signal_type: s.signal_type,
            fired_at,
            context_json: s.context_json,
          }),
        ),
      ),
      upsertDesignPartner(input.partner_id, input.partner_name),
      Promise.all(
        fired.map((s) =>
          createExpansionIssue({
            partner_id: input.partner_id,
            partner_name: input.partner_name,
            signal_type: s.signal_type,
            context_json: s.context_json,
            snapshot: input,
          }),
        ),
      ),
    ]);

    const persisted = signalResults.some((r) => r !== null);

    return {
      ok: true,
      signals_fired: fired.map((s, i) => ({
        signal_type: s.signal_type,
        context_json: s.context_json,
        persisted: signalResults[i] !== null,
        signal_id: signalResults[i]?.id ?? null,
        paperclip_issue: paperclipResults[i] ?? null,
      })),
      expansion_eligible_set: true,
      fired_at,
      persisted,
    };
  });

  app.get(
    "/api/upsell-signals/:partnerId",
    async (req: FastifyRequest<{ Params: { partnerId: string } }>, reply: FastifyReply) => {
      const ar = authReq(req);
      try { assertBoard(ar); } catch (e) {
        if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
        throw e;
      }

      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        return reply.status(503).send({ ok: false, error: "Supabase not configured" });
      }

      const { partnerId } = req.params;
      const res = await fetch(
        `${url}/rest/v1/upsell_signals?schema=wavex_os&partner_id=eq.${encodeURIComponent(partnerId)}&order=fired_at.desc`,
        { headers: { "Accept-Profile": "wavex_os", apikey: key, Authorization: `Bearer ${key}` } },
      );
      if (!res.ok) {
        return reply.status(502).send({ ok: false, error: `Supabase ${res.status}` });
      }
      const rows = (await res.json().catch(() => [])) as unknown[];
      return { ok: true, signals: rows };
    },
  );
}
