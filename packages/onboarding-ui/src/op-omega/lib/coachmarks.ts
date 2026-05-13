/** Phase 7-B — first-run coachmark dismiss flag.
 *
 *  Direct localStorage key keeps this independent of the Zustand store
 *  in `src/store.ts` (Mission Control / Avatar dashboard mount before
 *  any operator-specific state is hydrated). Use one key per surface:
 *  "coachmark-avatar-v1", "coachmark-mission-v1".
 *
 *  Sets to "1" once the operator clicks Skip or Got it on the final
 *  step. Bumping the v1 → v2 forces every operator to re-see the tour
 *  next time we materially change the surface.
 */

import { useEffect, useState } from "react";

export function useCoachmark(storageKey: string): {
  dismissed: boolean;
  dismiss: () => void;
  reset: () => void;
} {
  const read = (): boolean => {
    try { return localStorage.getItem(storageKey) === "1"; }
    catch { return true; } // SSR / private mode → never show
  };
  const [dismissed, setDismissed] = useState<boolean>(read);

  // Re-read on mount in case another tab dismissed since SSR hydration.
  useEffect(() => { setDismissed(read()); /* eslint-disable-next-line */ }, [storageKey]);

  function dismiss(): void {
    try { localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
    setDismissed(true);
  }
  function reset(): void {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    setDismissed(false);
  }
  return { dismissed, dismiss, reset };
}
