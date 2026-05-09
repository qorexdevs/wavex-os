/** Halt screen — surfaced when a pillar/phase returns OnboardingHaltPayload.
 * Op-omega's fail-closed pattern: never advance through silent-broken state. */

import type { OnboardingHaltPayload } from "@op-omega/plugin-onboarding";

export function HaltScreen({ halt, onRetry }: { halt: OnboardingHaltPayload; onRetry?: () => void }) {
  return (
    <div className="card" style={{ borderColor: "var(--warning)" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--warning)", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
        ◷ HALT — {halt.code}
      </div>
      <div style={{ fontSize: 15, marginBottom: "1rem" }}>{halt.operator_message}</div>
      {halt.fix_hint && (
        <div className="text-dim" style={{ fontSize: 13, marginBottom: "1rem" }}>
          <strong>Fix:</strong> {halt.fix_hint}
        </div>
      )}
      {halt.retryable && onRetry && (
        <button onClick={onRetry} className="secondary" type="button">Retry</button>
      )}
    </div>
  );
}
