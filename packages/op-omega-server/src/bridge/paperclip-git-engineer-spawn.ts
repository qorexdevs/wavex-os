/** Phase 9 — spawn the customer's git-engineer agent inside their own
 *  Paperclip instance once they have an active `code-engineer-v1` Expert
 *  Agent hire.
 *
 *  Mirrors `paperclip-liaison-spawn.ts`: hires exactly ONE agent (the Git
 *  Engineer) and persists its id into the same `paperclip-handoff.json`
 *  mapping under slot key `git-engineer`.
 *
 *  The Git Engineer turns `code-engineer-v1`'s structured code_change /
 *  db_migration proposals (routed in by the Liaison) into real pull requests
 *  on the customer's box, using the customer's own GitHub connection (OAuth
 *  via the Composio `github` toolkit). The customer's code never enters WaveX
 *  infra — see bridge/git-engineer/AGENTS.md.
 *
 *  Idempotent: if `paperclip-handoff.json.agents['git-engineer']` already
 *  exists, returns the existing record without calling Paperclip.
 *
 *  Used by `/api/billing/ensure-git-engineer` — which only calls this when the
 *  customer has an active `code-engineer-v1` hire.
 */

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

interface PaperclipMapping {
  paperclipUrl: string;
  paperclipCompanyId: string;
  createdAt: string;
  agents: Record<string, string>;
}

export interface GitEngineerSpawnResult {
  status: "spawned" | "already_exists" | "no_company_mapping";
  paperclipAgentId?: string;
  paperclipCompanyId?: string;
  wavexCompanyId?: string;
  reason?: string;
}

function stateRoot(): string {
  return process.env.WAVEX_OS_STATE_DIR ?? join(homedir(), ".wavex-os");
}

function instancesRoot(): string {
  return join(stateRoot(), "instances", "default", "companies");
}

/** Locate the freshest paperclip-handoff.json across all known wavex
 *  companies. Single-tenant in practice, but we don't hard-code that. */
async function findMapping(): Promise<{ wavexCompanyId: string; mapping: PaperclipMapping } | null> {
  let companies: string[];
  try {
    companies = await readdir(instancesRoot());
  } catch {
    return null;
  }
  let best: { wavexCompanyId: string; mapping: PaperclipMapping; mtime: number } | null = null;
  for (const c of companies) {
    const path = join(instancesRoot(), c, "paperclip-handoff.json");
    try {
      const s = await stat(path);
      if (best && s.mtimeMs <= best.mtime) continue;
      const raw = await readFile(path, "utf8");
      const mapping = JSON.parse(raw) as PaperclipMapping;
      best = { wavexCompanyId: c, mapping, mtime: s.mtimeMs };
    } catch {
      // missing or unreadable — skip
    }
  }
  return best ? { wavexCompanyId: best.wavexCompanyId, mapping: best.mapping } : null;
}

async function persistMapping(wavexCompanyId: string, mapping: PaperclipMapping): Promise<void> {
  const path = join(instancesRoot(), wavexCompanyId, "paperclip-handoff.json");
  await writeFile(path, JSON.stringify(mapping, null, 2), "utf8");
}

function resolveRepoRoot(): string {
  // src/bridge/this.ts → packages/op-omega-server/src/bridge → repo root is ../../../..
  const here = fileURLToPath(import.meta.url);
  return resolve(here, "..", "..", "..", "..", "..");
}

/** The git-engineer agent body — authored in a non-frozen location
 *  (agent-templates/ is a frozen path). */
async function readGitEngineerBundle(): Promise<string | null> {
  const path = join(
    resolveRepoRoot(),
    "packages",
    "op-omega-server",
    "src",
    "bridge",
    "git-engineer",
    "AGENTS.md",
  );
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

export async function ensureGitEngineerAgent(): Promise<GitEngineerSpawnResult> {
  const paperclipUrl = process.env.PAPERCLIP_HANDOFF_URL?.replace(/\/+$/, "");
  if (!paperclipUrl) {
    return { status: "no_company_mapping", reason: "PAPERCLIP_HANDOFF_URL not set" };
  }

  const found = await findMapping();
  if (!found) {
    return {
      status: "no_company_mapping",
      reason: "No paperclip-handoff.json — customer has not activated their company yet",
    };
  }
  const { wavexCompanyId, mapping } = found;

  const existingAgentId = mapping.agents?.["git-engineer"];
  if (existingAgentId) {
    return {
      status: "already_exists",
      paperclipAgentId: existingAgentId,
      paperclipCompanyId: mapping.paperclipCompanyId,
      wavexCompanyId,
    };
  }

  const bundleMd = await readGitEngineerBundle();
  if (!bundleMd) {
    return {
      status: "no_company_mapping",
      reason: "git-engineer agent template missing on disk",
    };
  }

  const payload: Record<string, unknown> = {
    name: "WaveX Git Engineer",
    role: "general",
    title: "WaveX Git Engineer",
    icon: "code",
    capabilities:
      "Turns code-engineer-v1's structured code_change / db_migration proposals into reviewable pull requests on the customer's own repo, via the customer's OAuth GitHub connection. PR-only, never direct-to-main, never auto-merge.",
    adapterType: "claude_local",
    adapterConfig: {
      // Auth wrapper — see paperclip-handoff.ts + docs/PAPERCLIP_AUTH_FIX.md.
      command: process.env.PAPERCLIP_HANDOFF_WRAPPER
        ?? join(resolveRepoRoot(), "scripts", "ops", "claude-keychain-wrapper.sh"),
      model: "claude-sonnet-4-6",
      dangerouslySkipPermissions: true,
      timeoutSec: 600,
      graceSec: 30,
      env: {
        HOME: { type: "plain", value: process.env.HOME ?? "" },
        USER: { type: "plain", value: process.env.USER ?? process.env.LOGNAME ?? "" },
        LOGNAME: { type: "plain", value: process.env.LOGNAME ?? process.env.USER ?? "" },
      },
    },
    instructionsBundle: { files: { "AGENTS.md": bundleMd } },
    // Wake-on-demand: driven by [CODE-PROPOSAL] issues the Liaison files. The
    // 30-min fallback heartbeat catches anything missed without burning tokens.
    runtimeConfig: { heartbeat: { enabled: true, intervalSec: 1800, wakeOnDemand: true } },
  };

  const hireResp = await fetch(
    `${paperclipUrl}/api/companies/${mapping.paperclipCompanyId}/agent-hires`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!hireResp.ok) {
    throw new Error(
      `Paperclip agent-hires (git-engineer) failed: ${hireResp.status} ${await hireResp.text()}`,
    );
  }
  const hireBody = (await hireResp.json()) as {
    agent: { id: string; status: string };
    approval?: { id: string; status: string };
  };

  if (hireBody.approval && hireBody.approval.status === "pending") {
    const ap = await fetch(`${paperclipUrl}/api/approvals/${hireBody.approval.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisionNote: "Auto-approved by wavex-os ensure-git-engineer route (Phase 9)",
      }),
    });
    if (!ap.ok) {
      // Non-fatal: agent created, persist anyway so we don't re-hire.
      const next = { ...mapping, agents: { ...mapping.agents, "git-engineer": hireBody.agent.id } };
      await persistMapping(wavexCompanyId, next);
      return {
        status: "spawned",
        paperclipAgentId: hireBody.agent.id,
        paperclipCompanyId: mapping.paperclipCompanyId,
        wavexCompanyId,
        reason: `auto-approve failed with ${ap.status}; agent exists in pending state`,
      };
    }
  }

  const next = { ...mapping, agents: { ...mapping.agents, "git-engineer": hireBody.agent.id } };
  await persistMapping(wavexCompanyId, next);
  return {
    status: "spawned",
    paperclipAgentId: hireBody.agent.id,
    paperclipCompanyId: mapping.paperclipCompanyId,
    wavexCompanyId,
  };
}
