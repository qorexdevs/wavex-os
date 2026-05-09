/** Confirm modal for the destructive Reset action. Shared between the
 *  WelcomeScreen "Reset this company" flow and the in-wizard header
 *  reset affordance. */

interface Props {
  companyId: string;
  busy: boolean;
  onCancel: () => void;
  /** restart=true → after reset, drop the operator at Pillar 1 with the
   *  same companyId. restart=false → reset and stay on the welcome screen. */
  onConfirm: (restart: boolean) => void;
}

export function ConfirmResetModal({ companyId, busy, onCancel, onConfirm }: Props) {
  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--warning)",
          borderRadius: 8,
          padding: "1.5rem",
          maxWidth: 480,
          width: "90%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0, color: "var(--warning)" }}>Reset <code>{companyId}</code>?</h3>
        <p style={{ fontSize: 14, marginBottom: "1rem" }}>
          This permanently deletes:
        </p>
        <ul style={{ fontSize: 13, marginBottom: "1.25rem", paddingLeft: "1.25rem", color: "var(--text-dim)" }}>
          <li>All onboarding artifacts (pillar responses, manifests, signatures, MC report, refinement history)</li>
          <li>The signed company manifest if finalized</li>
          <li>Activated DB state — agents, KPIs, credentials, audit log, snapshots, cost events, issues, attributions</li>
        </ul>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: "1.25rem" }}>
          The companyId itself is preserved — choose <strong>Reset + restart</strong> to drop into Pillar 1 with the same id, or <strong>Reset only</strong> to clear and return to the welcome screen.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(false)}
            disabled={busy}
            style={{ background: "var(--warning)", color: "#000" }}
          >
            {busy ? "Resetting…" : "Reset only"}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(true)}
            disabled={busy}
            style={{ background: "var(--warning)", color: "#000" }}
          >
            {busy ? "Resetting…" : "Reset + restart →"}
          </button>
        </div>
      </div>
    </div>
  );
}
