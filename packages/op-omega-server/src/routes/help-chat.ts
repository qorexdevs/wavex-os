/** Persistent help-chat sidebar. Operators can ask questions about
 *  fields/concepts as they fill out the wizard; T2 answers in-context
 *  using the current phase + field + everything the operator has filled
 *  in so far. Conversation is stored per-company and surfaces across
 *  pillar/phase navigation.
 *
 *  The chat is read-only: it explains, recommends ways to think about a
 *  field, but does NOT mutate any pillar/phase state. Mutating the wizard
 *  via natural language is a separate (bigger) project.
 *
 *  Routes:
 *    GET  /api/instance/:companyId/help-chat
 *      → { ok, messages: HelpMessage[] }
 *    POST /api/instance/:companyId/help-chat
 *      { message, phase?, field? }
 *      → { ok, messages, latest_assistant }
 *
 *  All T2 calls go through withTokenAccounting so they roll into the
 *  per-company token budget + counter. */

import { z } from "zod";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { route as tierRoute } from "@op-omega/plugin-tier-router";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { loadPillarResponses } from "@op-omega/plugin-onboarding";
import { getOnboardingDir } from "../state-bridge.js";
import { withTokenAccounting } from "../lib/token-accounting.js";
import { BudgetExhaustedError } from "../lib/token-budget.js";

interface HelpMessage {
  role: "user" | "assistant";
  ts_iso: string;
  text: string;
  /** Phase the user was on when they asked (for context). */
  phase?: string;
  /** Specific field they were focused on, if known. */
  field?: string;
}

interface HelpChatFile {
  companyId: string;
  messages: HelpMessage[];
}

const MAX_HISTORY = 40;
const MAX_MESSAGE_LEN = 1500;
const MAX_REPLY_LEN = 800;

const postSchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_LEN),
  phase: z.string().max(40).optional(),
  field: z.string().max(80).optional(),
});

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

function chatPath(companyId: string): string {
  return join(getOnboardingDir(companyId), "help-chat.json");
}

async function readChat(companyId: string): Promise<HelpChatFile> {
  try {
    const raw = await readFile(chatPath(companyId), "utf8");
    return JSON.parse(raw) as HelpChatFile;
  } catch {
    return { companyId, messages: [] };
  }
}

async function writeChat(companyId: string, file: HelpChatFile): Promise<void> {
  const path = chatPath(companyId);
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(file, null, 2), "utf8");
  const { rename } = await import("node:fs/promises");
  await rename(tmp, path);
}

function buildPrompt(opts: {
  message: string;
  phase?: string;
  field?: string;
  pillarContext: string;
  history: HelpMessage[];
}): string {
  const lastMessages = opts.history.slice(-6).map((m) => `${m.role}: ${m.text}`).join("\n");
  return `You are a concise operator assistant for the Op-omega onboarding wizard. The operator is filling out a multi-pillar form to launch an AI agent company. Answer their question in plain English, under ${MAX_REPLY_LEN} characters. Explain what the field means, what good answers look like, and any common pitfalls. Do NOT prescribe a specific value — the operator decides. If the question is off-topic (not about onboarding), politely redirect them.

CURRENT CONTEXT:
- Phase: ${opts.phase ?? "(not specified)"}
- Field: ${opts.field ?? "(not specified)"}

WHAT THE OPERATOR HAS FILLED IN SO FAR:
${opts.pillarContext || "(nothing yet)"}

RECENT CONVERSATION (oldest first):
${lastMessages || "(none)"}

OPERATOR'S NEW QUESTION:
${opts.message}

Your reply (plain text, no markdown, under ${MAX_REPLY_LEN} chars):`;
}

async function summarizePillars(companyId: string): Promise<string> {
  const responses = await loadPillarResponses(companyId).catch(() => null);
  if (!responses) return "";
  const lines: string[] = [];
  const p1 = responses.pillar_1 as { org_name?: string; company_context?: string; industry_hint?: string; business_model_hint?: string } | undefined;
  if (p1) {
    if (p1.org_name) lines.push(`Company: ${p1.org_name}`);
    if (p1.industry_hint) lines.push(`Industry: ${p1.industry_hint}`);
    if (p1.business_model_hint) lines.push(`Business model: ${p1.business_model_hint}`);
    if (p1.company_context) lines.push(`Context: ${p1.company_context.slice(0, 200)}`);
  }
  const p3 = responses.pillar_3 as { stage?: string; product_state?: string } | undefined;
  if (p3?.stage) lines.push(`Stage: ${p3.stage}`);
  if (p3?.product_state) lines.push(`Product state: ${p3.product_state}`);
  const p4 = responses.pillar_4 as { sales_motion?: string; lead_sources?: string[] } | undefined;
  if (p4?.sales_motion) lines.push(`Sales motion: ${p4.sales_motion}`);
  if (p4?.lead_sources) lines.push(`Lead sources: ${p4.lead_sources.join(", ")}`);
  return lines.join("\n");
}

export function registerHelpChatRoute(app: FastifyInstance): void {
  app.get("/api/instance/:companyId/help-chat", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);
    const chat = await readChat(companyId);
    return { ok: true, messages: chat.messages };
  });

  app.post("/api/instance/:companyId/help-chat", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);
    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    }

    const chat = await readChat(companyId);
    chat.messages.push({
      role: "user",
      ts_iso: new Date().toISOString(),
      text: parsed.data.message,
      phase: parsed.data.phase,
      field: parsed.data.field,
    });

    let assistantText: string;
    try {
      const pillarContext = await summarizePillars(companyId);
      const fullPrompt = buildPrompt({
        message: parsed.data.message,
        phase: parsed.data.phase,
        field: parsed.data.field,
        pillarContext,
        history: chat.messages.slice(0, -1), // exclude the message we just added
      });
      assistantText = await withTokenAccounting(companyId, "help_chat", async () => {
        const resp = await tierRoute({
          agent_id: "onboarding.help-chat",
          prompt: fullPrompt,
          task_metadata: {
            creativity_required: false, customer_facing: false,
            reasoning_depth: "shallow", priority: "batch",
          },
          companyId,
          outputFormat: "text",
          timeout_ms: 45_000,
        });
        return resp.output.trim();
      });
    } catch (e) {
      if (e instanceof BudgetExhaustedError) {
        return reply.status(429).send({
          ok: false, error: e.message,
          budget: { used: e.used, cap: e.cap, companyId: e.companyId },
        });
      }
      // Persist the user message even when T2 fails so the operator's
      // question isn't lost; surface the failure as the assistant's reply.
      assistantText = `(I couldn't generate a reply right now: ${e instanceof Error ? e.message : String(e)}. Try again in a moment.)`;
    }

    chat.messages.push({
      role: "assistant",
      ts_iso: new Date().toISOString(),
      text: assistantText.slice(0, MAX_REPLY_LEN * 2),
      phase: parsed.data.phase,
      field: parsed.data.field,
    });

    if (chat.messages.length > MAX_HISTORY) {
      chat.messages = chat.messages.slice(-MAX_HISTORY);
    }
    await writeChat(companyId, chat);
    return {
      ok: true,
      messages: chat.messages,
      latest_assistant: chat.messages[chat.messages.length - 1],
    };
  });
}
