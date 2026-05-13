/** F.4.f.b — Spawn the customer's wavex-liaison agent inside their own
 *  Paperclip instance once they have ≥1 active Expert Agent hire.
 *
 *  This mirrors the C-Suite handoff pattern in `paperclip-handoff.ts` but
 *  hires exactly ONE agent (the Liaison) and persists its ID into the
 *  same `paperclip-handoff.json` mapping under slot key `wavex-liaison`.
 *
 *  Idempotent: if `paperclip-handoff.json.agents['wavex-liaison']` already
 *  exists, this returns the existing record without calling Paperclip.
 *
 *  Inputs (resolved at call time):
 *    - Local Paperclip URL via env PAPERCLIP_HANDOFF_URL
 *    - Wavex company state dir via env WAVEX_OS_STATE_DIR (falls back to ~/.wavex-os)
 *    - The wavex companyId is read from disk: there's exactly one paperclip-
 *      handoff mapping per company; this scans for the freshest one.
 *
 *  Used by `/api/billing/ensure-liaison`.
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

export interface LiaisonSpawnResult {
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

/** Concatenate the wavex-liaison template SKILL files into a single
 *  AGENTS.md body for Paperclip's instructionsBundle.files. */
async function readLiaisonBundle(): Promise<string | null> {
  const dir = join(
    resolveRepoRoot(),
    "packages",
    "onboarding-ui",
    "public",
    "agent-templates",
    "wavex-liaison",
  );
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return null;
  }
  const parts: string[] = [];
  if (entries.includes("SKILL.md")) {
    parts.push(await readFile(join(dir, "SKILL.md"), "utf8"));
  }
  const skills = entries.filter((n) => n.startsWith("SKILL_") && n.endsWith(".md")).sort();
  for (const fname of skills) {
    try {
      const c = await readFile(join(dir, fname), "utf8");
      const label = fname.replace(/^SKILL_/, "").replace(/\.md$/, "").replace(/_/g, " ").toLowerCase();
      parts.push(`\n\n---\n\n## Skill: ${label}\n\n${c}`);
    } catch {
      // ignore individual file failures
    }
  }
  return parts.length > 0 ? parts.join("") : null;
}

export async function ensureLiaisonAgent(): Promise<LiaisonSpawnResult> {
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

  const existingAgentId = mapping.agents?.["wavex-liaison"];
  if (existingAgentId) {
    return {
      status: "already_exists",
      paperclipAgentId: existingAgentId,
      paperclipCompanyId: mapping.paperclipCompanyId,
      wavexCompanyId,
    };
  }

  const bundleMd = await readLiaisonBundle();
  if (!bundleMd) {
    return {
      status: "no_company_mapping",
      reason: "wavex-liaison agent template missing on disk",
    };
  }

  // Paperclip role enum has no 'liaison' value; "general" is the closest
  // fit (matches what paperclip-handoff.ts uses for non-enum roles).
  const payload: Record<string, unknown> = {
    name: "WaveX Liaison",
    role: "general",
    title: "WaveX Liaison",
    icon: "antenna",
    capabilities:
      "Builds encrypted fleet digests, polls injection queue, decrypts Pool-C-signed directives, and files them into local Paperclip. Mediates the cross-tenant boundary defined by F.4.",
    adapterType: "claude_local",
    adapterConfig: {
      command: process.env.PAPERCLIP_HANDOFF_WRAPPER ?? "claude",
      model: "claude-sonnet-4-6",
      dangerouslySkipPermissions: true,
      timeoutSec: 600,
      graceSec: 30,
      env: {
        HOME: { type: "plain", value: process.env.HOME ?? "" },
        CLAUDE_CONFIG_DIR: {
          type: "plain",
          value: process.env.CLAUDE_CONFIG_DIR ?? `${process.env.HOME}/.claude`,
        },
      },
    },
    instructionsBundle: { files: { "AGENTS.md": bundleMd } },
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
      `Paperclip agent-hires (wavex-liaison) failed: ${hireResp.status} ${await hireResp.text()}`,
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
        decisionNote: "Auto-approved by wavex-os ensure-liaison route (F.4.f.b)",
      }),
    });
    if (!ap.ok) {
      // Non-fatal: agent created, persist anyway so we don't re-hire.
      const next = { ...mapping, agents: { ...mapping.agents, "wavex-liaison": hireBody.agent.id } };
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

  const next = { ...mapping, agents: { ...mapping.agents, "wavex-liaison": hireBody.agent.id } };
  await persistMapping(wavexCompanyId, next);
  return {
    status: "spawned",
    paperclipAgentId: hireBody.agent.id,
    paperclipCompanyId: mapping.paperclipCompanyId,
    wavexCompanyId,
  };
}
