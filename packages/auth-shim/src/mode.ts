/** Mode resolution: WAVEX_AUTH_MODE env var ("dev" | "production").
 *  Defaults to "dev" when NODE_ENV !== "production"; defaults to "production"
 *  otherwise. Explicit env var always wins. */

export type AuthMode = "dev" | "production";

export function getAuthMode(): AuthMode {
  const explicit = (process.env.WAVEX_AUTH_MODE ?? "").toLowerCase();
  if (explicit === "production" || explicit === "prod") return "production";
  if (explicit === "dev" || explicit === "development") return "dev";
  return process.env.NODE_ENV === "production" ? "production" : "dev";
}
