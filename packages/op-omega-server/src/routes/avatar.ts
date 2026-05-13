/** Avatar onboarding routes — the 5-step personal-AI track:
 *    POST /op-omega/onboarding/avatar                  → create
 *    POST /op-omega/onboarding/avatar/:id/tools        → record mock connect
 *    POST /op-omega/onboarding/avatar/:id/voice        → save samples + analyze
 *    GET  /op-omega/onboarding/avatar/:id/suggestions  → rule-based automations
 *    POST /op-omega/onboarding/avatar/:id/finalize     → enable picked automations
 *    GET  /api/avatar/:id                              → dashboard read
 *
 *  Data lives at ~/.wavex-os/instances/default/avatars/<id>/ in plain JSON
 *  files. Mock OAuth: tool connects always record status="stub" until v2
 *  wires real Composio. Voice analysis goes through tier-router (skipped
 *  under skipInference=true, returns a deterministic stub). */

import { z } from "zod";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { route as tierRoute } from "@op-omega/plugin-tier-router";
import { assertBoard, AuthError } from "@wavex-os/auth-shim";
import { withTokenAccounting } from "../lib/token-accounting.js";
import { handoffAvatarToPaperclip } from "../bridge/avatar-handoff.js";
import { runGmailTriage } from "../avatar/runners/gmail-triage.js";

// ── Storage helpers ──────────────────────────────────────────────────────

interface AvatarProfile {
  name: string;
  role: string;
  working_hours: [string, string];
  tz: string;
  created_at: string;
}

interface ToolConnection {
  provider: string;
  ref: string;
  status: "stub" | "connected";
  connected_at: string;
}

interface VoiceProfile {
  tone: string;
  formality: string;
  structure: string;
  delegates: string[];
}

interface VoiceFile {
  samples: string[];
  profile?: VoiceProfile;
  analyzed_at?: string;
  source?: "t2" | "stub";
  // Phase 3 additions — operator-supplied verbatim, not T2-derived.
  signoff?: string;
  guardrails?: string[];
}

interface AutomationSuggestion {
  id: string;
  title: string;
  body: string;
  needs: string[];
}

interface AutomationsFile {
  enabled: string[];
  suggested: AutomationSuggestion[];
}

function avatarRoot(): string {
  const root = process.env.WAVEX_OS_STATE_DIR ?? join(homedir(), ".wavex-os");
  return join(root, "instances", "default", "avatars");
}

function avatarDir(id: string): string {
  return join(avatarRoot(), id);
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function newAvatarId(name: string): string {
  const slug = slugify(name) || "avatar";
  const hash = randomBytes(2).toString("hex");
  return `${slug}-${hash}`;
}

// ── Rule table for first-automation suggestions ──────────────────────────

const SUGGESTION_RULES: AutomationSuggestion[] = [
  {
    id: "meeting-prep",
    title: "Meeting prep brief",
    body: "30 min before each calendar event, pull recent Gmail context from the attendees.",
    needs: ["gmail", "google_calendar"],
  },
  {
    id: "slack-notion-digest",
    title: "Daily Slack → Notion digest",
    body: "Summarize today's Slack threads into your Notion daily note at end of day.",
    needs: ["slack", "notion"],
  },
  {
    id: "linear-github-link",
    title: "Link Linear tickets to PRs",
    body: "Auto-link GitHub PRs that reference Linear ticket IDs in the description.",
    needs: ["linear", "github"],
  },
  {
    id: "inbox-triage",
    title: "Triage inbox into priority lanes",
    body: "Sort incoming email into Now / Soon / FYI based on your voice profile.",
    needs: ["gmail"],
  },
  {
    id: "crm-sync",
    title: "Sync CRM contact updates",
    body: "When a contact replies to email, mirror status changes back to HubSpot.",
    needs: ["hubspot", "gmail"],
  },
  {
    id: "sms-alerts",
    title: "Urgent SMS alerts for VIPs",
    body: "When a flagged contact emails or messages, send an SMS digest via Twilio.",
    needs: ["twilio_sms", "gmail"],
  },
];

/** Phase 3 — trust-aware suggestions. If the operator flagged VIPs during
 *  the Trust step AND Gmail is connected, a personalized "Triage VIP inbox"
 *  suggestion bubbles to the top with the VIP names cited verbatim. Other
 *  rules degrade gracefully when trust is absent (matches Phase 2 behavior). */
function suggestionsFor(
  connectedProviders: string[],
  trust?: { vips?: Array<{ email: string; label?: string }> } | null,
): AutomationSuggestion[] {
  const set = new Set(connectedProviders);
  const base = SUGGESTION_RULES.filter((rule) => rule.needs.every((n) => set.has(n)));
  const vipNames = (trust?.vips ?? []).slice(0, 2).map((v) => v.label || v.email).filter(Boolean);
  if (vipNames.length > 0 && set.has("gmail")) {
    const personalized: AutomationSuggestion = {
      id: "vip-triage",
      title: "Triage VIP inbox",
      body: `Hold mail from ${vipNames.join(", ")} to Now and draft replies in your voice. Lower-confidence drafts still queue for approval.`,
      needs: ["gmail"],
    };
    // De-dupe vs the generic inbox-triage rule so we don't show both.
    const filtered = base.filter((r) => r.id !== "inbox-triage");
    return [personalized, ...filtered].slice(0, 3);
  }
  return base.slice(0, 3);
}

// ── Intro parsing (welcome hero T2) ──────────────────────────────────────

interface ProfilePrefill {
  name?: string;
  role?: string;
  working_hours?: [string, string];
  tz?: string;
}

const STUB_PROFILE_PREFILL: ProfilePrefill = {
  name: "Operator",
  role: "Founder",
  working_hours: ["09:00", "17:00"],
  tz: "America/New_York",
};

/** Parse a free-text intro ("I'm Dylan, founder, work 9-5 EST, hand off
 *  email triage…") into the four AvatarProfileCard fields via T2. Stub
 *  fallback for fast-mode and any T2 parse failure. No persistence — the
 *  avatar isn't created until the operator confirms the profile card. */
async function parseIntro(rawIntro: string, skipInference: boolean): Promise<{ profile: ProfilePrefill; source: "t2" | "stub" }> {
  if (skipInference || rawIntro.trim().length < 4) {
    return { profile: STUB_PROFILE_PREFILL, source: "stub" };
  }
  const prompt = `You extract an operator's personal profile from a free-text intro they wrote about themselves.

Intro:
${rawIntro}

Return JSON only, no commentary. Use these field rules:
- "name": first name only, or null if not stated.
- "role": short title like "Founder", "VP Sales", "Eng Manager". Null if not stated.
- "working_hours": ["HH:MM","HH:MM"] in 24h. If they say "9-5" map to ["09:00","17:00"]. Null if not stated.
- "tz": IANA timezone like "America/New_York". Map "EST"/"ET" → "America/New_York", "PST"/"PT" → "America/Los_Angeles", "CT" → "America/Chicago", "MT" → "America/Denver", "GMT"/"UTC" → "UTC". Null if not stated.

Exact shape:
{
  "name": "<string or null>",
  "role": "<string or null>",
  "working_hours": ["HH:MM","HH:MM"] | null,
  "tz": "<IANA tz or null>"
}`;
  try {
    const text = await withTokenAccounting("avatar.parse", "avatar_intro", async () => {
      const resp = await tierRoute({
        agent_id: "onboarding.avatar-intro",
        prompt,
        task_metadata: {
          creativity_required: false,
          customer_facing: false,
          reasoning_depth: "shallow",
          priority: "high",
        },
        companyId: "avatar.parse",
        outputFormat: "json",
        timeout_ms: 20_000,
      });
      return resp.output.trim();
    });
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned) as {
      name?: string | null;
      role?: string | null;
      working_hours?: [string, string] | null;
      tz?: string | null;
    };
    const profile: ProfilePrefill = {};
    if (parsed.name) profile.name = parsed.name;
    if (parsed.role) profile.role = parsed.role;
    if (Array.isArray(parsed.working_hours) && parsed.working_hours.length === 2) {
      profile.working_hours = parsed.working_hours;
    }
    if (parsed.tz) profile.tz = parsed.tz;
    return { profile, source: "t2" };
  } catch {
    return { profile: STUB_PROFILE_PREFILL, source: "stub" };
  }
}

// ── Voice analysis ───────────────────────────────────────────────────────

const STUB_VOICE_PROFILE: VoiceProfile = {
  tone: "balanced",
  formality: "casual",
  structure: "lists",
  delegates: ["scheduling"],
};

async function analyzeVoice(avatarId: string, samples: string[], skipInference: boolean): Promise<{ profile: VoiceProfile; source: "t2" | "stub" }> {
  if (skipInference || samples.every((s) => s.trim().length < 20)) {
    return { profile: STUB_VOICE_PROFILE, source: "stub" };
  }
  const prompt = `You analyze how an operator writes and works so a personal AI avatar can mirror their style.

Three samples from the operator:
1) A recent email they wrote:
${samples[0]}

2) How they take notes:
${samples[1]}

3) The first task they'd hand off if they had a clone:
${samples[2]}

Return JSON only, no commentary, with this exact shape:
{
  "tone": "<one-word descriptor like technical|warm|direct|playful|authoritative>",
  "formality": "<casual|balanced|formal>",
  "structure": "<lists|prose|hybrid>",
  "delegates": [<2-4 lowercase short tokens describing first delegations, e.g. "scheduling", "follow-ups", "drafting">]
}`;
  try {
    const text = await withTokenAccounting(avatarId, "avatar_voice", async () => {
      const resp = await tierRoute({
        agent_id: "onboarding.avatar-voice",
        prompt,
        task_metadata: {
          creativity_required: false,
          customer_facing: false,
          reasoning_depth: "shallow",
          priority: "batch",
        },
        companyId: avatarId,
        outputFormat: "json",
        timeout_ms: 30_000,
      });
      return resp.output.trim();
    });
    // Tolerate fenced output.
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<VoiceProfile>;
    return {
      profile: {
        tone: parsed.tone ?? STUB_VOICE_PROFILE.tone,
        formality: parsed.formality ?? STUB_VOICE_PROFILE.formality,
        structure: parsed.structure ?? STUB_VOICE_PROFILE.structure,
        delegates: parsed.delegates ?? STUB_VOICE_PROFILE.delegates,
      },
      source: "t2",
    };
  } catch {
    return { profile: STUB_VOICE_PROFILE, source: "stub" };
  }
}

// ── Schemas ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(80),
  role: z.string().min(1).max(120),
  workingHours: z.tuple([z.string().regex(/^\d{2}:\d{2}$/), z.string().regex(/^\d{2}:\d{2}$/)]),
  tz: z.string().min(1).max(60),
});

const connectToolSchema = z.object({
  provider: z.enum(["gmail", "google_calendar", "slack", "notion", "linear", "github", "twilio_sms", "hubspot"]),
});

// Per-provider personalization captured by the onboarding drawer (Phase 3).
// All fields optional — keeps the drawer skippable. `vips` and
// `privacy_zones` are free-form chips (emails, domains, label names);
// `signoff` is a 1-line sig that the runner appends to drafts.
const toolMetaSchema = z.object({
  vips: z.array(z.string().max(120)).max(20).optional(),
  privacy_zones: z.array(z.string().max(120)).max(20).optional(),
  signoff: z.string().max(120).optional(),
});

const parseIntroSchema = z.object({
  raw_intro: z.string().min(1).max(2000),
  skipInference: z.boolean().optional(),
});

const voiceSchema = z.object({
  samples: z.tuple([z.string().max(2000), z.string().max(2000), z.string().max(2000)]),
  skipInference: z.boolean().optional(),
  // Phase 3 — verbatim operator inputs, no T2 transform.
  signoff: z.string().max(120).optional(),
  guardrails: z.array(z.string().max(120)).max(8).optional(),
});

const finalizeSchema = z.object({
  enabledAutomationIds: z.array(z.string()).default([]),
});

// Phase 3 — Trust & boundaries step. Captures autonomy preset, VIP table,
// privacy zones, and notification preferences. Written to trust.json.
// The runner reads this defensively (absent → existing behavior).
const trustSchema = z.object({
  autonomy_preset: z.enum(["cautious", "balanced", "aggressive"]),
  vips: z.array(z.object({
    email: z.string().min(1).max(160),
    label: z.string().max(60).optional(),
  })).max(50).default([]),
  privacy_zones: z.array(z.string().max(120)).max(20).default([]),
  notify: z.array(z.enum(["now_drafts", "low_confidence", "skill_paused", "daily_digest"])).max(4).default([]),
});

interface TrustFile {
  autonomy_preset: "cautious" | "balanced" | "aggressive";
  vips: Array<{ email: string; label?: string }>;
  privacy_zones: string[];
  notify: string[];
  set_at: string;
}

// ── Auth helper ──────────────────────────────────────────────────────────

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

function gateBoard(req: FastifyRequest, reply: import("fastify").FastifyReply): boolean {
  try {
    assertBoard(authReq(req));
    return true;
  } catch (e) {
    if (e instanceof AuthError) {
      void reply.status(e.statusCode).send({ error: e.message });
      return false;
    }
    throw e;
  }
}

// ── Route registration ───────────────────────────────────────────────────

export function registerAvatarRoutes(app: FastifyInstance): void {
  // Welcome-hero free-text parse. Pre-fills the AvatarProfileCard.
  // No persistence — the avatar is created when the operator submits
  // the profile card. Always returns a profile shape (T2 → stub fallback).
  app.post("/op-omega/onboarding/avatar/parse", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = parseIntroSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    const { profile, source } = await parseIntro(parsed.data.raw_intro, parsed.data.skipInference === true);
    return { ok: true, profile, source };
  });

  // Create avatar
  app.post("/op-omega/onboarding/avatar", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    const id = newAvatarId(parsed.data.name);
    const dir = avatarDir(id);
    if (existsSync(dir)) return reply.status(409).send({ error: "avatar id collision; retry" });
    const profile: AvatarProfile = {
      name: parsed.data.name,
      role: parsed.data.role,
      working_hours: parsed.data.workingHours,
      tz: parsed.data.tz,
      created_at: new Date().toISOString(),
    };
    await writeJson(join(dir, "profile.json"), profile);
    await writeJson(join(dir, "tools.json"), { connected: [] as ToolConnection[], skipped: false });
    await writeJson(join(dir, "voice.json"), { samples: ["", "", ""] } satisfies VoiceFile);
    await writeJson(join(dir, "automations.json"), { enabled: [], suggested: [] } satisfies AutomationsFile);
    return { ok: true, avatarId: id };
  });

  // Record a (mock) tool connection
  app.post<{ Params: { id: string } }>("/op-omega/onboarding/avatar/:id/tools", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const id = req.params.id;
    const dir = avatarDir(id);
    if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
    const parsed = connectToolSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    const tools = (await readJson<{ connected: ToolConnection[]; skipped: boolean }>(join(dir, "tools.json")))
      ?? { connected: [], skipped: false };
    const without = tools.connected.filter((c) => c.provider !== parsed.data.provider);
    const next: ToolConnection = {
      provider: parsed.data.provider,
      ref: `stub_${randomBytes(4).toString("hex")}`,
      status: "stub",
      connected_at: new Date().toISOString(),
    };
    const connected = [...without, next];
    await writeJson(join(dir, "tools.json"), { connected, skipped: false });
    return { ok: true, connected, total: 8 };
  });

  // Per-provider personalization (Phase 3 drawer). Writes
  // tools.json.meta[provider] = { vips?, privacy_zones?, signoff? }.
  // The runner reads this at triage time; absent → existing behavior.
  app.post<{ Params: { id: string; provider: string } }>(
    "/op-omega/onboarding/avatar/:id/tools/:provider/meta",
    async (req, reply) => {
      if (!gateBoard(req, reply)) return;
      const id = req.params.id;
      const dir = avatarDir(id);
      if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
      const parsed = toolMetaSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
      const tools = (await readJson<{
        connected: ToolConnection[]; skipped: boolean;
        meta?: Record<string, { vips?: string[]; privacy_zones?: string[]; signoff?: string }>;
      }>(join(dir, "tools.json"))) ?? { connected: [], skipped: false };
      const meta = { ...(tools.meta ?? {}) };
      meta[req.params.provider] = {
        ...(meta[req.params.provider] ?? {}),
        ...parsed.data,
      };
      await writeJson(join(dir, "tools.json"), { ...tools, meta });
      return { ok: true, provider: req.params.provider, meta: meta[req.params.provider] };
    },
  );

  // Save voice samples + (optionally) run T2 analysis
  app.post<{ Params: { id: string } }>("/op-omega/onboarding/avatar/:id/voice", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const id = req.params.id;
    const dir = avatarDir(id);
    if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
    const parsed = voiceSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    const { profile, source } = await analyzeVoice(id, parsed.data.samples, parsed.data.skipInference === true);
    const out: VoiceFile = {
      samples: [...parsed.data.samples],
      profile,
      analyzed_at: new Date().toISOString(),
      source,
      signoff: parsed.data.signoff?.trim() || undefined,
      guardrails: parsed.data.guardrails && parsed.data.guardrails.length > 0 ? parsed.data.guardrails : undefined,
    };
    await writeJson(join(dir, "voice.json"), out);
    return { ok: true, profile, source, signoff: out.signoff, guardrails: out.guardrails };
  });

  // Save the Trust & boundaries step → trust.json
  app.post<{ Params: { id: string } }>("/op-omega/onboarding/avatar/:id/trust", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const id = req.params.id;
    const dir = avatarDir(id);
    if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
    const parsed = trustSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    const out: TrustFile = { ...parsed.data, set_at: new Date().toISOString() };
    await writeJson(join(dir, "trust.json"), out);
    return { ok: true, trust: out };
  });

  // Dashboard helper — surface trust on /api/avatar/:id (read-only)
  app.get<{ Params: { id: string } }>("/api/avatar/:id/trust", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const id = req.params.id;
    const dir = avatarDir(id);
    if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
    const trust = await readJson<TrustFile>(join(dir, "trust.json"));
    return { ok: true, trust };
  });

  // List rule-based suggestions for the avatar's connected tools
  app.get<{ Params: { id: string } }>("/op-omega/onboarding/avatar/:id/suggestions", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const id = req.params.id;
    const dir = avatarDir(id);
    if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
    const tools = (await readJson<{ connected: ToolConnection[] }>(join(dir, "tools.json")))?.connected ?? [];
    const trust = await readJson<TrustFile>(join(dir, "trust.json"));
    const suggestions = suggestionsFor(tools.map((t) => t.provider), trust);
    // Persist so the dashboard can show what was suggested even if rules change later.
    await writeJson(join(dir, "automations.json"), { enabled: [], suggested: suggestions } satisfies AutomationsFile);
    return { ok: true, suggestions };
  });

  // Finalize: lock in enabled automations
  app.post<{ Params: { id: string } }>("/op-omega/onboarding/avatar/:id/finalize", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const id = req.params.id;
    const dir = avatarDir(id);
    if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
    const parsed = finalizeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    const existing = (await readJson<AutomationsFile>(join(dir, "automations.json")))
      ?? { enabled: [], suggested: [] };
    const next: AutomationsFile = {
      enabled: parsed.data.enabledAutomationIds,
      suggested: existing.suggested,
    };
    await writeJson(join(dir, "automations.json"), next);

    // Mirror the Avatar as a Paperclip company at avatar-os/<id>. Spawns
    // a conductor + one sub-agent per connected tool. Idempotent — re-
    // finalizing reuses the prior Paperclip companyId + agentIds.
    // Failures are non-fatal: the Avatar is persisted on disk regardless,
    // and the operator can re-run handoff later from the dashboard.
    let paperclipHandoff: Awaited<ReturnType<typeof handoffAvatarToPaperclip>> | null = null;
    try {
      paperclipHandoff = await handoffAvatarToPaperclip(id);
    } catch (e) {
      paperclipHandoff = {
        enabled: true, paperclipUrl: null, paperclipCompanyId: null,
        conductorAgentId: null, created: [], skipped: [],
        errors: [{ provider: "<bootstrap>", message: e instanceof Error ? e.message : String(e) }],
      };
    }

    return {
      ok: true,
      avatarId: id,
      url: `/avatar/${id}`,
      paperclipHandoff,
    };
  });

  // Dashboard read
  app.get<{ Params: { id: string } }>("/api/avatar/:id", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const id = req.params.id;
    const dir = avatarDir(id);
    if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
    const profile = await readJson<AvatarProfile>(join(dir, "profile.json"));
    const tools = await readJson<{
      connected: ToolConnection[]; skipped: boolean;
      meta?: Record<string, { vips?: string[]; privacy_zones?: string[]; signoff?: string }>;
    }>(join(dir, "tools.json"));
    const voice = await readJson<VoiceFile>(join(dir, "voice.json"));
    const automations = await readJson<AutomationsFile>(join(dir, "automations.json"));
    return {
      ok: true,
      avatarId: id,
      profile,
      tools: tools?.connected ?? [],
      tools_skipped: tools?.skipped ?? false,
      tools_meta: tools?.meta ?? {},
      voice,
      automations,
    };
  });

  // Manually trigger inbox-triage runner (dev surface; in prod the
  // scheduler fires this on a cron). dryRun=true (default) substitutes
  // a 3-thread sample for the real Gmail pull, so the approval inbox
  // + audit log are testable before Composio OAuth lands.
  app.post<{ Params: { id: string }; Querystring: { dryRun?: string; skipInference?: string } }>(
    "/api/avatar/:id/run/gmail-triage",
    async (req, reply) => {
      if (!gateBoard(req, reply)) return;
      const id = req.params.id;
      const dir = avatarDir(id);
      if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
      const dryRun = req.query.dryRun !== "false";
      const skipInference = req.query.skipInference !== "false";
      const result = await runGmailTriage(id, { dryRun, skipInference });
      return { ok: true, result };
    },
  );

  // Audit log surface — paginated reads from Paperclip's activity_log
  // scoped to the avatar's mirror company.
  app.get<{ Params: { id: string }; Querystring: { limit?: string; before?: string } }>(
    "/api/avatar/:id/audit",
    async (req, reply) => {
      if (!gateBoard(req, reply)) return;
      const id = req.params.id;
      const dir = avatarDir(id);
      if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
      const handoff = await readJson<{ paperclipUrl?: string; paperclipCompanyId?: string }>(
        join(dir, "paperclip-handoff.json"),
      );
      if (!handoff?.paperclipUrl || !handoff?.paperclipCompanyId) {
        return { ok: true, entries: [], note: "not yet bridged to Paperclip" };
      }
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const url = `${handoff.paperclipUrl}/api/companies/${handoff.paperclipCompanyId}/activity?limit=${limit}`;
      try {
        const r = await fetch(url);
        if (!r.ok) return { ok: false, error: `paperclip audit ${r.status}`, entries: [] };
        // Paperclip's GET /companies/:id/activity returns a flat array.
        const body = await r.json() as unknown;
        const entries = Array.isArray(body) ? body : (body as { entries?: unknown[] }).entries ?? [];
        return { ok: true, entries };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e), entries: [] };
      }
    },
  );

  // Avatar's approvals — read from the per-avatar file store
  // (avatars/<id>/approvals/<approvalId>.json). Paperclip's approvals
  // table has a closed type-enum that doesn't admit avatar.* kinds, so
  // we keep avatar approvals in our own store. Audit + activity-log
  // entries still flow into Paperclip via the activity API.
  app.get<{ Params: { id: string }; Querystring: { status?: string } }>(
    "/api/avatar/:id/approvals",
    async (req, reply) => {
      if (!gateBoard(req, reply)) return;
      const id = req.params.id;
      const dir = avatarDir(id);
      if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
      const apvDir = join(dir, "approvals");
      const wantStatus = req.query.status ?? "pending";
      const { readdir } = await import("node:fs/promises");
      let entries: string[] = [];
      try { entries = await readdir(apvDir); } catch { /* empty */ }
      const approvals = [] as Array<Record<string, unknown>>;
      for (const fname of entries) {
        if (!fname.endsWith(".json")) continue;
        const parsed = await readJson<{ status?: string }>(join(apvDir, fname));
        if (!parsed) continue;
        if (wantStatus === "all" || parsed.status === wantStatus) approvals.push(parsed as Record<string, unknown>);
      }
      // Newest first.
      approvals.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
      return { ok: true, approvals };
    },
  );

  // Decide a pending approval. Updates the local approval file +
  // writes a corresponding activity_log entry to Paperclip for audit.
  app.post<{
    Params: { id: string; approvalId: string };
    Body: { decision: "approve" | "reject"; decisionNote?: string; editedPayload?: Record<string, unknown> };
  }>(
    "/api/avatar/:id/approvals/:approvalId/decide",
    async (req, reply) => {
      if (!gateBoard(req, reply)) return;
      const id = req.params.id;
      const dir = avatarDir(id);
      if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
      const apvPath = join(dir, "approvals", `${req.params.approvalId}.json`);
      const current = await readJson<{
        id: string; status: string; payload: Record<string, unknown>;
        requestedByAgentId: string; type: string;
      }>(apvPath);
      if (!current) return reply.status(404).send({ error: "approval not found" });
      if (current.status !== "pending") {
        return reply.status(409).send({ error: `approval already ${current.status}` });
      }
      const updated = {
        ...current,
        status: req.body.decision === "approve" ? "approved" : "rejected",
        decidedAt: new Date().toISOString(),
        decisionNote: req.body.decisionNote ?? null,
        editedPayload: req.body.editedPayload ?? null,
      };
      await writeJson(apvPath, updated);

      // Audit trail in Paperclip's activity_log so the audit-log tab
      // picks it up alongside agent-side actions.
      const handoff = await readJson<{ paperclipUrl?: string; paperclipCompanyId?: string }>(
        join(dir, "paperclip-handoff.json"),
      );
      if (handoff?.paperclipUrl && handoff?.paperclipCompanyId) {
        try {
          await fetch(`${handoff.paperclipUrl}/api/companies/${handoff.paperclipCompanyId}/activity`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actorType: "user",
              actorId: "operator",
              agentId: current.requestedByAgentId,
              action: req.body.decision === "approve" ? "avatar.approval.approved" : "avatar.approval.rejected",
              entityType: "approval",
              entityId: current.id,
              details: { type: current.type, edited: req.body.editedPayload != null, note: req.body.decisionNote },
            }),
          });
        } catch { /* non-fatal */ }
      }
      return { ok: true, approval: updated };
    },
  );

  // Graduate the autonomy preset one tier. cautious → balanced →
  // aggressive; aggressive is a no-op. The dashboard exposes this so the
  // operator can grow trust over weeks instead of pre-committing in
  // onboarding. Logs an activity entry so the audit trail records who
  // graduated when.
  app.post<{ Params: { id: string } }>("/api/avatar/:id/graduate", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const id = req.params.id;
    const dir = avatarDir(id);
    if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
    const trust = await readJson<TrustFile>(join(dir, "trust.json"));
    if (!trust) return reply.status(409).send({ error: "trust.json not set — finish onboarding first" });
    const order: TrustFile["autonomy_preset"][] = ["cautious", "balanced", "aggressive"];
    const idx = order.indexOf(trust.autonomy_preset);
    const next = order[Math.min(idx + 1, order.length - 1)];
    const updated: TrustFile = { ...trust, autonomy_preset: next, set_at: new Date().toISOString() };
    await writeJson(join(dir, "trust.json"), updated);

    const handoff = await readJson<{ paperclipUrl?: string; paperclipCompanyId?: string }>(
      join(dir, "paperclip-handoff.json"),
    );
    if (handoff?.paperclipUrl && handoff?.paperclipCompanyId) {
      try {
        await fetch(`${handoff.paperclipUrl}/api/companies/${handoff.paperclipCompanyId}/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actorType: "user",
            actorId: "operator",
            action: "avatar.autonomy.graduated",
            entityType: "avatar",
            entityId: id,
            details: { from: trust.autonomy_preset, to: next },
          }),
        });
      } catch { /* non-fatal */ }
    }
    return { ok: true, trust: updated };
  });

  // Per-skill kill switch — pause/resume a single sub-agent on the
  // mirror Paperclip company. Used by the dashboard to halt the gmail
  // skill (or any other) without pausing the whole fleet. Skill name
  // matches the agent key in paperclip-handoff.json (e.g. "gmail").
  app.post<{
    Params: { id: string; skill: string };
    Body: { action: "pause" | "resume" };
  }>(
    "/api/avatar/:id/skills/:skill/control",
    async (req, reply) => {
      if (!gateBoard(req, reply)) return;
      const id = req.params.id;
      const dir = avatarDir(id);
      if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
      const handoff = await readJson<{ paperclipUrl?: string; agents?: Record<string, string> }>(
        join(dir, "paperclip-handoff.json"),
      );
      const agentId = handoff?.agents?.[req.params.skill];
      if (!handoff?.paperclipUrl || !agentId) {
        return reply.status(409).send({ error: "skill not mapped to a Paperclip agent" });
      }
      const action = req.body?.action === "resume" ? "resume" : "pause";
      try {
        const r = await fetch(`${handoff.paperclipUrl}/api/agents/${agentId}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!r.ok) return reply.status(502).send({ error: `paperclip ${action} ${r.status}` });
        const body = await r.json() as { status?: string };
        return { ok: true, skill: req.params.skill, agentId, status: body.status ?? null };
      } catch (e) {
        return reply.status(502).send({ error: e instanceof Error ? e.message : String(e) });
      }
    },
  );

  // Per-skill state read — surfaces current `status` of each mapped
  // sub-agent so the dashboard can render the right kill-switch label.
  app.get<{ Params: { id: string } }>(
    "/api/avatar/:id/skills",
    async (req, reply) => {
      if (!gateBoard(req, reply)) return;
      const id = req.params.id;
      const dir = avatarDir(id);
      if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
      const handoff = await readJson<{ paperclipUrl?: string; agents?: Record<string, string> }>(
        join(dir, "paperclip-handoff.json"),
      );
      if (!handoff?.paperclipUrl || !handoff?.agents) {
        return { ok: true, skills: [] as Array<{ skill: string; agentId: string; status: string | null }> };
      }
      const out: Array<{ skill: string; agentId: string; status: string | null }> = [];
      for (const [skill, agentId] of Object.entries(handoff.agents)) {
        try {
          const r = await fetch(`${handoff.paperclipUrl}/api/agents/${agentId}`);
          if (!r.ok) { out.push({ skill, agentId, status: null }); continue; }
          const body = await r.json() as { status?: string };
          out.push({ skill, agentId, status: body.status ?? null });
        } catch {
          out.push({ skill, agentId, status: null });
        }
      }
      return { ok: true, skills: out };
    },
  );

  // List avatars (handy for resume + dashboard linking)
  app.get("/api/avatars", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    try {
      const ids = await readdir(avatarRoot()).catch(() => [] as string[]);
      const items: Array<{ avatarId: string; name?: string; role?: string; created_at?: string }> = [];
      for (const id of ids) {
        const p = await readJson<AvatarProfile>(join(avatarDir(id), "profile.json"));
        if (p) items.push({ avatarId: id, name: p.name, role: p.role, created_at: p.created_at });
      }
      return { ok: true, avatars: items };
    } catch {
      return { ok: true, avatars: [] };
    }
  });
}
