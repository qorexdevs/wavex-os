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

function suggestionsFor(connectedProviders: string[]): AutomationSuggestion[] {
  const set = new Set(connectedProviders);
  return SUGGESTION_RULES.filter((rule) => rule.needs.every((n) => set.has(n))).slice(0, 3);
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

const voiceSchema = z.object({
  samples: z.tuple([z.string().max(2000), z.string().max(2000), z.string().max(2000)]),
  skipInference: z.boolean().optional(),
});

const finalizeSchema = z.object({
  enabledAutomationIds: z.array(z.string()).default([]),
});

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
    };
    await writeJson(join(dir, "voice.json"), out);
    return { ok: true, profile, source };
  });

  // List rule-based suggestions for the avatar's connected tools
  app.get<{ Params: { id: string } }>("/op-omega/onboarding/avatar/:id/suggestions", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const id = req.params.id;
    const dir = avatarDir(id);
    if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
    const tools = (await readJson<{ connected: ToolConnection[] }>(join(dir, "tools.json")))?.connected ?? [];
    const suggestions = suggestionsFor(tools.map((t) => t.provider));
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
    return { ok: true, avatarId: id, url: `/avatar/${id}` };
  });

  // Dashboard read
  app.get<{ Params: { id: string } }>("/api/avatar/:id", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const id = req.params.id;
    const dir = avatarDir(id);
    if (!existsSync(dir)) return reply.status(404).send({ error: "avatar not found" });
    const profile = await readJson<AvatarProfile>(join(dir, "profile.json"));
    const tools = await readJson<{ connected: ToolConnection[]; skipped: boolean }>(join(dir, "tools.json"));
    const voice = await readJson<VoiceFile>(join(dir, "voice.json"));
    const automations = await readJson<AutomationsFile>(join(dir, "automations.json"));
    return {
      ok: true,
      avatarId: id,
      profile,
      tools: tools?.connected ?? [],
      tools_skipped: tools?.skipped ?? false,
      voice,
      automations,
    };
  });

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
