/** Client-side connector catalog — the searchable universe of tools a
 *  customer can add, plus the acquisition-path metadata that drives the
 *  "Add Connector" widget's hierarchy display.
 *
 *  ── Why this lives client-side ──
 *  The authoritative per-connector schema lives on the server in
 *  packages/wavex-os-server/src/routes/credentials.ts (CONNECTOR_KEY_SCHEMA,
 *  CONNECTOR_KEYS_URL) and src/lib/mcp-scanner.ts (MCP_INSTALL_HINTS,
 *  MCP_NAME_FRAGMENTS). This file is a deliberate MIRROR of that static
 *  data so the widget can render the full tool list + each tool's best
 *  path WITHOUT a round-trip — the customer is searching/browsing, not
 *  yet committing. Live state (is an MCP actually installed right now?
 *  is OAuth wired on the hub?) still comes from the server via
 *  listCredentials() — see resolvePath() which layers that on top.
 *
 *  Keep this in sync when the server schema changes. The widget degrades
 *  gracefully if a connector here is unknown to the server (it just
 *  won't get live MCP-detection enrichment).
 *
 *  ── The hierarchy ──
 *    1. MCP    — a Model Context Protocol server exists for this tool.
 *                Best path: zero credentials, the customer's editor (or
 *                a 1-click install) owns the connection.
 *    2. OAuth  — Composio brokers a hosted OAuth handshake. One click,
 *                a popup, no keys pasted.
 *    3. KEY    — manual API-key paste, with a deep link to where the
 *                customer obtains the key.
 *  Every tool resolves to its single BEST available path, but the widget
 *  also shows the fallback chain so the customer understands the choice.
 */

export type ConnectorPathKind = "mcp" | "oauth" | "key" | "upstream";

export interface ConnectorCatalogEntry {
  /** Connector slug — matches the server's CONNECTOR_KEY_SCHEMA keys and
   *  the manifest entry ids. */
  id: string;
  /** Human label for search + display. */
  label: string;
  /** One-line category for grouping/search hints. */
  category: string;
  /** Expected manual vault keys (empty ⇒ no paste form). Mirrors
   *  CONNECTOR_KEY_SCHEMA[id].keys. */
  expectedKeys: string[];
  /** Composio brokers an OAuth handshake for this toolkit. Mirrors
   *  CONNECTOR_KEY_SCHEMA[id].composio. */
  oauth: boolean;
  /** An official MCP server exists for this tool (whether or not the
   *  customer has it installed). Mirrors mcp-scanner's MCP coverage. */
  mcpAvailable: boolean;
  /** One-liner + docs link for installing the MCP, when documented. */
  mcpInstallHint?: { docs: string; install_hint: string };
  /** Deep link to where the customer gets their API key. Mirrors
   *  CONNECTOR_KEYS_URL[id]. */
  keysUrl?: string;
  /** True for connectors configured upstream during the pillars
   *  (claude-code from Pillar 2, telegram from Pillar 5) — no action
   *  needed in the connector flow. */
  upstream?: boolean;
}

const MCP_INSTALL_HINTS: Record<string, { docs: string; install_hint: string }> = {
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

/** Connectors with MCP coverage but no documented install one-liner yet.
 *  Mirrors mcp-scanner's MCP_NAME_FRAGMENTS keys minus the ones above. */
const MCP_TRACKABLE = new Set<string>([
  "gmail",
  "google_calendar",
  "google_drive",
]);

const KEYS_URL: Record<string, string> = {
  supabase: "https://supabase.com/dashboard/project/_/settings/api",
  github: "https://github.com/settings/tokens",
  telegram: "https://core.telegram.org/bots#how-do-i-create-a-bot",
  whatsapp: "https://developers.facebook.com/apps/",
  "twilio-sms": "https://console.twilio.com/",
  sendgrid: "https://app.sendgrid.com/settings/api_keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  mixpanel: "https://mixpanel.com/settings/project",
  amplitude: "https://app.amplitude.com/data/sources",
  posthog: "https://app.posthog.com/project/settings",
  segment: "https://app.segment.com/",
  stripe: "https://dashboard.stripe.com/apikeys",
  "stripe-connect": "https://dashboard.stripe.com/apikeys",
  shopify: "https://help.shopify.com/en/manual/apps/app-types/custom-apps",
  bigcommerce: "https://developer.bigcommerce.com/docs/start/authentication/api-accounts",
  shipstation: "https://help.shipstation.com/hc/en-us/articles/360025856212",
  klaviyo: "https://www.klaviyo.com/account#api-keys-tab",
  plaid: "https://dashboard.plaid.com/team/keys",
  docusign: "https://developers.docusign.com/platform/auth/",
  clio: "https://app.clio.com/settings/developer_applications",
  "meta-ads-api": "https://developers.facebook.com/apps/",
  "google-ads-api": "https://developers.google.com/google-ads/api/docs/first-call/dev-token",
  "linkedin-sales-nav": "https://www.linkedin.com/developers/apps",
  slack: "https://app.composio.dev/apps",
  discord: "https://app.composio.dev/apps",
  gmail: "https://app.composio.dev/apps",
  hubspot: "https://app.composio.dev/apps",
  salesforce: "https://app.composio.dev/apps",
  intercom: "https://app.composio.dev/apps",
  zendesk: "https://app.composio.dev/apps",
  notion: "https://app.composio.dev/apps",
  airtable: "https://app.composio.dev/apps",
  linear: "https://app.composio.dev/apps",
  calendly: "https://app.composio.dev/apps",
  google_calendar: "https://app.composio.dev/apps",
  google_drive: "https://app.composio.dev/apps",
};

/** Raw schema rows — slug → { label, category, keys, oauth }. Mirrors the
 *  server's CONNECTOR_KEY_SCHEMA, enriched with display metadata. */
const RAW: Array<{ id: string; label: string; category: string; keys: string[]; oauth: boolean; upstream?: boolean }> = [
  // Configured upstream during pillars
  { id: "claude-code", label: "Claude Code", category: "AI runtime", keys: [], oauth: false, upstream: true },
  { id: "telegram", label: "Telegram", category: "Messaging", keys: ["telegram_bot_token", "telegram_chat_id"], oauth: false },

  // Data substrate / dev infra
  { id: "supabase", label: "Supabase", category: "Database", keys: ["url", "anon_key"], oauth: true },
  { id: "github", label: "GitHub", category: "Dev / source control", keys: ["pat"], oauth: true },

  // Messaging & comms (Composio OAuth)
  { id: "slack", label: "Slack", category: "Messaging", keys: [], oauth: true },
  { id: "discord", label: "Discord", category: "Messaging", keys: [], oauth: true },
  { id: "gmail", label: "Gmail", category: "Email", keys: [], oauth: true },
  { id: "whatsapp", label: "WhatsApp", category: "Messaging", keys: ["business_account_id", "access_token"], oauth: false },
  { id: "twilio-sms", label: "Twilio SMS", category: "Messaging", keys: ["account_sid", "auth_token", "from_number"], oauth: false },
  { id: "sendgrid", label: "SendGrid", category: "Email", keys: ["api_key"], oauth: false },

  // CRM & support (Composio OAuth)
  { id: "hubspot", label: "HubSpot", category: "CRM", keys: [], oauth: true },
  { id: "salesforce", label: "Salesforce", category: "CRM", keys: [], oauth: true },
  { id: "intercom", label: "Intercom", category: "Support", keys: [], oauth: true },
  { id: "zendesk", label: "Zendesk", category: "Support", keys: [], oauth: true },

  // Productivity (Composio OAuth)
  { id: "notion", label: "Notion", category: "Productivity", keys: [], oauth: true },
  { id: "airtable", label: "Airtable", category: "Productivity", keys: [], oauth: true },
  { id: "linear", label: "Linear", category: "Project mgmt", keys: [], oauth: true },
  { id: "calendly", label: "Calendly", category: "Scheduling", keys: [], oauth: true },
  { id: "google_calendar", label: "Google Calendar", category: "Scheduling", keys: [], oauth: true },
  { id: "google_drive", label: "Google Drive", category: "Storage", keys: [], oauth: true },

  // AI / model providers
  { id: "anthropic", label: "Anthropic API", category: "AI / models", keys: ["api_key"], oauth: false },
  { id: "openai", label: "OpenAI API", category: "AI / models", keys: ["api_key"], oauth: false },

  // Analytics
  { id: "mixpanel", label: "Mixpanel", category: "Analytics", keys: ["project_token", "service_account_secret"], oauth: false },
  { id: "amplitude", label: "Amplitude", category: "Analytics", keys: ["api_key", "secret_key"], oauth: false },
  { id: "posthog", label: "PostHog", category: "Analytics", keys: ["host", "project_api_key", "personal_api_key"], oauth: false },
  { id: "segment", label: "Segment", category: "Analytics", keys: ["write_key"], oauth: false },

  // Payments & commerce
  { id: "stripe", label: "Stripe", category: "Payments", keys: ["secret_key"], oauth: true },
  { id: "stripe-connect", label: "Stripe Connect", category: "Payments", keys: ["secret_key", "platform_account_id"], oauth: false },
  { id: "shopify", label: "Shopify", category: "E-commerce", keys: ["shop_domain", "admin_api_token"], oauth: false },
  { id: "bigcommerce", label: "BigCommerce", category: "E-commerce", keys: ["store_hash", "access_token"], oauth: false },
  { id: "shipstation", label: "ShipStation", category: "E-commerce ops", keys: ["api_key", "api_secret"], oauth: false },
  { id: "klaviyo", label: "Klaviyo", category: "Marketing", keys: ["private_api_key"], oauth: false },

  // Vertical
  { id: "plaid", label: "Plaid", category: "Fintech", keys: ["client_id", "secret"], oauth: false },
  { id: "docusign", label: "DocuSign", category: "Legal / docs", keys: ["integration_key", "user_id", "account_id"], oauth: false },
  { id: "clio", label: "Clio", category: "Legal", keys: ["client_id", "client_secret"], oauth: false },

  // Ads APIs
  { id: "meta-ads-api", label: "Meta Ads API", category: "Advertising", keys: ["access_token", "ad_account_id"], oauth: false },
  { id: "google-ads-api", label: "Google Ads API", category: "Advertising", keys: ["developer_token", "customer_id", "refresh_token"], oauth: false },
  { id: "linkedin-sales-nav", label: "LinkedIn Sales Navigator", category: "Advertising", keys: ["access_token"], oauth: false },
];

export const CONNECTOR_CATALOG: ConnectorCatalogEntry[] = RAW.map((r) => {
  const mcpInstallHint = MCP_INSTALL_HINTS[r.id];
  const mcpAvailable = Boolean(mcpInstallHint) || MCP_TRACKABLE.has(r.id);
  return {
    id: r.id,
    label: r.label,
    category: r.category,
    expectedKeys: r.keys,
    oauth: r.oauth,
    mcpAvailable,
    ...(mcpInstallHint ? { mcpInstallHint } : {}),
    ...(KEYS_URL[r.id] ? { keysUrl: KEYS_URL[r.id] } : {}),
    ...(r.upstream ? { upstream: true } : {}),
  };
});

const BY_ID = new Map(CONNECTOR_CATALOG.map((c) => [c.id, c]));

export function catalogEntry(id: string): ConnectorCatalogEntry | undefined {
  return BY_ID.get(id);
}

/** Case-insensitive search across slug, label, and category. */
export function searchCatalog(query: string): ConnectorCatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return CONNECTOR_CATALOG;
  return CONNECTOR_CATALOG.filter(
    (c) =>
      c.id.toLowerCase().includes(q) ||
      c.label.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q),
  );
}

/** Live per-connector state the widget layers on top of the static
 *  catalog — sourced from listCredentials(). All fields optional so the
 *  widget works even before the credentials API has loaded. */
export interface ConnectorLiveState {
  /** An MCP server for this connector is installed RIGHT NOW (detected
   *  read-only from Claude Desktop / Claude Code / Cursor configs). */
  mcpManaged?: boolean;
  /** Where the installed MCP was found ("Claude Desktop", "Cursor", …). */
  mcpSourcedFrom?: string | null;
  /** Vault status — once set, the connector is already addressed. */
  status?: "vaulted_valid" | "vaulted_unvalidated" | "skipped" | "pending";
}

export interface ResolvedPath {
  /** The single BEST path the customer should take. */
  best: ConnectorPathKind;
  /** Ordered fallback chain, best-first. Always starts with `best`. */
  chain: ConnectorPathKind[];
  /** Short badge text for the best path. */
  badge: string;
  /** One-line explanation of what the best path means. */
  blurb: string;
  /** True when an MCP is already installed for this connector — the
   *  customer is effectively done, no action needed. */
  mcpAlreadyConnected: boolean;
}

/** Decide the connector-acquisition path for a catalog entry, layering in
 *  live state. This is the SAME hierarchy the server's credentials route
 *  encodes per-row (mcpManaged → composioManaged → expectedKeys), surfaced
 *  here as one explicit decision so the widget can show it cleanly:
 *
 *    MCP installed  →  "already connected, nothing to do"
 *    MCP available  →  "1-click install, skip credentials"
 *    OAuth          →  "connect — popup sign-in, no keys"
 *    API key        →  "paste a key" + link to get it
 *    upstream       →  "configured during setup"
 */
export function resolvePath(
  entry: ConnectorCatalogEntry,
  live?: ConnectorLiveState,
): ResolvedPath {
  // Build the full fallback chain first — best-first.
  const chain: ConnectorPathKind[] = [];
  if (entry.upstream) chain.push("upstream");
  if (entry.mcpAvailable) chain.push("mcp");
  if (entry.oauth) chain.push("oauth");
  if (entry.expectedKeys.length > 0) chain.push("key");
  // Connectors with none of the above (e.g. an OAuth-only Composio toolkit
  // with no keys) still surface OAuth; guarantee a non-empty chain.
  if (chain.length === 0) chain.push(entry.oauth ? "oauth" : "key");

  const best = chain[0];
  const mcpAlreadyConnected = Boolean(live?.mcpManaged);

  if (mcpAlreadyConnected) {
    return {
      best: "mcp",
      chain: chain.includes("mcp") ? chain : ["mcp", ...chain],
      badge: "Connected via MCP",
      blurb: `Already wired through your ${live?.mcpSourcedFrom ?? "existing"} MCP server — no keys to paste.`,
      mcpAlreadyConnected: true,
    };
  }

  switch (best) {
    case "upstream":
      return {
        best,
        chain,
        badge: "Configured",
        blurb: "Set up earlier during onboarding — nothing more to do.",
        mcpAlreadyConnected: false,
      };
    case "mcp":
      return {
        best,
        chain,
        badge: "1-click · MCP",
        blurb: "An official MCP server exists — install it once and your fleet connects with zero credentials.",
        mcpAlreadyConnected: false,
      };
    case "oauth":
      return {
        best,
        chain,
        badge: "Connect · OAuth",
        blurb: "One-click sign-in via a popup. No API keys to copy or paste.",
        mcpAlreadyConnected: false,
      };
    case "key":
    default:
      return {
        best: "key",
        chain,
        badge: "Needs API key",
        blurb: "Paste an API key — we link you straight to the page where you generate it.",
        mcpAlreadyConnected: false,
      };
  }
}

/** Human label + glyph for a path kind — shared by the widget's badges
 *  and fallback-chain pills. */
export function pathMeta(kind: ConnectorPathKind): { label: string; glyph: string } {
  switch (kind) {
    case "mcp": return { label: "MCP", glyph: "◆" };
    case "oauth": return { label: "OAuth", glyph: "↗" };
    case "key": return { label: "API key", glyph: "⚷" };
    case "upstream": return { label: "Configured", glyph: "✓" };
  }
}
