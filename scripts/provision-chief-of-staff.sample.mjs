#!/usr/bin/env node
/**
 * Provision the Chief of Staff agent — the second half of the kernel
 * (CEO is provisioned by the onboarding wizard at company creation).
 *
 * Idempotent: re-running checks for an existing agent with role=chief_of_staff
 * and only inserts if absent. Distributes the SKILL_FLEET_ALIGNMENT.md and
 * SKILL_RECOVERY_PROTOCOL.md instruction files.
 *
 * Usage:
 *   node scripts/provision-chief-of-staff.sample.mjs --config ./wavex-os.config.json
 *
 * Reads from your config:
 *   - companyId
 *   - apiBase (only used for log messages)
 *   - wrapperPath (the per-spawn execution wrapper, typically scripts/wrappers/claude-spawn.sh)
 *   - model (typically claude-opus-4-7)
 *
 * Database connection comes from the DATABASE_URL env var. If unset,
 * falls back to the Paperclip default of postgresql://paperclip:paperclip@localhost:54329/paperclip.
 */
import pg from "pg";
import { promises as fs } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { config: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config") out.config = args[++i];
  }
  return out;
}

async function loadConfig(configPath) {
  const resolvedPath = configPath ?? path.join(REPO_ROOT, "wavex-os.config.json");
  const raw = await fs.readFile(resolvedPath, "utf8");
  const cfg = JSON.parse(raw);
  for (const k of ["companyId", "wrapperPath", "model"]) {
    if (!cfg[k]) throw new Error(`config missing required key: ${k}`);
  }
  return cfg;
}

function expandPath(p) {
  if (p.startsWith("~/")) return path.join(homedir(), p.slice(2));
  if (p.startsWith("${REPO_ROOT}/")) return path.join(REPO_ROOT, p.slice("${REPO_ROOT}/".length));
  return p;
}

async function main() {
  const args = parseArgs();
  const cfg = await loadConfig(args.config);
  const { Client } = pg.default ?? pg;

  const c = new Client(
    process.env.DATABASE_URL ||
      "postgresql://paperclip:paperclip@localhost:54329/paperclip",
  );
  await c.connect();

  // Find CEO id (Chief of Staff reports to CEO)
  const { rows: ceoRows } = await c.query(
    `SELECT id FROM agents WHERE company_id=$1 AND role='ceo' AND status NOT IN ('terminated') LIMIT 1`,
    [cfg.companyId],
  );
  const ceo = ceoRows[0];
  if (!ceo) {
    throw new Error(
      `CEO not found for company ${cfg.companyId}. Run the onboarding wizard first to create the kernel.`,
    );
  }

  // Idempotency check
  const { rows: existingRows } = await c.query(
    `SELECT id, name FROM agents WHERE company_id=$1 AND role='chief_of_staff' AND status NOT IN ('terminated')`,
    [cfg.companyId],
  );

  let agentId;
  if (existingRows[0]) {
    agentId = existingRows[0].id;
    console.log(
      `Chief of Staff already exists: ${existingRows[0].name} [${agentId.slice(0, 8)}]`,
    );
  } else {
    // Resolve path placeholders in adapter_config
    const wrapperPath = expandPath(cfg.wrapperPath);
    const adapterConfig = {
      cwd: REPO_ROOT,
      env: {
        HOME: { type: "plain", value: homedir() },
      },
      model: cfg.model,
      effort: "high",
      command: wrapperPath,
      graceSec: 20,
      extraArgs: [],
      timeoutSec: 0,
      maxTurnsPerRun: 100,
      // {AGENT_ID} is substituted post-insert by the UPDATE below.
      instructionsFilePath:
        "${INSTRUCTIONS_ROOT}/{AGENT_ID}/instructions/SKILL.md",
      instructionsRootPath: "${INSTRUCTIONS_ROOT}/{AGENT_ID}/instructions",
      instructionsEntryFile: "SKILL.md",
      instructionsBundleMode: "managed",
      dangerouslySkipPermissions: true,
    };

    const { rows } = await c.query(
      `INSERT INTO agents (
        company_id, name, role, title, status, reports_to,
        adapter_type, adapter_config, tier, icon, capabilities
      ) VALUES (
        $1, 'Chief of Staff', 'chief_of_staff', 'Chief of Staff (Fleet Alignment Officer)', 'idle', $2,
        'claude_local',
        $3::jsonb,
        'system',
        'compass',
        'fleet alignment, recovery orchestration, cross-tree dependency analysis, forecast accuracy review'
      ) RETURNING id`,
      [cfg.companyId, ceo.id, JSON.stringify(adapterConfig)],
    );
    agentId = rows[0].id;
    console.log(`Provisioned Chief of Staff: ${agentId.slice(0, 8)}`);

    await c.query(
      `UPDATE agents SET adapter_config = REPLACE(adapter_config::text, '{AGENT_ID}', $1)::jsonb WHERE id=$2`,
      [agentId, agentId],
    );
  }

  // Distribute instruction files. The orchestrator copies these into the
  // managed instructions directory at agent-spawn time; we just place them
  // in the source-of-truth location.
  const sourceDir = path.join(
    REPO_ROOT,
    "packages",
    "onboarding-ui",
    "public",
    "agent-templates",
    "chief-of-staff",
  );
  const sharedSkillsDir = path.join(REPO_ROOT, "packages", "standard-skills");
  const skillFiles = [
    [path.join(sourceDir, "SKILL.md"), "SKILL.md"],
    [path.join(sourceDir, "SKILL_FLEET_ALIGNMENT.md"), "SKILL_FLEET_ALIGNMENT.md"],
    [path.join(sourceDir, "SKILL_RECOVERY_PROTOCOL.md"), "SKILL_RECOVERY_PROTOCOL.md"],
    [path.join(sharedSkillsDir, "SKILL_ECONOMIC_SELF_AWARENESS.md"), "SKILL_ECONOMIC_SELF_AWARENESS.md"],
    [path.join(sharedSkillsDir, "SKILL_HARNESS_RECOGNITION.md"), "SKILL_HARNESS_RECOGNITION.md"],
    [path.join(sharedSkillsDir, "SKILL_KPI_OWNERSHIP.md"), "SKILL_KPI_OWNERSHIP.md"],
    [path.join(sharedSkillsDir, "SKILL_LESSONS_READ.md"), "SKILL_LESSONS_READ.md"],
    [path.join(sharedSkillsDir, "SKILL_VERIFY_BEFORE_CLAIM.md"), "SKILL_VERIFY_BEFORE_CLAIM.md"],
  ];

  for (const [srcPath, _] of skillFiles) {
    try {
      await fs.access(srcPath);
    } catch {
      console.warn(`  WARN: source skill missing: ${srcPath}`);
    }
  }
  console.log(
    `\nNext step: copy or symlink the skill files into your orchestrator's agent-instructions directory for agent ${agentId.slice(0, 8)}.`,
  );
  console.log(`  Source dir: ${sourceDir}`);
  console.log(`  Standard skills: ${sharedSkillsDir}`);

  await c.end();
}

main().catch((err) => {
  console.error("provision-chief-of-staff failed:", err.message);
  process.exit(1);
});
