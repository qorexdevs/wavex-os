/** Composio mode resolution. WAVEX_COMPOSIO_DISABLED truthy → soft-disable
 *  (all reads return empty, OAuth returns null, validation returns
 *  {ok:false, reason:"disabled"}). Default in dev. Production sets it
 *  unset (or "0") AND provides COMPOSIO_API_KEY. */

export type ComposioMode = "live" | "disabled";

export function getComposioMode(): ComposioMode {
  const raw = (process.env.WAVEX_COMPOSIO_DISABLED ?? "").toLowerCase();
  const disabledExplicit = raw === "1" || raw === "true" || raw === "yes";
  if (disabledExplicit) return "disabled";
  if (raw === "0" || raw === "false" || raw === "no") return "live";
  // No explicit value: dev defaults to disabled, prod defaults to live.
  return process.env.NODE_ENV === "production" ? "live" : "disabled";
}

export function getComposioApiKey(): string | undefined {
  return process.env.COMPOSIO_API_KEY;
}
