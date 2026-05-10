/** Credential Concierge routes.
 *
 *  Walks the operator through configuring each connector recommended by
 *  Phase 2. Backed by the AES-GCM vault (src/vault/) and the per-connector
 *  test probes (src/vault/probes.ts).
 *
 *  Endpoints:
 *    GET  /op-omega/onboarding/credentials/:companyId
 *           Returns recommended connectors merged with vault state.
 *    POST /op-omega/onboarding/credentials/paste
 *           { companyId, connectorId, key, plaintext } — vault-encrypts
 *    POST /op-omega/onboarding/credentials/test
 *           { companyId, connectorId } — runs the connector probe
 *    POST /op-omega/onboarding/credentials/skip
 *           { companyId, connectorId, reason } — marks as skipped */

import { z } from "zod";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  generateConnectorManifest, loadPillarResponses,
  isOnboardingHaltError,
  type ConnectorEntry,
} from "@op-omega/plugin-onboarding";
import { listConnections } from "@wavex-os/composio-shim";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { listConnectorStates, writeCredential, recordTestResult, skipConnector } from "../vault/service.js";
import { runProbe, hasProbe } from "../vault/probes.js";

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

function gateBoard(req: FastifyRequest, reply: FastifyReply): boolean {
  const ar = authReq(req);
  try { assertBoard(ar); return true; }
  catch (e) {
    if (e instanceof AuthError) { reply.status(e.statusCode).send({ error: e.message }); return false; }
    throw e;
  }
}

const pasteSchema = z.object({
  companyId: z.string().min(1),
  connectorId: z.string().min(1),
  key: z.string().min(1).max(120),
  plaintext: z.string().min(1).max(8192),
  writtenBy: z.string().max(40).optional(),
});

const testSchema = z.object({
  companyId: z.string().min(1),
  connectorId: z.string().min(1),
});

const skipSchema = z.object({
  companyId: z.string().min(1),
  connectorId: z.string().min(1),
  reason: z.string().min(3).max(500),
});

/** Merge Phase-2 recommendations with vault state into a single per-connector
 *  view the UI can render. */
interface ConciergeRow {
  connectorId: string;
  bucket: "required" | "suggested" | "deferred";
  priority: string;
  rationale: string;
  status: "vaulted_valid" | "vaulted_unvalidated" | "skipped" | "pending";
  vaultedKeys: string[];
  expectedKeys: string[];
  hasProbe: boolean;
  lastTestedAt: string | null;
  lastTestResult: { ok: boolean; detail?: string } | null;
  skipReason: string | null;
  composioManaged: boolean;
}

/** Per-connector schema of expected vault keys + whether Composio handles
 *  the OAuth handshake. Direct-key connectors expose paste fields; Composio
 *  ones surface the OAuth init button. */
const CONNECTOR_KEY_SCHEMA: Record<string, { keys: string[]; composio: boolean }> = {
  // Already-configured upstream
  "claude-code":     { keys: [],                            composio: false },

  // Direct-key (paste vault flow) — comms / inference / data substrate
  supabase:          { keys: ["url", "anon_key"],           composio: false },
  github:            { keys: ["pat"],                       composio: false },
  telegram:          { keys: ["telegram_bot_token", "telegram_chat_id"], composio: false },
  whatsapp:          { keys: ["business_account_id", "access_token"], composio: false },
  "twilio-sms":      { keys: ["account_sid", "auth_token", "from_number"], composio: false },
  sendgrid:          { keys: ["api_key"],                   composio: false },
  anthropic:         { keys: ["api_key"],                   composio: false },
  openai:            { keys: ["api_key"],                   composio: false },
  mixpanel:          { keys: ["project_token", "service_account_secret"], composio: false },
  amplitude:         { keys: ["api_key", "secret_key"],     composio: false },
  posthog:           { keys: ["host", "project_api_key", "personal_api_key"], composio: false },
  segment:           { keys: ["write_key"],                 composio: false },

  // Commerce direct-key
  stripe:            { keys: ["secret_key"],                composio: false },
  "stripe-connect":  { keys: ["secret_key", "platform_account_id"], composio: false },
  shopify:           { keys: ["shop_domain", "admin_api_token"], composio: false },
  bigcommerce:       { keys: ["store_hash", "access_token"], composio: false },
  shipstation:       { keys: ["api_key", "api_secret"],     composio: false },
  klaviyo:           { keys: ["private_api_key"],           composio: false },

  // Vertical
  plaid:             { keys: ["client_id", "secret"],       composio: false },
  docusign:          { keys: ["integration_key", "user_id", "account_id"], composio: false },
  clio:              { keys: ["client_id", "client_secret"], composio: false },

  // Ads APIs
  "meta-ads-api":    { keys: ["access_token", "ad_account_id"], composio: false },
  "google-ads-api":  { keys: ["developer_token", "customer_id", "refresh_token"], composio: false },
  "linkedin-sales-nav": { keys: ["access_token"],           composio: false },

  // Composio-managed (OAuth via Composio when COMPOSIO_API_KEY present)
  slack:             { keys: [],                            composio: true },
  discord:           { keys: [],                            composio: true },
  gmail:             { keys: [],                            composio: true },
  hubspot:           { keys: [],                            composio: true },
  salesforce:        { keys: [],                            composio: true },
  intercom:          { keys: [],                            composio: true },
  zendesk:           { keys: [],                            composio: true },
  notion:            { keys: [],                            composio: true },
  airtable:          { keys: [],                            composio: true },
  linear:            { keys: [],                            composio: true },
  calendly:          { keys: [],                            composio: true },
  google_calendar:   { keys: [],                            composio: true },
  google_drive:      { keys: [],                            composio: true },
};

function describeConnector(id: string): { keys: string[]; composio: boolean } {
  return CONNECTOR_KEY_SCHEMA[id] ?? { keys: [], composio: false };
}

export function registerCredentialRoutes(app: FastifyInstance): void {
  app.get("/op-omega/onboarding/credentials/:companyId", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(authReq(req), companyId);

    const responses = await loadPillarResponses(companyId).catch(() => null);
    if (!responses) return reply.status(404).send({ error: "no pillar responses for this company" });

    let manifest;
    try {
      const live = await listConnections(companyId);
      const r = await generateConnectorManifest({
        companyId, responses, skipInference: true, liveConnections: live,
      });
      manifest = r.manifest;
    } catch (e) {
      if (isOnboardingHaltError(e)) {
        return reply.status(409).send({ ok: false, halt: e.toJSON() });
      }
      throw e;
    }

    const states = await listConnectorStates(companyId);
    const merged: ConciergeRow[] = [];
    const buckets: Array<{ bucket: "required" | "suggested" | "deferred"; entries: ConnectorEntry[] }> = [
      { bucket: "required", entries: manifest.required },
      { bucket: "suggested", entries: manifest.suggested },
      { bucket: "deferred", entries: manifest.deferred },
    ];
    for (const b of buckets) {
      for (const e of b.entries) {
        const desc = describeConnector(e.id);
        const s = states.get(e.id);
        merged.push({
          connectorId: e.id,
          bucket: b.bucket,
          priority: e.priority,
          rationale: e.rationale,
          status: s?.status ?? "pending",
          vaultedKeys: s?.vaultedKeys ?? [],
          expectedKeys: desc.keys,
          hasProbe: hasProbe(e.id),
          lastTestedAt: s?.lastTestedAt ?? null,
          lastTestResult: s?.lastTestResult ?? null,
          skipReason: s?.skipReason ?? null,
          composioManaged: desc.composio,
        });
      }
    }

    const requiredCount = merged.filter((m) => m.bucket === "required").length;
    const requiredReady = merged.filter((m) =>
      m.bucket === "required" &&
      (m.status === "vaulted_valid" || m.status === "vaulted_unvalidated" || m.status === "skipped"
       || (m.connectorId === "claude-code")), // claude-code verified during Pillar 2
    ).length;

    return {
      ok: true,
      companyId,
      connectors: merged,
      progress: { requiredCount, requiredReady, allRequiredAddressed: requiredReady >= requiredCount },
    };
  });

  app.post("/op-omega/onboarding/credentials/paste", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = pasteSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(authReq(req), parsed.data.companyId);
    const r = await writeCredential({
      companyId: parsed.data.companyId,
      connectorId: parsed.data.connectorId,
      key: parsed.data.key,
      plaintext: parsed.data.plaintext,
      writtenBy: parsed.data.writtenBy ?? "concierge_paste",
    });
    return { ok: true, vaultedAt: r.vaultedAt };
  });

  app.post("/op-omega/onboarding/credentials/test", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = testSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(authReq(req), parsed.data.companyId);
    const result = await runProbe(parsed.data.connectorId, parsed.data.companyId);
    // Record per-key (use "default" when probe doesn't single out a key).
    await recordTestResult({
      companyId: parsed.data.companyId,
      connectorId: parsed.data.connectorId,
      key: "default",
      ok: result.ok,
      detail: result.detail,
    });
    return { ok: result.ok, detail: result.detail };
  });

  app.post("/op-omega/onboarding/credentials/skip", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = skipSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(authReq(req), parsed.data.companyId);
    await skipConnector({
      companyId: parsed.data.companyId,
      connectorId: parsed.data.connectorId,
      reason: parsed.data.reason,
    });
    return { ok: true };
  });
}
