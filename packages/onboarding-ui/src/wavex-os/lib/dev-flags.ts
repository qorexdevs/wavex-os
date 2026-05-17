/** Dev-mode URL flag helpers. Operators normally never see these — they
 *  exist for e2e tests + manual debugging. Read each call (not memoized) so
 *  changing the URL via the address bar takes effect on next render. */

export function urlFlag(name: string): boolean {
  if (typeof window === "undefined") return false;
  const v = new URLSearchParams(window.location.search).get(name);
  return v === "1" || v === "true";
}

/** Force T0-fast mode in Phase 2/3/4 — bypasses T2 enrichment for speed. */
export function isT0FastMode(): boolean {
  return urlFlag("t0");
}

/** Whitelist of params treated as dev-only flags. preserveDevFlags / devFlagsOnly
 *  carry these forward across navigation; everything else is dropped. */
const DEV_FLAG_KEYS = ["t0"];

/** Returns the current URL search-string with `extra` appended, preserving
 *  any dev flags currently set (so e.g. ?t0=1 survives navigation when we
 *  add `companyId=...`). Operator-facing query params should NOT be passed
 *  in `extra` — use the normal route params for those.
 *
 *  IMPORTANT: this preserves ONLY the whitelisted dev flags from the current
 *  URL — operator params (companyId, etc.) are NOT carried forward. To
 *  navigate while keeping companyId, pass it explicitly in `extra`. */
export function preserveDevFlags(extra: string): string {
  if (typeof window === "undefined") return extra;
  const current = new URLSearchParams(window.location.search);
  const next = new URLSearchParams();
  for (const key of DEV_FLAG_KEYS) {
    const v = current.get(key);
    if (v != null) next.set(key, v);
  }
  const incoming = new URLSearchParams(extra);
  for (const [k, v] of incoming) next.set(k, v);
  return next.toString();
}
