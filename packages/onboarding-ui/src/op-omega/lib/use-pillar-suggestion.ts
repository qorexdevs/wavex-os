/** useSuggestion(pillar, companyId)
 *
 *  Inline-card inference hook. On mount, POSTs to
 *  /op-omega/onboarding/pillar/:n/suggest with the current companyId; the
 *  server pulls every pillar response we have so far, asks Claude to predict
 *  the most likely answers for the next pillar, and returns a small JSON
 *  envelope { recommended: {field: value}, reasoning: "<one-sentence why>" }.
 *
 *  Cards use this to:
 *    - Pre-highlight the suggested chips (badge: "Suggested for you")
 *    - Render a short reasoning tooltip / inline note ("Why this pick?")
 *    - Pre-populate optional fields so the operator can just hit Continue
 *
 *  Failures (network blip, hub rate-limit, T2 timeout) degrade silently —
 *  recommended stays an empty object, the card renders unhighlighted, and
 *  the customer interacts with the static chip groups as before. The
 *  wizard NEVER blocks on a missing suggestion. */

import { useEffect, useRef, useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "./api";

export type SuggestablePillar = 3 | 4 | 5;

export interface PillarSuggestion {
  recommended: Record<string, unknown>;
  reasoning: string | null;
  loading: boolean;
  error: string | null;
  /** True once the request has resolved (success OR failure). Used by cards
   *  that want to defer rendering certain hints until we know whether
   *  Claude had a strong opinion. */
  loaded: boolean;
}

const EMPTY: PillarSuggestion = {
  recommended: {},
  reasoning: null,
  loading: false,
  error: null,
  loaded: false,
};

export function usePillarSuggestion(pillar: SuggestablePillar, companyId: string | null | undefined): PillarSuggestion {
  const [state, setState] = useState<PillarSuggestion>(EMPTY);
  // Guard against double-fetch in dev (StrictMode mounts components twice).
  const startedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    const key = `${pillar}:${companyId}`;
    if (startedRef.current === key) return;
    startedRef.current = key;
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    void (async () => {
      try {
        const r = await opOmegaOnboardingApi.pillarSuggest(pillar, companyId);
        if (cancelled) return;
        setState({
          recommended: (r.recommended ?? {}) as Record<string, unknown>,
          reasoning: r.reasoning ?? null,
          loading: false,
          error: r.error ?? null,
          loaded: true,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          recommended: {},
          reasoning: null,
          loading: false,
          error: e instanceof ApiError ? e.message : (e as Error).message,
          loaded: true,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [pillar, companyId]);

  return state;
}

/** Helper: does a chip value match the suggestion? Handles both scalar and
 *  array fields (e.g. lead_sources). Used by ResponseChips wrappers that
 *  want to badge matching options. */
export function isSuggested(
  recommended: Record<string, unknown>,
  field: string,
  value: string,
): boolean {
  const v = recommended[field];
  if (!v) return false;
  if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase()).includes(value.toLowerCase());
  return String(v).toLowerCase() === value.toLowerCase();
}
