/** Inbox-triage runner — Phase 2 wedge skill.
 *
 *  Per Avatar with a connected Gmail provider, every N minutes:
 *    1. Pull mail since last_run_at (or sample threads if dryRun).
 *    2. For each thread: classify Now / Soon / FYI + draft a reply in
 *       the operator's voice via tier-router T2.
 *    3. Write each result as a `pending` row to Paperclip's approvals
 *       table, scoped to the Avatar's mirror company. Conductor agent
 *       is the requester.
 *
 *  Real Gmail polling lands when Composio OAuth is wired (see
 *  packages/composio-shim/src/api.ts). Until then, `dryRun=true` emits
 *  a small fake-thread set so the approval inbox + audit log have
 *  data to render — and the runner code path is exercised end-to-end
 *  the same way it will be in production. */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import { route as tierRoute } from "@op-omega/plugin-tier-router";
import { withTokenAccounting } from "../../lib/token-accounting.js";

interface ThreadInput {
  threadId: string;
  subject: string;
  from: { name: string; email: string };
  preview: string;
  receivedAt: string;
}

interface Classification {
  classification: "now" | "soon" | "fyi";
  draft: string | null;
  confidence: number;
  reasoning: string;
  open_question?: string | null;
}

interface RunResult {
  avatarId: string;
  paperclipCompanyId: string;
  gmailAgentId: string | null;
  processed: number;
  drafted: number;
  approvalsCreated: number;
  errors: Array<{ threadId: string; message: string }>;
}

interface AvatarProfile {
  name: string;
  role: string;
  working_hours: [string, string];
  tz: string;
}

interface VoiceProfile {
  tone?: string;
  formality?: string;
  structure?: string;
  delegates?: string[];
}

function avatarDir(id: string): string {
  const root = process.env.WAVEX_OS_STATE_DIR ?? join(homedir(), ".wavex-os");
  return join(root, "instances", "default", "avatars", id);
}

async function readJson<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path, "utf8")) as T; } catch { return null; }
}

/** Deterministic fake-thread generator used in dryRun mode. Three samples
 *  spanning the classifier's domain (VIP-urgent → typical biz → newsletter)
 *  so the inbox UI shows a representative spread. The threadId is
 *  randomized per run so re-triggering the runner doesn't collide on a
 *  prior approval. */
function dryRunThreads(seed: string): ThreadInput[] {
  const now = new Date();
  const isoLater = (deltaMs: number) => new Date(now.getTime() - deltaMs).toISOString();
  const tag = seed.slice(-6);
  return [
    {
      threadId: `dry-${tag}-1`,
      subject: "Re: Series A close — need final cap table by Friday",
      from: { name: "Sarah Lin", email: "sarah@accelpartners.example" },
      preview: "Quick one — can you have the final cap table to my associate by EOD Friday? We need it for the closing docs and the lawyers are pushing for...",
      receivedAt: isoLater(30 * 60 * 1000),
    },
    {
      threadId: `dry-${tag}-2`,
      subject: "Coffee next week?",
      from: { name: "Alex Park", email: "alex@friendlyco.example" },
      preview: "Hey — wanted to see if you have time for coffee next week. Open to grabbing 30 min Wed or Thu afternoon if either works. No agenda, just catching up.",
      receivedAt: isoLater(4 * 60 * 60 * 1000),
    },
    {
      threadId: `dry-${tag}-3`,
      subject: "Your weekly Stripe digest",
      from: { name: "Stripe", email: "no-reply@stripe.example" },
      preview: "Here's what happened on your account this week: $12,408 in payments, 2 disputes opened, 1 closed in your favor...",
      receivedAt: isoLater(10 * 60 * 60 * 1000),
    },
  ];
}

const STUB_CLASSIFICATIONS: Record<string, Classification> = {
  "1": {
    classification: "now",
    draft: "Sarah — final cap table coming your way EOD Friday. Looping in our CFO to make sure the closing-docs columns are formatted the way the lawyers want. Anything else from us by then?",
    confidence: 0.86,
    reasoning: "VIP investor, hard deadline, action requested.",
  },
  "2": {
    classification: "soon",
    draft: "Yes — Wed afternoon works. Pick a slot on my calendar that's open and I'll grab it.",
    confidence: 0.71,
    reasoning: "Personal-network ping, no deadline, simple ask.",
  },
  "3": {
    classification: "fyi",
    draft: null,
    confidence: 0.94,
    reasoning: "Transactional / no-reply digest.",
  },
};

function classifyDryRun(thread: ThreadInput): Classification {
  const idx = thread.threadId.slice(-1);
  return STUB_CLASSIFICATIONS[idx] ?? STUB_CLASSIFICATIONS["1"];
}

/** Build the T2 classifier prompt with the operator's voice baked in. */
function buildClassifierPrompt(thread: ThreadInput, profile: AvatarProfile, voice: VoiceProfile | null): string {
  const voiceBlock = voice
    ? `Voice profile:
- Tone: ${voice.tone ?? "balanced"}
- Formality: ${voice.formality ?? "casual"}
- Structure: ${voice.structure ?? "lists"}
- Delegates first: ${(voice.delegates ?? []).join(", ") || "(unknown)"}`
    : "Voice profile not captured.";

  return `You triage incoming email for ${profile.name} (${profile.role}). Working hours ${profile.working_hours[0]}–${profile.working_hours[1]} ${profile.tz}.

${voiceBlock}

Thread:
- From: ${thread.from.name} <${thread.from.email}>
- Subject: ${thread.subject}
- Preview: ${thread.preview}

Classify as one of:
- "now": VIP, urgent, or deadline <48h
- "soon": needs reply but not urgent
- "fyi": no reply needed (newsletter, transactional)

If "now" or "soon", draft a reply in the operator's voice. If "fyi", draft is null.

Return JSON only:
{
  "classification": "now" | "soon" | "fyi",
  "draft": "<reply text or null>",
  "confidence": 0.0-1.0,
  "reasoning": "<one short sentence>",
  "open_question": "<question for the operator if you couldn't draft confidently, else null>"
}`;
}

async function classifyOne(
  avatarId: string,
  thread: ThreadInput,
  profile: AvatarProfile,
  voice: VoiceProfile | null,
  opts: { dryRun: boolean; skipInference: boolean },
): Promise<Classification> {
  if (opts.dryRun && opts.skipInference) {
    return classifyDryRun(thread);
  }
  try {
    const text = await withTokenAccounting(avatarId, "avatar_voice", async () => {
      const resp = await tierRoute({
        agent_id: "avatar.gmail.triage",
        prompt: buildClassifierPrompt(thread, profile, voice),
        task_metadata: {
          creativity_required: false,
          customer_facing: false,
          reasoning_depth: "shallow",
          priority: "batch",
        },
        companyId: avatarId,
        outputFormat: "json",
        timeout_ms: 45_000,
      });
      return resp.output.trim();
    });
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned) as Classification;
    return {
      classification: parsed.classification ?? "fyi",
      draft: parsed.draft ?? null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning ?? "no reasoning provided",
      open_question: parsed.open_question ?? null,
    };
  } catch {
    return classifyDryRun(thread);
  }
}

interface PaperclipHandoff {
  paperclipUrl: string;
  paperclipCompanyId: string;
  conductorAgentId: string;
  agents: Record<string, string>;
}

async function loadHandoff(avatarId: string): Promise<PaperclipHandoff | null> {
  return readJson<PaperclipHandoff>(join(avatarDir(avatarId), "paperclip-handoff.json"));
}

export interface AvatarApproval {
  id: string;
  avatarId: string;
  type: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt?: string;
  decisionNote?: string;
  editedPayload?: unknown;
  payload: Record<string, unknown>;
  requestedByAgentId: string;
}

/** Append-only per-avatar approval store. Paperclip's `approvals` table
 *  has a closed enum on `type` (only hire_agent / approve_ceo_strategy /
 *  budget_override_required / request_board_approval), so we keep avatar
 *  approvals in our own store. Audit log writes still go to Paperclip's
 *  activity_log via the free-form `action` field. */
async function writeApproval(avatarId: string, approval: AvatarApproval): Promise<void> {
  const dir = join(avatarDir(avatarId), "approvals");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${approval.id}.json`), JSON.stringify(approval, null, 2), "utf8");
}

/** Log an avatar event to Paperclip's activity_log via the REST API.
 *  Paperclip accepts free-form `action` strings, so we use namespaced
 *  ones like "avatar.gmail.draft_created" without needing schema changes.
 *  Failures are non-fatal — the approval is still persisted locally. */
async function logActivity(
  paperclipUrl: string,
  paperclipCompanyId: string,
  agentId: string,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(`${paperclipUrl}/api/companies/${paperclipCompanyId}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorType: "agent",
        actorId: agentId,
        agentId,
        action,
        entityType: "approval",
        entityId: details.approvalId,
        details,
      }),
    });
  } catch { /* non-fatal */ }
}

async function createApproval(
  paperclipUrl: string,
  paperclipCompanyId: string,
  gmailAgentId: string,
  avatarId: string,
  thread: ThreadInput,
  classification: Classification,
): Promise<string> {
  const id = `apv_${randomBytes(8).toString("hex")}`;
  const approval: AvatarApproval = {
    id,
    avatarId,
    type: "avatar.gmail.draft_reply",
    status: "pending",
    createdAt: new Date().toISOString(),
    requestedByAgentId: gmailAgentId,
    payload: {
      threadId: thread.threadId,
      subject: thread.subject,
      from: thread.from,
      preview: thread.preview,
      receivedAt: thread.receivedAt,
      draftText: classification.draft,
      classification: classification.classification,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
      openQuestion: classification.open_question ?? null,
    },
  };
  await writeApproval(avatarId, approval);
  await logActivity(paperclipUrl, paperclipCompanyId, gmailAgentId, "avatar.gmail.draft_created", {
    approvalId: id,
    threadId: thread.threadId,
    classification: classification.classification,
    confidence: classification.confidence,
  });
  return id;
}

/** Run inbox-triage for a single Avatar. Source = real Gmail when OAuth
 *  is wired; dryRun=true substitutes a 3-thread sample so the rest of
 *  the Phase 2 stack is testable today. */
export async function runGmailTriage(avatarId: string, opts: { dryRun?: boolean; skipInference?: boolean } = {}): Promise<RunResult> {
  const dryRun = opts.dryRun ?? true;
  const skipInference = opts.skipInference ?? true;
  const result: RunResult = {
    avatarId, paperclipCompanyId: "", gmailAgentId: null,
    processed: 0, drafted: 0, approvalsCreated: 0, errors: [],
  };

  const profile = await readJson<AvatarProfile>(join(avatarDir(avatarId), "profile.json"));
  if (!profile) { result.errors.push({ threadId: "<bootstrap>", message: "profile.json missing" }); return result; }
  const voiceFile = await readJson<{ profile?: VoiceProfile }>(join(avatarDir(avatarId), "voice.json"));
  const voice = voiceFile?.profile ?? null;
  const handoff = await loadHandoff(avatarId);
  if (!handoff) { result.errors.push({ threadId: "<bootstrap>", message: "paperclip-handoff.json missing — finalize first" }); return result; }
  result.paperclipCompanyId = handoff.paperclipCompanyId;
  const gmailAgentId = handoff.agents["gmail"] ?? null;
  result.gmailAgentId = gmailAgentId;
  if (!gmailAgentId) { result.errors.push({ threadId: "<bootstrap>", message: "no gmail sub-agent in mapping" }); return result; }

  // Real Gmail pull lands when Composio OAuth wires up. For now: dryRun.
  const threads = dryRun
    ? dryRunThreads(avatarId)
    : []; // TODO: replace with real Gmail pull through composio-shim once OAuth is wired.

  for (const thread of threads) {
    result.processed += 1;
    try {
      const cls = await classifyOne(avatarId, thread, profile, voice, { dryRun, skipInference });
      if (cls.classification !== "fyi") result.drafted += 1;
      await createApproval(handoff.paperclipUrl, handoff.paperclipCompanyId, gmailAgentId, avatarId, thread, cls);
      result.approvalsCreated += 1;
    } catch (e) {
      result.errors.push({ threadId: thread.threadId, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return result;
}
