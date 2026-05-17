/** MCP-first connector detection.
 *
 *  Many customers already have MCP servers installed in Claude Desktop,
 *  Claude Code CLI, or Cursor — for tools like Supabase, GitHub, Linear,
 *  Notion. When we detect one of those for a connector we'd otherwise
 *  ask the customer to paste API keys for, we mark it `mcpManaged` and
 *  skip the paste form entirely.
 *
 *  This is the highest-leverage CAC reduction in the Credential Concierge:
 *  a customer who already has the Supabase MCP doesn't need to copy a URL
 *  + an anon_key + flip into the dashboard for the service-role key. The
 *  fleet just uses their existing MCP connection.
 *
 *  Priority (per operator direction):
 *    1. MCP detected     → "✓ Connected via your existing MCP"   (no paste)
 *    2. Composio OAuth   → "Connect via OAuth" popup            (one click)
 *    3. Paste with link  → fallback for the remaining vendors
 *
 *  We read three canonical MCP config locations on macOS. Each can declare
 *  any number of MCP servers; we just look at server-name substrings to
 *  match against connector slugs. The match is intentionally loose —
 *  e.g. "supabase", "supabase-mcp", "my-supabase-mcp" all qualify.
 *
 *  IMPORTANT: this is a READ-ONLY scan. We never write to MCP configs,
 *  never extract secrets from them, and never expose contents to the
 *  customer or operator beyond {detected: true, sourcedFrom: "..."}.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** Connector slugs we know map to a recognizable MCP server name fragment.
 *  Keep this list narrow — we only want HIGH-CONFIDENCE matches.
 *  A connector slug here can resolve to multiple aliases (e.g. supabase has
 *  the official server + the cli-shim variant). */
const MCP_NAME_FRAGMENTS: Record<string, string[]> = {
  supabase:        ["supabase"],
  github:          ["github"],
  linear:          ["linear"],
  notion:          ["notion"],
  slack:           ["slack"],
  gmail:           ["gmail", "google-mail"],
  google_calendar: ["google-calendar", "google_calendar", "gcal"],
  google_drive:    ["google-drive", "google_drive", "gdrive"],
  hubspot:         ["hubspot"],
  stripe:          ["stripe"],
  posthog:         ["posthog"],
  // intentionally omitted: anthropic, openai (no MCP server pattern),
  // claude-code (handled upstream), telegram (bot tokens, not MCP).
};

/** Per-connector official MCP install commands. Surfaced as a hint when
 *  the connector has a known MCP available but the customer hasn't
 *  installed it yet — gives them a third option beyond OAuth and paste:
 *  "install the MCP and skip credentials entirely". */
export const MCP_INSTALL_HINTS: Record<string, { docs: string; install_hint: string }> = {
  supabase: {
    docs: "https://supabase.com/docs/guides/getting-started/mcp",
    install_hint: "Add the Supabase MCP server to Claude Desktop/Cursor — your fleet uses your existing project without keys.",
  },
  github: {
    docs: "https://github.com/github/github-mcp-server",
    install_hint: "Add the GitHub MCP server (Docker or remote) — skips PAT paste entirely.",
  },
  linear: {
    docs: "https://linear.app/changelog/2025-05-01-mcp",
    install_hint: "Linear ships an official MCP — add it to Claude Desktop, no API key needed.",
  },
  notion: {
    docs: "https://www.notion.so/integrations/mcp",
    install_hint: "Notion's MCP server connects via OAuth on first run — no integration token paste.",
  },
  slack: {
    docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
    install_hint: "Add the Slack MCP server — your fleet reads channels you have access to.",
  },
  hubspot: {
    docs: "https://developers.hubspot.com/docs/api/mcp",
    install_hint: "HubSpot's MCP server avoids the paste flow.",
  },
  stripe: {
    docs: "https://docs.stripe.com/agents/mcp",
    install_hint: "Stripe ships an official MCP — wires your account via Stripe's own auth flow.",
  },
  posthog: {
    docs: "https://posthog.com/docs/api/mcp",
    install_hint: "PostHog ships an MCP — no project-API-key paste.",
  },
};

/** Does this connector have a known MCP server available, regardless of
 *  whether the customer has installed it yet? Returns the install hint
 *  on a positive match so the UI can surface "Install MCP" as a third
 *  option below OAuth + paste. */
export function mcpAvailableFor(connectorId: string): { available: boolean; install?: { docs: string; install_hint: string } } {
  const hint = MCP_INSTALL_HINTS[connectorId];
  if (hint) return { available: true, install: hint };
  // Some connectors have MCP fragments registered (so we scan for them)
  // but don't have a documented install hint yet — still useful to flag
  // them as "MCP-trackable".
  if (connectorId in MCP_NAME_FRAGMENTS) return { available: true };
  return { available: false };
}

interface McpScanLocation {
  label: string;            // human-readable source name shown to the customer
  path: string;             // absolute file path
  read: (raw: string) => string[];  // returns the server-name list from this file
}

function locations(): McpScanLocation[] {
  const home = homedir();
  return [
    {
      label: "Claude Desktop",
      path: join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
      read: (raw) => {
        const d = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
        return Object.keys(d.mcpServers ?? {});
      },
    },
    {
      label: "Claude Code",
      path: join(home, ".claude", "mcp.json"),
      read: (raw) => {
        const d = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
        return Object.keys(d.mcpServers ?? {});
      },
    },
    {
      label: "Cursor",
      path: join(home, ".cursor", "mcp.json"),
      read: (raw) => {
        const d = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
        return Object.keys(d.mcpServers ?? {});
      },
    },
  ];
}

export interface DetectedMcp {
  connectorId: string;
  serverName: string;        // verbatim server name from the config (e.g. "supabase-mcp")
  sourcedFrom: string;       // human-readable label ("Claude Desktop", "Cursor", "Claude Code")
}

/** Scan all three MCP config locations and return every connector we
 *  found a matching server for. Failures (file missing, parse error)
 *  silently degrade to "not found" — we never block the wizard on a
 *  malformed config in the customer's editor of choice. */
export function scanInstalledMcpServers(): DetectedMcp[] {
  const detected: DetectedMcp[] = [];
  const seen = new Set<string>();
  for (const loc of locations()) {
    if (!existsSync(loc.path)) continue;
    let serverNames: string[];
    try {
      const raw = readFileSync(loc.path, "utf8");
      serverNames = loc.read(raw);
    } catch {
      continue;
    }
    for (const sn of serverNames) {
      const sn_lc = sn.toLowerCase();
      for (const [connectorId, fragments] of Object.entries(MCP_NAME_FRAGMENTS)) {
        if (seen.has(connectorId)) continue;
        if (fragments.some((f) => sn_lc.includes(f))) {
          detected.push({ connectorId, serverName: sn, sourcedFrom: loc.label });
          seen.add(connectorId);
        }
      }
    }
  }
  return detected;
}

/** Quick lookup variant returning a Map keyed by connectorId, for the
 *  credentials route's per-row enrichment. */
export function scanInstalledMcpServersMap(): Map<string, DetectedMcp> {
  const m = new Map<string, DetectedMcp>();
  for (const d of scanInstalledMcpServers()) m.set(d.connectorId, d);
  return m;
}
