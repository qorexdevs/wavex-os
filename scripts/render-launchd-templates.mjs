#!/usr/bin/env node
/**
 * Render launchd .plist.tmpl files into ~/Library/LaunchAgents.
 *
 * Reads ./wavex-os.config.json (or path passed via --config) and substitutes
 * ${COMPANY_ID}, ${API_BASE}, ${STATE_DIR} placeholders into every template
 * found in templates/launchd/*.plist.tmpl.
 *
 * After running, install with:
 *   launchctl load -w ~/Library/LaunchAgents/com.wavex-os.*.plist
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { config: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config") out.config = args[++i];
    else if (args[i] === "--dry-run") out.dryRun = true;
  }
  return out;
}

async function loadConfig(configPath) {
  const resolvedPath =
    configPath ?? path.join(REPO_ROOT, "wavex-os.config.json");
  let raw;
  try {
    raw = await fs.readFile(resolvedPath, "utf8");
  } catch {
    throw new Error(
      `Config not found at ${resolvedPath}. Copy examples/wavex-os.config.example.json to ./wavex-os.config.json and fill it in.`,
    );
  }
  const cfg = JSON.parse(raw);
  for (const k of ["companyId", "apiBase", "stateDir"]) {
    if (!cfg[k]) throw new Error(`config missing required key: ${k}`);
  }
  // Phase G: optional new vars for inference-server + cloudflared + resource-sweep templates.
  // Old templates do not reference these; new templates require them. We DON'T throw
  // when missing — the substitution just leaves the literal `${VAR}` in the output,
  // which the loader will surface as a permission/path error.
  return cfg;
}

function substitute(template, vars) {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`\${${k}}`).join(v);
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const cfg = await loadConfig(args.config);

  const stateDir = cfg.stateDir.replace(/^~(?=$|\/)/, homedir());
  const launchAgentsDir = path.join(homedir(), "Library", "LaunchAgents");
  await fs.mkdir(launchAgentsDir, { recursive: true });
  await fs.mkdir(stateDir, { recursive: true });

  const templatesDir = path.join(REPO_ROOT, "templates", "launchd");
  const entries = await fs.readdir(templatesDir);
  const tmplFiles = entries.filter((e) => e.endsWith(".plist.tmpl"));

  if (tmplFiles.length === 0) {
    throw new Error(`No .plist.tmpl files in ${templatesDir}`);
  }

  // Phase G additions: WAVEX_OS_ROOT for inference-server + resource-sweep,
  // and TUNNEL_HOSTNAME for cloudflared (optional).
  const wavexOsRoot = (cfg.wavexOsRoot ?? REPO_ROOT).replace(/^~(?=$|\/)/, homedir());
  const tunnelHostname = cfg.tunnelHostname ?? "api.wavex-os.com";

  const vars = {
    COMPANY_ID: cfg.companyId,
    API_BASE: cfg.apiBase.replace(/\/$/, ""),
    STATE_DIR: stateDir,
    WAVEX_OS_ROOT: wavexOsRoot,
    TUNNEL_HOSTNAME: tunnelHostname,
  };

  // Warn if a template still has unsubstituted `${...}` placeholders after render.
  const placeholderRe = /\$\{([A-Z_]+)\}/g;

  let warnings = 0;
  for (const file of tmplFiles) {
    const tmpl = await fs.readFile(path.join(templatesDir, file), "utf8");
    const rendered = substitute(tmpl, vars);
    const outName = file.replace(/\.tmpl$/, "");
    const outPath = path.join(launchAgentsDir, outName);

    // Detect unsubstituted vars and warn (not fatal — operator may have a
    // template that intentionally uses a var we don't know about).
    const leftover = new Set();
    let m;
    while ((m = placeholderRe.exec(rendered)) !== null) leftover.add(m[1]);
    if (leftover.size > 0) {
      console.warn(`  ! ${file}: unsubstituted vars: ${[...leftover].join(", ")}`);
      warnings++;
    }

    if (args.dryRun) {
      console.log(`[dry-run] would write ${outPath} (${rendered.length} bytes)`);
    } else {
      await fs.writeFile(outPath, rendered, "utf8");
      console.log(`wrote ${outPath}`);
    }
  }
  if (warnings > 0) {
    console.log(`\n${warnings} template(s) had unsubstituted vars. Check wavex-os.config.json.`);
  }

  if (!args.dryRun) {
    console.log("\nNext step:");
    console.log(`  launchctl load -w ${launchAgentsDir}/com.wavex-os.*.plist`);
  }
}

main().catch((err) => {
  console.error("render-launchd-templates failed:", err.message);
  process.exit(1);
});
