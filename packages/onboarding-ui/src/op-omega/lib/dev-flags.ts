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

/** Returns the current URL search-string with `extra` appended, preserving
 *  any dev flags currently set (so e.g. ?t0=1 survives navigation when we
 *  add `companyId=...`). Operator-facing query params should NOT be passed
 *  in `extra` — use the normal route params for those. */
export function preserveDevFlags(extra: string): string {
  if (typeof window === "undefined") return extra;
  const current = new URLSearchParams(window.location.search);
  const incoming = new URLSearchParams(extra);
  // Add incoming on top of current; incoming overrides on key conflict.
  for (const [k, v] of incoming) current.set(k, v);
  return current.toString();
}
