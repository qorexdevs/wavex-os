/** Hardcoded featured-toolkit list. In live mode this can be augmented or
 *  swapped for a Composio API call. The shim returns this verbatim so the
 *  Phase 2 connector picker UI has options to render even in disabled
 *  mode — the operator picks toolkits, gets a "configure later" message,
 *  and Phase 2 generation still produces a complete connector manifest. */
import type { FeaturedToolkit } from "./types.js";

export const FEATURED_TOOLKITS: ReadonlyArray<FeaturedToolkit> = [
  { slug: "slack", displayName: "Slack", category: "comms" },
  { slug: "telegram", displayName: "Telegram", category: "comms" },
  { slug: "discord", displayName: "Discord", category: "comms" },
  { slug: "gmail", displayName: "Gmail", category: "comms" },
  { slug: "hubspot", displayName: "HubSpot", category: "crm" },
  { slug: "salesforce", displayName: "Salesforce", category: "crm" },
  { slug: "stripe", displayName: "Stripe", category: "billing" },
  { slug: "mixpanel", displayName: "Mixpanel", category: "analytics" },
  { slug: "amplitude", displayName: "Amplitude", category: "analytics" },
  { slug: "github", displayName: "GitHub", category: "dev" },
  { slug: "linear", displayName: "Linear", category: "dev" },
  { slug: "notion", displayName: "Notion", category: "ops" },
  { slug: "google_calendar", displayName: "Google Calendar", category: "ops" },
  { slug: "google_drive", displayName: "Google Drive", category: "ops" },
];
