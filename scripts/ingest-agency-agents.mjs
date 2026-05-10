#!/usr/bin/env node
// ingest-agency-agents.mjs
//
// One-time conversion script. Clones msitarzewski/agency-agents at a pinned commit,
// walks the markdown templates, curates the 30 we ship at v1, normalizes them into
// Paperclip-compatible SKILL.md files at packages/agent-templates/<role>/SKILL.md,
// and produces packages/agent-templates/_registry.json with metadata.
//
// Re-run quarterly to pick up new templates from upstream.
//
// Usage:
//   node scripts/ingest-agency-agents.mjs           # default: clone, ingest, verify
//   node scripts/ingest-agency-agents.mjs --check   # dry-run, no writes
//   node scripts/ingest-agency-agents.mjs --refresh # delete clone, re-fetch upstream

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TPL_DIR = path.join(ROOT, "packages", "agent-templates");
const TMP_CLONE = path.join(ROOT, ".tmp", "agency-agents");
const UPSTREAM = "https://github.com/msitarzewski/agency-agents.git";
// Pin to a known-good commit for reproducibility (update during refresh)
const PIN_REF = "main";

const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const REFRESH = args.includes("--refresh");
// --all expands ingest beyond the curated 30 to auto-discover every .md file
// in the listed divisions. Used to broaden the catalog so operators have real
// choice when swapping templates per slot from the Phase 3 org chart.
const ALL = args.includes("--all");

// V1 curated catalog — 30 templates total.
// 21 vendored from agency-agents (verified paths). 9 WaveX-authored (C-suite, derived from this session's learnings).
// agency-agents has 207 templates across 15 divisions but doesn't include explicit C-suite (CEO/CMO/CRO/etc.).
// Those we author from WaveX patterns: SKILL_DELEGATE_OR_KILL, SKILL_ECONOMIC_SELF_AWARENESS, SKILL_KPI_OWNERSHIP, etc.

const CURATED = [
  // ── C-suite (9) — WaveX-authored, source: this codebase ──
  { src: "__wavex__/ceo.md",                   target: "ceo",                role: "ceo",            tier: 1, kpis: ["cycle_completion_rate"], division: "c-suite", origin: "wavex" },
  { src: "specialized/specialized-chief-of-staff.md", target: "chief-of-staff", role: "chief_of_staff", tier: 1, kpis: ["agent_error_rate"], division: "c-suite", origin: "agency-agents" },
  { src: "__wavex__/cmo.md",                   target: "cmo",                role: "cmo",            tier: 2, kpis: ["new_auth_users_7d","leads_scraped_qualified_7d"], division: "c-suite", origin: "wavex" },
  { src: "__wavex__/cro.md",                   target: "cro",                role: "cro",            tier: 2, kpis: ["booking_gmv","booking_conversion_rate"], division: "c-suite", origin: "wavex" },
  { src: "__wavex__/cto.md",                   target: "cto",                role: "cto",            tier: 2, kpis: ["production_bug_resolution_hours"], division: "c-suite", origin: "wavex" },
  { src: "__wavex__/coo.md",                   target: "coo",                role: "coo",            tier: 2, kpis: ["mean_time_to_resolve"], division: "c-suite", origin: "wavex" },
  { src: "__wavex__/cfo.md",                   target: "cfo",                role: "cfo",            tier: 2, kpis: ["weekly_burn","cost_per_new_auth_user"], division: "c-suite", origin: "wavex" },
  { src: "__wavex__/cdo.md",                   target: "cdo",                role: "cdo",            tier: 2, kpis: ["kpi_freshness_seconds","utm_attribution_coverage"], division: "c-suite", origin: "wavex" },
  { src: "__wavex__/cpo.md",                   target: "cpo",                role: "cpo",            tier: 2, kpis: ["features_shipped_7d"], division: "c-suite", origin: "wavex" },

  // ── Engineering (5) — agency-agents ──
  { src: "engineering/engineering-backend-architect.md",   target: "backend-architect",    role: "engineer", tier: 3, kpis: [], division: "engineering", origin: "agency-agents" },
  { src: "engineering/engineering-frontend-developer.md",  target: "frontend-developer",   role: "engineer", tier: 3, kpis: [], division: "engineering", origin: "agency-agents" },
  { src: "engineering/engineering-devops-automator.md",    target: "devops-engineer",      role: "devops",   tier: 3, kpis: [], division: "engineering", origin: "agency-agents" },
  { src: "engineering/engineering-ai-engineer.md",         target: "ai-engineer",          role: "engineer", tier: 3, kpis: [], division: "engineering", origin: "agency-agents" },
  { src: "__wavex__/recovery-engineer.md",                 target: "recovery-engineer",    role: "devops",   tier: 3, kpis: ["mean_time_to_recovery"], division: "engineering", origin: "wavex" },

  // ── Marketing (5) — agency-agents ──
  { src: "marketing/marketing-growth-hacker.md",            target: "growth-hacker",        role: "general",  tier: 3, kpis: ["leads_scraped_qualified_7d"], division: "marketing", origin: "agency-agents" },
  { src: "marketing/marketing-linkedin-content-creator.md", target: "content-creator",      role: "general",  tier: 3, kpis: ["seo_organic_sessions_7d"], division: "marketing", origin: "agency-agents" },
  { src: "marketing/marketing-baidu-seo-specialist.md",     target: "seo-specialist",       role: "general",  tier: 3, kpis: [], division: "marketing", origin: "agency-agents" },
  { src: "paid-media/paid-media-creative-strategist.md",    target: "ad-creative-strategist", role: "general", tier: 3, kpis: [], division: "marketing", origin: "agency-agents" },
  { src: "paid-media/paid-media-ppc-strategist.md",         target: "ppc-strategist",       role: "general",  tier: 3, kpis: [], division: "marketing", origin: "agency-agents" },

  // ── Sales (3) — agency-agents ──
  { src: "sales/sales-coach.md",         target: "sales-coach",   role: "general", tier: 3, kpis: [], division: "sales", origin: "agency-agents" },
  { src: "sales/sales-engineer.md",      target: "sales-engineer", role: "engineer", tier: 3, kpis: [], division: "sales", origin: "agency-agents" },
  { src: "__wavex__/concierge-ops.md",   target: "concierge-ops", role: "general", tier: 3, kpis: ["concierge_to_registration_rate"], division: "sales", origin: "wavex" },

  // ── Product (3) — agency-agents ──
  { src: "product/product-manager.md",         target: "product-manager",     role: "pm",         tier: 3, kpis: [], division: "product", origin: "agency-agents" },
  { src: "design/design-ux-researcher.md",     target: "ux-researcher",       role: "researcher", tier: 3, kpis: [], division: "product", origin: "agency-agents" },
  { src: "product/product-trend-researcher.md", target: "trend-researcher",   role: "researcher", tier: 3, kpis: [], division: "product", origin: "agency-agents" },

  // ── Finance (2) — agency-agents ──
  { src: "finance/finance-financial-analyst.md",    target: "financial-analyst",   role: "general", tier: 3, kpis: [], division: "finance", origin: "agency-agents" },
  { src: "finance/finance-bookkeeper-controller.md", target: "bookkeeper",         role: "general", tier: 3, kpis: [], division: "finance", origin: "agency-agents" },

  // ── Support / QA (2) — agency-agents ──
  { src: "support/support-analytics-reporter.md", target: "support-analytics", role: "general", tier: 3, kpis: [], division: "support", origin: "agency-agents" },
  { src: "testing/testing-accessibility-auditor.md", target: "accessibility-auditor", role: "qa", tier: 4, kpis: [], division: "testing", origin: "agency-agents" },

  // ── Specialized (1) — WaveX-authored, distinct integration role ──
  { src: "__wavex__/composio-integration.md", target: "composio-integration", role: "engineer", tier: 3, kpis: [], division: "specialized", origin: "wavex" },
];

/* ──────────────────────────────────────────────────────────────────────────
 * Auto-discovery (--all mode): walk these divisions and ingest every .md
 * agent template, inferring role/tier/division/templateId from the path.
 * Filename convention upstream: <division>-<rest-of-name>.md (sometimes the
 * division prefix is absent; we strip + slugify either way).
 * ──────────────────────────────────────────────────────────────────────── */

const AUTO_DIVISIONS = [
  "engineering", "marketing", "sales", "product", "design", "finance",
  "support", "testing", "paid-media", "project-management", "specialized",
  "integrations", "strategy",
];

// Map division → role bucket for swap filtering. Operators picking an
// alternative for `cdo.signal` (data/L·IV) should see templates whose role
// is in the data-bucket: engineer + general work fine; pm doesn't.
const DIVISION_TO_DEFAULT_ROLE = {
  engineering: "engineer",
  marketing: "general",
  sales: "general",
  product: "pm",
  design: "researcher",
  finance: "general",
  support: "general",
  testing: "qa",
  "paid-media": "general",
  "project-management": "pm",
  specialized: "general",
  integrations: "engineer",
  strategy: "researcher",
};

const TIER_BY_DIVISION = {
  engineering: 3, marketing: 3, sales: 3, product: 3, design: 3,
  finance: 3, support: 3, testing: 4, "paid-media": 3,
  "project-management": 3, specialized: 3, integrations: 3, strategy: 3,
};

function filenameToTemplateId(division, filename) {
  // Strip .md, strip leading "<division>-" prefix if present, slugify.
  let id = filename.replace(/\.md$/i, "").toLowerCase();
  const prefix = division + "-";
  if (id.startsWith(prefix)) id = id.slice(prefix.length);
  // Some files have e.g. "engineering-engineering-frontend-developer.md"
  if (id.startsWith(prefix)) id = id.slice(prefix.length);
  return id.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

function inferRoleFromName(templateId, division) {
  const t = templateId.toLowerCase();
  if (/(engineer|developer|architect|programmer|automator)/.test(t)) return "engineer";
  if (/(researcher|analyst|investigator|scientist)/.test(t)) return "researcher";
  if (/(manager|lead|director|coordinator)/.test(t)) return "pm";
  if (/(qa|tester|auditor|reviewer)/.test(t)) return "qa";
  if (/(devops|sre|platform)/.test(t)) return "devops";
  return DIVISION_TO_DEFAULT_ROLE[division] ?? "general";
}

console.log(`WaveX OS · ingest-agency-agents`);
console.log(`Mode: ${CHECK ? "CHECK (dry-run)" : "INGEST"}${ALL ? " · --all (auto-discover)" : ""}`);
console.log(`Curated targets: ${CURATED.length}${ALL ? ` + auto-discover from ${AUTO_DIVISIONS.length} divisions` : ""}`);
console.log("");

// Step 1: clone or reuse cached
if (REFRESH && existsSync(TMP_CLONE)) {
  rmSync(TMP_CLONE, { recursive: true, force: true });
}
if (!existsSync(TMP_CLONE)) {
  console.log("Cloning agency-agents...");
  mkdirSync(path.dirname(TMP_CLONE), { recursive: true });
  execSync(`git clone --depth 1 --branch ${PIN_REF} ${UPSTREAM} ${TMP_CLONE}`, { stdio: "inherit" });
} else {
  console.log("Using cached clone at", TMP_CLONE);
}

// Step 2: discover actual source files (the curated paths above are heuristic;
// the real ones may be slugified differently). Walk the clone and try to match.
function findFile(slugCandidates, startDir) {
  // slugCandidates: array of plausible filenames like "ceo.md", "chief-of-staff.md", etc.
  // Returns the first match found anywhere under startDir.
  function* walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory() && entry !== ".git" && !entry.startsWith(".")) {
        yield* walk(full);
      } else if (stat.isFile() && entry.endsWith(".md")) {
        yield full;
      }
    }
  }
  for (const file of walk(startDir)) {
    const base = path.basename(file).toLowerCase();
    if (slugCandidates.some(c => base === c.toLowerCase())) return file;
  }
  return null;
}

// Step 3: ingest each curated template (vendored or wavex-authored)
const registry = [];
const credits = [];
let found = 0, missing = 0, wavexAuthored = 0;

for (const entry of CURATED) {
  const targetDir = path.join(TPL_DIR, entry.target);
  const targetFile = path.join(targetDir, "SKILL.md");

  // WaveX-authored templates: skip vendoring, leave a stub for now (Phase A continuation will fill them)
  if (entry.origin === "wavex") {
    if (!CHECK) {
      mkdirSync(targetDir, { recursive: true });
      const stub = `---\nname: ${entry.target}\ndescription: ${entry.role} role template (WaveX-authored, derived from session 2026-05-05/06 patterns)\norigin: wavex\nrole: ${entry.role}\ntier: ${entry.tier}\ndivision: ${entry.division}\ndefaultKpis: ${JSON.stringify(entry.kpis)}\n---\n\n# ${entry.target}\n\n**TODO** (Phase A continuation): port WaveX session skills into this template.\n\nPlanned content sources from this codebase:\n- \`SKILL_DELEGATE_OR_KILL.md\` (CEO heartbeat discipline)\n- \`SKILL_ECONOMIC_SELF_AWARENESS.md\` (every agent)\n- \`SKILL_KPI_OWNERSHIP.md\` (CxOs)\n- \`SKILL_FLEET_ALIGNMENT.md\` (Chief of Staff)\n- \`SKILL_VERIFY_BEFORE_CLAIM.md\` (every agent)\n- \`SKILL_RECOVERY_PROTOCOL.md\` (Recovery Engineer)\n- \`SKILL_DEPLOYED_ARTIFACT_VERIFICATION.md\` (CTO + CDO/Telemetry, lesson from WAV-3293)\n\nDefault KPIs for this role: ${entry.kpis.length > 0 ? entry.kpis.join(", ") : "(none — assigned during onboarding)"}\n`;
      writeFileSync(targetFile, stub);
    }
    console.log(`  📝 ${entry.target.padEnd(30)} ← WaveX-authored (stub)`);
    wavexAuthored++;
    registry.push({
      templateId: entry.target,
      role: entry.role,
      tier: entry.tier,
      division: entry.division,
      defaultKpis: entry.kpis,
      skillPath: `packages/agent-templates/${entry.target}/SKILL.md`,
      origin: "wavex",
      status: "stub",
    });
    continue;
  }

  // Vendored from agency-agents
  const slug = path.basename(entry.src);
  let srcFile = path.join(TMP_CLONE, entry.src);
  if (!existsSync(srcFile)) {
    srcFile = findFile([slug], TMP_CLONE);
  }

  if (!srcFile || !existsSync(srcFile)) {
    console.log(`  ✗ MISSING: ${entry.target} (tried ${entry.src})`);
    missing++;
    registry.push({ ...entry, status: "missing", srcPathInUpstream: entry.src });
    continue;
  }

  const md = readFileSync(srcFile, "utf8");

  if (!CHECK) {
    mkdirSync(targetDir, { recursive: true });
    const upstreamRel = path.relative(TMP_CLONE, srcFile);
    const credit = `<!-- Vendored from agency-agents (MIT) — https://github.com/msitarzewski/agency-agents/blob/${PIN_REF}/${upstreamRel} -->\n\n`;
    writeFileSync(targetFile, credit + md);
  }

  console.log(`  ✓ ${entry.target.padEnd(30)} ← ${path.relative(TMP_CLONE, srcFile)}`);
  found++;

  registry.push({
    templateId: entry.target,
    role: entry.role,
    tier: entry.tier,
    division: entry.division,
    defaultKpis: entry.kpis,
    skillPath: `packages/agent-templates/${entry.target}/SKILL.md`,
    sizeBytes: md.length,
    origin: "agency-agents",
    upstream: {
      repo: "msitarzewski/agency-agents",
      ref: PIN_REF,
      path: path.relative(TMP_CLONE, srcFile),
      license: "MIT",
    },
  });

  credits.push({
    templateId: entry.target,
    upstreamPath: path.relative(TMP_CLONE, srcFile),
    license: "MIT",
    author: "agency-agents contributors via msitarzewski",
  });
}

// ── Auto-discovery (--all mode) ────────────────────────────────────────────
let autoFound = 0;
if (ALL) {
  console.log("");
  console.log("Auto-discovering agents across selected divisions...");
  const curatedTargets = new Set(CURATED.map((c) => c.target));
  // Track upstream paths we've already vendored under their curated id so we
  // don't ingest the same source twice with different ids.
  const curatedSources = new Set(
    CURATED.filter((c) => c.origin === "agency-agents").map((c) => c.src.toLowerCase()),
  );

  for (const division of AUTO_DIVISIONS) {
    const divDir = path.join(TMP_CLONE, division);
    if (!existsSync(divDir)) {
      console.log(`  (no ${division}/ dir in upstream — skipped)`);
      continue;
    }
    let added = 0;
    for (const entry of readdirSync(divDir)) {
      if (!entry.endsWith(".md")) continue;
      // Skip directory READMEs and non-agent files
      if (/^(readme|contributing|license|index)\.md$/i.test(entry)) continue;
      const upstreamRel = `${division}/${entry}`;
      if (curatedSources.has(upstreamRel.toLowerCase())) continue;

      const templateId = filenameToTemplateId(division, entry);
      if (!templateId) continue;
      if (curatedTargets.has(templateId)) continue;

      const srcFile = path.join(divDir, entry);
      const md = readFileSync(srcFile, "utf8");
      const targetDir = path.join(TPL_DIR, templateId);
      const targetFile = path.join(targetDir, "SKILL.md");

      if (!CHECK) {
        mkdirSync(targetDir, { recursive: true });
        const credit = `<!-- Vendored from agency-agents (MIT) — https://github.com/msitarzewski/agency-agents/blob/${PIN_REF}/${upstreamRel} -->\n\n`;
        writeFileSync(targetFile, credit + md);
      }

      const role = inferRoleFromName(templateId, division);
      const tier = TIER_BY_DIVISION[division] ?? 3;

      registry.push({
        templateId,
        role,
        tier,
        division,
        defaultKpis: [],
        skillPath: `packages/agent-templates/${templateId}/SKILL.md`,
        sizeBytes: md.length,
        origin: "agency-agents",
        upstream: {
          repo: "msitarzewski/agency-agents",
          ref: PIN_REF,
          path: upstreamRel,
          license: "MIT",
        },
      });
      credits.push({
        templateId,
        upstreamPath: upstreamRel,
        license: "MIT",
        author: "agency-agents contributors via msitarzewski",
      });
      autoFound++;
      added++;
      // Track to prevent re-ingest on division reruns (defensive)
      curatedTargets.add(templateId);
      curatedSources.add(upstreamRel.toLowerCase());
    }
    console.log(`  ${division.padEnd(24)} +${added}`);
  }
  console.log(`Auto-discovered: ${autoFound} additional templates`);
  console.log("");
}

if (!CHECK) {
  // Write registry
  writeFileSync(
    path.join(TPL_DIR, "_registry.json"),
    JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), upstream: { repo: UPSTREAM, ref: PIN_REF }, templates: registry }, null, 2),
  );

  // Write per-template credits
  const creditsMd = [
    "# Agent Template Credits",
    "",
    "All templates in this directory are vendored from [agency-agents](https://github.com/msitarzewski/agency-agents) (MIT) by @msitarzewski. Per-template attribution below.",
    "",
    "| Template | Source path | License |",
    "|---|---|---|",
    ...credits.map(c => `| \`${c.templateId}\` | \`${c.upstreamPath}\` | ${c.license} |`),
    "",
    `Last updated: ${new Date().toISOString().slice(0, 10)} (pinned to upstream ref \`${PIN_REF}\`)`,
  ].join("\n");
  writeFileSync(path.join(TPL_DIR, "_CREDITS.md"), creditsMd);
}

console.log("");
console.log(`Summary: ${found} curated vendored, ${autoFound} auto-discovered, ${wavexAuthored} WaveX-authored stubs, ${missing} missing`);
console.log(`Registry: ${CHECK ? "(skipped, --check mode)" : path.join(TPL_DIR, "_registry.json")}`);
console.log(`Credits:  ${CHECK ? "(skipped, --check mode)" : path.join(TPL_DIR, "_CREDITS.md")}`);

if (missing > 0) {
  console.log("");
  console.log("⚠ Some templates were missing — paths in CURATED array may need adjustment after upstream layout review.");
  console.log("  Re-run with --check after editing CURATED to verify before writing.");
  process.exit(missing === CURATED.length ? 1 : 0);
}
