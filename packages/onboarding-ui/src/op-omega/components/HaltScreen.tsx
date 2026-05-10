/** Halt screen — surfaced when a pillar/phase returns OnboardingHaltPayload.
 *  Op-omega's fail-closed pattern: never advance through silent-broken state.
 *  Operator can override + proceed only when allow_override === true. */

import type { OnboardingHaltPayload } from "@op-omega/plugin-onboarding";

export function HaltScreen({
  halt,
  onRetry,
  onOverride,
}: {
  halt: OnboardingHaltPayload;
  onRetry?: () => void;
  onOverride?: () => void;
}) {
  return (
    <div className="card" style={{ borderColor: "var(--warning)" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--warning)", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
        ◷ HALT — {halt.code}
      </div>
      <div style={{ fontSize: 15, marginBottom: "1rem" }}>{halt.operator_message}</div>
      {halt.engineer_detail && (
        <div className="text-dim" style={{ fontSize: 12, marginBottom: "1rem", fontFamily: "monospace" }}>
          {halt.engineer_detail}
        </div>
      )}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {onRetry && (
          <button onClick={onRetry} className="secondary" type="button">Retry</button>
        )}
        {halt.allow_override && onOverride && (
          <button onClick={onOverride} type="button">Override + proceed (writes anomaly flag)</button>
        )}
      </div>
    </div>
  );
}
