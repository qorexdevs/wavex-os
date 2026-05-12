/** Credential drawer — slides up over the chat after the operator confirms
 *  connectors. Each required connector gets a card with vault inputs +
 *  test + skip-with-reason. The operator hits "Done" when every required
 *  connector is either vaulted-or-skipped; the chat then advances to the
 *  swarm phase. */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import { ResponseChips } from "./ResponseChips";

interface Props {
  companyId: string;
  onDone: () => void;
  onCancel: () => void;
}

const SKIP_REASON_OPTS = [
  { value: "not_relevant", label: "Not relevant for our stage" },
  { value: "later", label: "Will configure later from Mission Control" },
  { value: "manual_integration", label: "Data lives in another tool we'll integrate manually" },
  { value: "no_admin_access", label: "No admin access yet" },
];

type ConnectorRow = NonNullable<Awaited<ReturnType<typeof opOmegaOnboardingApi.listCredentials>>>["connectors"][number];

export function CredentialDrawer({ companyId, onDone, onCancel }: Props) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["concierge", companyId],
    queryFn: () => opOmegaOnboardingApi.listCredentials(companyId),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["concierge", companyId] });

  if (list.isLoading) {
    return (
      <DrawerShell onCancel={onCancel}>
        <div style={{ padding: "1rem", color: "var(--text-dim)" }}>Loading credential state…</div>
      </DrawerShell>
    );
  }

  if (list.isError || !list.data) {
    return (
      <DrawerShell onCancel={onCancel}>
        <div style={{ padding: "1rem", color: "var(--warning)" }}>
          ✗ {list.error instanceof Error ? list.error.message : "Failed to load credentials"}
        </div>
      </DrawerShell>
    );
  }

  const required = list.data.connectors.filter((c) => c.bucket === "required");
  const progress = list.data.progress;
  const ready = progress.allRequiredAddressed;
  const pendingRequired = required.filter((c) => c.status === "pending");

  async function skipAllPending(): Promise<void> {
    const reason = "Deferred to post-onboarding (operator skip-all)";
    for (const c of pendingRequired) {
      try { await opOmegaOnboardingApi.skipCredential({ companyId, connectorId: c.connectorId, reason }); }
      catch { /* surface in row card on next refresh */ }
    }
    refresh();
  }

  return (
    <DrawerShell onCancel={onCancel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", gap: "0.75rem" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Credentials</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {pendingRequired.length > 1 && (
            <button
              type="button"
              onClick={() => void skipAllPending()}
              style={{
                fontSize: 11,
                padding: "0.25rem 0.55rem",
                borderRadius: 4,
                background: "transparent",
                color: "var(--text-dim)",
                border: "1px solid var(--border)",
                cursor: "pointer",
              }}
              title={`Skip all ${pendingRequired.length} pending required connectors`}
            >
              Skip all ({pendingRequired.length})
            </button>
          )}
          <span className="text-dim" style={{ fontSize: 12 }}>
            {progress.requiredReady} of {progress.requiredCount} ready
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", maxHeight: "65vh", overflowY: "auto", paddingRight: "0.5rem" }}>
        {required.length === 0 && (
          <div className="text-dim" style={{ fontSize: 12 }}>
            No required connectors. You can proceed.
          </div>
        )}
        {required.map((c) => (
          <ConnectorCard key={c.connectorId} companyId={companyId} c={c} refresh={refresh} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.85rem", paddingTop: "0.7rem", borderTop: "1px solid var(--border)" }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "0.4rem 0.75rem",
            borderRadius: 6,
            background: "transparent",
            color: "var(--text-dim)",
            border: "1px solid var(--border)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Back to chat
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={!ready}
          style={{
            padding: "0.45rem 0.85rem",
            borderRadius: 6,
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            fontWeight: 600,
            fontSize: 12,
            cursor: ready ? "pointer" : "not-allowed",
            opacity: ready ? 1 : 0.5,
          }}
        >
          Done — continue to swarm →
        </button>
      </div>
    </DrawerShell>
  );
}

function ConnectorCard({ companyId, c, refresh }: { companyId: string; c: ConnectorRow; refresh: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [vaulting, setVaulting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipMode, setSkipMode] = useState(false);
  const [skipCanon, setSkipCanon] = useState<string[]>([]);
  const [skipCustom, setSkipCustom] = useState<string[]>([]);

  const isVaulted = c.status === "vaulted_valid" || c.status === "vaulted_unvalidated";
  const isSkipped = c.status === "skipped";
  const composio = c.composioManaged;

  async function handleVaultAll(): Promise<void> {
    setVaulting(true);
    setError(null);
    try {
      for (const k of c.expectedKeys) {
        const v = values[k];
        if (!v) continue;
        await opOmegaOnboardingApi.pasteCredential({ companyId, connectorId: c.connectorId, key: k, plaintext: v });
      }
      if (c.hasProbe) {
        setTesting(true);
        try { await opOmegaOnboardingApi.testCredential({ companyId, connectorId: c.connectorId }); }
        finally { setTesting(false); }
      }
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setVaulting(false);
    }
  }

  async function handleSkip(): Promise<void> {
    const reasonOpt = SKIP_REASON_OPTS.find((o) => o.value === skipCanon[0]);
    const reason = skipCustom[0] ?? reasonOpt?.label ?? "Operator skip";
    setSkipping(true);
    setError(null);
    try {
      await opOmegaOnboardingApi.skipCredential({ companyId, connectorId: c.connectorId, reason });
      setSkipMode(false);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSkipping(false);
    }
  }

  return (
    <div style={{
      padding: "0.65rem 0.75rem",
      background: "var(--bg)",
      border: `1px solid ${isVaulted ? "var(--accent)" : isSkipped ? "var(--border)" : "var(--border)"}`,
      borderRadius: 6,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
          <code style={{ fontWeight: 700, fontSize: 12 }}>{c.connectorId}</code>
          {isVaulted && <span style={{ fontSize: 10, color: "var(--accent)" }}>✓ vaulted</span>}
          {isSkipped && <span style={{ fontSize: 10, color: "var(--text-dim)" }}>↷ skipped</span>}
          {composio && <span style={{ fontSize: 10, color: "var(--text-dim)" }}>Composio</span>}
        </div>
        {c.keysUrl && !isVaulted && !isSkipped && (
          <a href={c.keysUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--accent)" }}>
            Get key ↗
          </a>
        )}
      </div>
      <div className="text-dim" style={{ fontSize: 11, marginBottom: "0.4rem", lineHeight: 1.4 }}>
        {c.rationale}
      </div>

      {!isVaulted && !isSkipped && !skipMode && !composio && (
        <>
          {c.expectedKeys.map((k) => (
            <input
              key={k}
              type="password"
              placeholder={k}
              value={values[k] ?? ""}
              onChange={(e) => setValues((s) => ({ ...s, [k]: e.target.value }))}
              disabled={vaulting || testing}
              style={{
                width: "100%",
                padding: "0.4rem 0.55rem",
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: 12,
                fontFamily: "inherit",
                outline: "none",
                marginBottom: "0.3rem",
              }}
            />
          ))}
          <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.25rem" }}>
            <button
              type="button"
              onClick={() => void handleVaultAll()}
              disabled={vaulting || testing || c.expectedKeys.every((k) => !values[k])}
              style={miniBtn(true)}
            >
              {vaulting || testing ? (testing ? "Testing…" : "Vaulting…") : c.hasProbe ? "Vault & test" : "Vault"}
            </button>
            <button type="button" onClick={() => setSkipMode(true)} style={miniBtn(false)}>
              Skip
            </button>
          </div>
        </>
      )}

      {!isVaulted && !isSkipped && composio && !skipMode && (
        <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.25rem" }}>
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Connect via Composio from Mission Control later.</span>
          <button type="button" onClick={() => setSkipMode(true)} style={miniBtn(false)}>Skip</button>
        </div>
      )}

      {skipMode && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.4rem" }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Why?</div>
          <ResponseChips
            mode="single"
            options={SKIP_REASON_OPTS}
            values={skipCanon}
            customValues={skipCustom}
            allowCustom
            customLabel="Other reason"
            onChange={setSkipCanon}
            onCustomChange={setSkipCustom}
            disabled={skipping}
          />
          <div style={{ display: "flex", gap: "0.35rem" }}>
            <button
              type="button"
              onClick={() => void handleSkip()}
              disabled={skipping}
              style={miniBtn(true)}
            >
              {skipping ? "Skipping…" : "Confirm skip"}
            </button>
            <button type="button" onClick={() => setSkipMode(false)} style={miniBtn(false)}>Cancel</button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: "var(--warning)", fontSize: 11, marginTop: "0.3rem" }}>✗ {error}</div>
      )}
      {isSkipped && c.skipReason && (
        <div className="text-dim" style={{ fontSize: 11, marginTop: "0.2rem" }}>↷ {c.skipReason}</div>
      )}
    </div>
  );
}

function DrawerShell({ children, onCancel }: { children: React.ReactNode; onCancel: () => void }) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "color-mix(in srgb, var(--bg) 65%, transparent)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "fadeIn 200ms",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          padding: "1.1rem 1.25rem 1.25rem",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function miniBtn(primary: boolean): React.CSSProperties {
  return {
    padding: "0.3rem 0.65rem",
    fontSize: 11,
    borderRadius: 4,
    background: primary ? "var(--accent)" : "transparent",
    color: primary ? "var(--bg)" : "var(--text-dim)",
    border: primary ? "none" : "1px solid var(--border)",
    fontWeight: primary ? 600 : 400,
    cursor: "pointer",
  };
}
