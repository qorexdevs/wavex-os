/** Plain-language renderers for the AvatarDashboard.
 *
 *  The runner / classifier / audit log write namespaced strings and enum
 *  shorthand (avatar.gmail.draft_created, "now"/"soon"/"fyi", etc.) so
 *  every downstream system can pattern-match on them cleanly. Those
 *  strings are correct in the data layer but read like log output to a
 *  non-technical operator. These functions are the only place where
 *  raw strings get translated to friendly UI copy — keeping the
 *  presentation layer separable from the data layer.
 *
 *  Pure / dependency-free so they can be unit-tested without booting
 *  the UI. */

const PROVIDER_DISPLAY: Record<string, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  google_calendar: "Google Calendar",
  microsoft_calendar: "Microsoft Calendar",
  slack: "Slack",
  notion: "Notion",
  linear: "Linear",
  github: "GitHub",
  twilio_sms: "Twilio SMS",
  hubspot: "HubSpot",
};

function providerName(slug: string): string {
  return PROVIDER_DISPLAY[slug] ?? slug;
}

/** Map an approval's classification / suggestion / importance enum into
 *  human-readable chip text. `kind` is the suffix of the namespaced
 *  type (draft_reply / invite_response / mention_digest); `tag` is the
 *  raw enum value. Unknown combinations fall through to the raw tag. */
export function humanizeBadge(kind: string, tag: string): string {
  if (kind === "draft_reply") {
    if (tag === "now") return "Reply today";
    if (tag === "soon") return "Reply this week";
    if (tag === "fyi") return "Just FYI";
  }
  if (kind === "invite_response") {
    if (tag === "accept") return "Suggested: Accept";
    if (tag === "decline") return "Suggested: Decline";
    if (tag === "propose-time") return "Suggested: Propose new time";
  }
  if (kind === "mention_digest") {
    if (tag === "urgent") return "Urgent";
    if (tag === "info") return "Heads-up";
    if (tag === "fyi") return "Just FYI";
  }
  return tag;
}

/** Map a namespaced audit-log action string to a friendly sentence the
 *  operator can scan. `details` is optional; the renderer reads provider
 *  hints when available (e.g. activity details carry `provider`). */
export function humanizeAction(action: string, details?: Record<string, unknown> | null): string {
  // Provider-namespaced actions: avatar.<provider>.<verb>
  const parts = action.split(".");
  if (parts[0] === "avatar" && parts.length >= 3) {
    const provider = parts[1];
    const verb = parts.slice(2).join(".");
    const providerLabel = providerName(provider);

    if (verb === "draft_created") return `Drafted a ${providerLabel} reply`;
    if (verb === "privacy_skip") return `Skipped (${providerLabel} privacy zone)`;
    if (verb === "invite_classified") return `Reviewed a ${providerLabel} invite`;
    if (verb === "mention_surfaced") return `Surfaced a ${providerLabel} @-mention`;
    if (provider === "approval") {
      if (verb === "approved") return "You approved a draft";
      if (verb === "rejected") return "You rejected a draft";
      if (verb === "auto_approved") return "Auto-approved on your behalf";
    }
    if (provider === "autonomy" && verb === "graduated") {
      const from = (details?.from as string | undefined) ?? "";
      const to = (details?.to as string | undefined) ?? "";
      if (from && to) return `Autonomy graduated: ${from} → ${to}`;
      return "Autonomy graduated";
    }
    if (provider === "gmail" && verb === "draft_created") return "Drafted a Gmail reply"; // safety net
    // Unknown avatar action — title-case the verb.
    const pretty = verb.replace(/_/g, " ");
    return `${providerLabel}: ${pretty.charAt(0).toUpperCase() + pretty.slice(1)}`;
  }
  // Paperclip-level actions on agents (paused / resumed).
  if (action === "agent.paused") {
    const slot = (details?.slot as string | undefined) ?? "";
    return slot ? `Paused ${providerName(slot)}` : "Paused an agent";
  }
  if (action === "agent.resumed") {
    const slot = (details?.slot as string | undefined) ?? "";
    return slot ? `Resumed ${providerName(slot)}` : "Resumed an agent";
  }
  // Unknown — strip the namespace prefix and title-case.
  const fallback = action.replace(/^[a-z_]+\./, "").replace(/_/g, " ");
  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

/** Format a runner's RunResult as a sentence. `skill` is the provider
 *  slug (gmail / outlook / google_calendar / microsoft_calendar / slack). */
export function humanizeRunResult(
  skill: string,
  result: { processed: number; drafted?: number; approvalsCreated: number },
): string {
  const label = providerName(skill);
  const queued = result.approvalsCreated;
  const queuedSuffix = queued === 0 ? "" : ` (${queued} waiting for you)`;

  if (skill === "gmail" || skill === "outlook") {
    const drafted = result.drafted ?? 0;
    if (result.processed === 0) return `No new ${label} threads.`;
    return `Read ${result.processed} ${label} thread${plural(result.processed)}, drafted ${drafted} repl${drafted === 1 ? "y" : "ies"}${queuedSuffix}.`;
  }
  if (skill === "google_calendar" || skill === "microsoft_calendar") {
    if (result.processed === 0) return `No pending ${label} invites.`;
    return `Reviewed ${result.processed} ${label} invite${plural(result.processed)}${queuedSuffix}.`;
  }
  if (skill === "slack") {
    if (result.processed === 0) return `No new Slack @-mentions.`;
    return `Surfaced ${result.processed} Slack @-mention${plural(result.processed)}${queuedSuffix}.`;
  }
  // Unknown skill — generic phrasing.
  if (result.processed === 0) return `Nothing new from ${label}.`;
  return `Processed ${result.processed} item${plural(result.processed)} from ${label}${queuedSuffix}.`;
}

function plural(n: number): string { return n === 1 ? "" : "s"; }
