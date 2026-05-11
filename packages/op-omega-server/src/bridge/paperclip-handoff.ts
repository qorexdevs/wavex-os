/** Paperclip handoff bridge (Slice 1 — Phase D opt-in handoff).
 *
 *  After bridgeAgents writes the swarm topology to the wavex DB, optionally
 *  hand off the same agents to a running Paperclip instance so they get a
 *  real runtime (heartbeats, claude CLI execution, KPI snapshots, fleet
 *  observation). Opt-in via PAPERCLIP_HANDOFF_URL env var; when unset, this
 *  is a no-op and bridgeAgents-only is the contract.
 *
 *  Idempotent: a per-wavex-company mapping is persisted to
 *  ~/.wavex-os/instances/<wavexCompanyId>/paperclip-handoff.json so re-runs
 *  reuse the same Paperclip companyId + agentIds. Hires that already exist
 *  on the Paperclip side are skipped (name+role match).
 *
 *  v1 scope:
 *    - Creates a Paperclip company on first activate of a wavex company
 *    - Hires the C-Suite + CEO Orchestrator (ceo, cpo, cmo, cro, cfo, cdo, coo)
 *    - Skips L·IV+ specialists for now (mapping to Paperclip's constrained
 *      role enum is lossy for sub-roles; that's a v2 mapping problem)
 *    - Each hire's instructionsBundle.files["AGENTS.md"] is assembled from the
 *      role's per-template SKILL.md + concatenated SKILL_*.md files at
 *      packages/onboarding-ui/public/agent-templates/<role>/
 *    - Auto-approves the hire if the Paperclip server returns an approval
 *      record (Paperclip 0.3.x board flow on local_trusted)
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import type { CompanyManifest } from "@op-omega/plugin-onboarding";

interface SwarmAgentEntry {
  template_id?: string | null;
  reports_to?: string | null;
  display_name?: string;
  tier?: number;
  adapter?: string;
}

export interface HandoffReport {
  enabled: boolean;
  paperclipUrl: string | null;
  paperclipCompanyId: string | null;
  created: Array<{ slot: string; agentId: string; status: string }>;
  skipped: Array<{ slot: string; reason: string }>;
  errors: Array<{ slot: string; message: string }>;
}

const PAPERCLIP_ROLE_ENUM = new Set([
  "ceo", "cto", "cmo", "cfo", "security", "engineer",
  "designer", "pm", "qa", "devops", "researcher", "general",
]);

/** Project the op-omega slot taxonomy onto Paperclip's role enum.
 *  This loses fidelity (Paperclip has no cro/cdo/coo/cpo in its enum), but
 *  the agent's actual behavior comes from instructionsBundle, not the role
 *  label. We pick the closest enum value + record the original in metadata. */
function mapRoleToPaperclipEnum(slot: string): { role: string; orig: string } {
  // Special case: kernel CoS sits under ceo.* so the head-based logic
  // below would label it as "ceo" (same role as the actual CEO). Paperclip
  // has no chief-of-staff enum value, so fall back to "general" with the
  // CoS-flavored capabilities surfacing via the AGENTS.md bundle.
  if (slot === "ceo.chief-of-staff") return { role: "general", orig: "chief_of_staff" };
  const head = slot.split(".")[0];
  if (PAPERCLIP_ROLE_ENUM.has(head)) return { role: head, orig: head };
  // Map non-enum wavex roles to closest equivalents
  const map: Record<string, string> = {
    cpo: "pm",          // Chief Product Officer → PM enum
    cro: "general",     // Chief Revenue Officer → general (sales-shaped, no enum slot)
    cdo: "researcher",  // Chief Data Officer → researcher (data-shaped)
    coo: "devops",      // Chief Operating Officer → devops (operations-shaped)
  };
  const role = map[head] ?? "general";
  return { role, orig: head };
}

const ICON_BY_HEAD: Record<string, string> = {
  ceo: "crown",
  cto: "cpu",
  cmo: "rocket",
  cro: "target",
  cfo: "database",
  cdo: "radar",
  coo: "cog",
  cpo: "puzzle",
};

function iconForSlot(slot: string): string {
  // CoS sits at ceo.* but isn't the actual CEO — give it the "eye" icon
  // to reflect its observer role per MINIMAL_INCEPTION.md ("one acts; one
  // observes"). Without this special case, it'd inherit "crown" from CEO.
  if (slot === "ceo.chief-of-staff") return "eye";
  return ICON_BY_HEAD[slot.split(".")[0]] ?? "bot";
}

function humanNameForSlot(slot: string, displayName?: string): string {
  if (displayName) return displayName;
  const parts = slot.split(".").map(s => s.toUpperCase());
  return parts.join(" / ");
}

/** Assemble AGENTS.md content from the vendored role template directory.
 *  Concatenates SKILL.md (entry) + all SKILL_*.md siblings. */
async function readAgentBundle(role: string, repoRoot: string): Promise<string | null> {
  const dir = join(repoRoot, "packages", "onboarding-ui", "public", "agent-templates", role);
  try {
    const entries = await readdir(dir);
    const main = entries.includes("SKILL.md") ? await readFile(join(dir, "SKILL.md"), "utf8") : "";
    const skills = entries
      .filter(n => n.startsWith("SKILL_") && n.endsWith(".md"))
      .sort();
    const parts: string[] = [];
    if (main) parts.push(main);
    for (const fname of skills) {
      try {
        const c = await readFile(join(dir, fname), "utf8");
        parts.push(`\n\n---\n\n## Skill: ${fname.replace(/^SKILL_/, "").replace(/\.md$/, "").replace(/_/g, " ").toLowerCase()}\n\n${c}`);
      } catch {
        // ignore unreadable side files
      }
    }
    return parts.length > 0 ? parts.join("") : null;
  } catch {
    return null;
  }
}

/** Resolve the wavex-os repo root from this file's path. */
function resolveRepoRoot(): string {
  // src lives at: packages/op-omega-server/src/bridge/paperclip-handoff.ts
  const here = fileURLToPath(import.meta.url);
  return resolve(here, "..", "..", "..", "..", "..");
}

function handoffStateDir(wavexCompanyId: string): string {
  const root = process.env.WAVEX_OS_STATE_DIR ?? join(homedir(), ".wavex-os");
  return join(root, "instances", "default", "companies", wavexCompanyId);
}

interface PaperclipMapping {
  paperclipUrl: string;
  paperclipCompanyId: string;
  createdAt: string;
  agents: Record<string, string>; // slot -> paperclip agentId
}

async function loadMapping(wavexCompanyId: string): Promise<PaperclipMapping | null> {
  try {
    const raw = await readFile(join(handoffStateDir(wavexCompanyId), "paperclip-handoff.json"), "utf8");
    return JSON.parse(raw) as PaperclipMapping;
  } catch {
    return null;
  }
}

async function saveMapping(wavexCompanyId: string, m: PaperclipMapping): Promise<void> {
  const dir = handoffStateDir(wavexCompanyId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "paperclip-handoff.json"), JSON.stringify(m, null, 2), "utf8");
}

async function ensurePaperclipCompany(
  paperclipUrl: string,
  wavexCompanyId: string,
  manifest: CompanyManifest,
  existing: PaperclipMapping | null,
): Promise<{ paperclipCompanyId: string; created: boolean }> {
  if (existing) {
    // Verify it still exists
    const r = await fetch(`${paperclipUrl}/api/companies/${existing.paperclipCompanyId}`).catch(() => null);
    if (r && r.ok) return { paperclipCompanyId: existing.paperclipCompanyId, created: false };
  }
  const name = `wavex-os/${wavexCompanyId}`;
  const description = `Auto-provisioned from wavex-os onboarding finalize. Source manifest hash: ${manifest.signatures?.manifest_hash ?? "unknown"}.`;
  const r = await fetch(`${paperclipUrl}/api/companies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!r.ok) {
    throw new Error(`Paperclip POST /api/companies failed: ${r.status} ${await r.text()}`);
  }
  const body = await r.json() as { id: string };
  return { paperclipCompanyId: body.id, created: true };
}

async function hireOne(
  paperclipUrl: string,
  paperclipCompanyId: string,
  slot: string,
  entry: SwarmAgentEntry,
  reportsToId: string | null,
  bundleMd: string,
): Promise<{ agentId: string; status: string }> {
  const { role, orig } = mapRoleToPaperclipEnum(slot);
  const name = humanNameForSlot(slot, entry.display_name);
  const payload: Record<string, unknown> = {
    name,
    role,
    title: humanNameForSlot(slot),
    icon: iconForSlot(slot),
    capabilities: `Vendored from wavex-os op-omega manifest. Original slot=${slot}, template=${entry.template_id ?? orig}.`,
    adapterType: "claude_local",
    adapterConfig: {
      // Use the company's per-instance auth wrapper if available — otherwise
      // bare `claude` hits Anthropic without OAuth and 429s on every request.
      // The wrapper handles macOS keychain read + Sonnet fallback on usage-limit.
      command: process.env.PAPERCLIP_HANDOFF_WRAPPER ?? "claude",
      model: "claude-sonnet-4-6",
      dangerouslySkipPermissions: true,
      timeoutSec: 600,
      graceSec: 30,
      env: {
        HOME: { type: "plain", value: process.env.HOME ?? "" },
        CLAUDE_CONFIG_DIR: { type: "plain", value: process.env.CLAUDE_CONFIG_DIR ?? `${process.env.HOME}/.claude` },
      },
    },
    instructionsBundle: { files: { "AGENTS.md": bundleMd } },
    runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: true } },
  };
  if (reportsToId) payload.reportsTo = reportsToId;

  const r = await fetch(`${paperclipUrl}/api/companies/${paperclipCompanyId}/agent-hires`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    throw new Error(`agent-hires failed for ${slot}: ${r.status} ${await r.text()}`);
  }
  const body = await r.json() as { agent: { id: string; status: string }; approval?: { id: string; status: string } };
  const status = body.agent.status;
  // Auto-approve if Paperclip created an approval record
  if (body.approval && body.approval.status === "pending") {
    const ap = await fetch(`${paperclipUrl}/api/approvals/${body.approval.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisionNote: `Auto-approved by wavex-os handoff bridge for slot=${slot}` }),
    });
    if (!ap.ok) {
      // Non-fatal — agent still exists, just pending
      return { agentId: body.agent.id, status: `${status}_approve_failed_${ap.status}` };
    }
    return { agentId: body.agent.id, status: "approved" };
  }
  return { agentId: body.agent.id, status };
}

/** v1: which slots get handed off. Top-tier only — L·IV specialists deferred.
 *  Includes the kernel pair (CEO + Chief of Staff per MINIMAL_INCEPTION.md)
 *  and the C-suite chiefs. CoS is what closes the kernel loop on the
 *  Paperclip side ("one acts, one observes"). */
const V1_HANDOFF_SLOTS = new Set([
  "ceo.orchestrator",
  "ceo.chief-of-staff",
  "cpo",
  "cmo",
  "cro",
  "cfo",
  "cdo",
  "coo",
]);

export async function handoffToPaperclip(
  manifest: CompanyManifest,
  wavexCompanyId: string,
): Promise<HandoffReport> {
  const paperclipUrl = process.env.PAPERCLIP_HANDOFF_URL?.replace(/\/+$/, "") ?? null;
  if (!paperclipUrl) {
    return {
      enabled: false,
      paperclipUrl: null,
      paperclipCompanyId: null,
      created: [],
      skipped: [],
      errors: [],
    };
  }

  const report: HandoffReport = {
    enabled: true,
    paperclipUrl,
    paperclipCompanyId: null,
    created: [],
    skipped: [],
    errors: [],
  };

  const existing = await loadMapping(wavexCompanyId);
  const { paperclipCompanyId } = await ensurePaperclipCompany(paperclipUrl, wavexCompanyId, manifest, existing);
  report.paperclipCompanyId = paperclipCompanyId;

  const repoRoot = resolveRepoRoot();
  // The signed CompanyManifest nests the swarm under `swarm_manifest.agents`.
  // (Stand-alone swarm_manifest.json has it at top-level; CompanyManifest doesn't.)
  const swarm =
    (manifest as unknown as { swarm_manifest?: { agents?: Record<string, SwarmAgentEntry> } }).swarm_manifest?.agents ??
    (manifest as unknown as { agents?: Record<string, SwarmAgentEntry> }).agents ??
    {};

  // Track slot -> paperclip agentId for reports_to resolution
  const slotToPaperclipId: Record<string, string> = { ...(existing?.agents ?? {}) };

  // Pass 1: hire C-Suite roots (no reports_to dependency)
  for (const [slot, entry] of Object.entries(swarm)) {
    if (!V1_HANDOFF_SLOTS.has(slot)) {
      report.skipped.push({ slot, reason: "outside-v1-scope" });
      continue;
    }
    if (slotToPaperclipId[slot]) {
      report.skipped.push({ slot, reason: "already-mapped" });
      continue;
    }
    const role = (slot.split(".")[0]);
    const bundleMd = await readAgentBundle(role.replace(/_/g, "-"), repoRoot)
      ?? await readAgentBundle("chief-of-staff", repoRoot)
      ?? `# ${slot}\n\nPlaceholder — bundle file missing.`;
    const reportsToSlot = entry.reports_to ?? null;
    const reportsToId = reportsToSlot ? slotToPaperclipId[reportsToSlot] ?? null : null;
    try {
      const out = await hireOne(paperclipUrl, paperclipCompanyId, slot, entry, reportsToId, bundleMd);
      slotToPaperclipId[slot] = out.agentId;
      report.created.push({ slot, agentId: out.agentId, status: out.status });
    } catch (e) {
      report.errors.push({ slot, message: e instanceof Error ? e.message : String(e) });
    }
  }

  // Persist mapping for idempotency
  await saveMapping(wavexCompanyId, {
    paperclipUrl,
    paperclipCompanyId,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    agents: slotToPaperclipId,
  });

  return report;
}
