/** Credential Concierge — walks every connector recommended by Phase 2 and
 *  surfaces the right configuration UI per type:
 *    - Direct-key (Supabase, GitHub, Stripe, etc.) → password-masked inputs
 *      per expected key + Vault & Test button. Test result inline.
 *    - Composio-managed (Slack, Discord, Gmail, …) → "Connect via Composio"
 *      placeholder; surfaces "configure later from Mission Control" in dev mode.
 *    - Pre-vaulted (claude-code from Pillar 2, telegram from Pillar 5) →
 *      green badge, no input needed.
 *    - Any → "Skip for now" with required reason.
 *  Continue is gated until every required connector is either vaulted_valid /
 *  vaulted_unvalidated / skipped (with reason). */

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { wavexOsOnboardingApi, ApiError } from "../lib/api";
import { Card, H2, NavRow, P } from "../components/primitives";

interface Props {
  companyId: string;
  onComplete: () => void;
}

type ConnectorRow = NonNullable<Awaited<ReturnType<typeof wavexOsOnboardingApi.listCredentials>>>["connectors"][number];

const SKIP_REASONS = [
  "Not relevant for our stage",
  "Will configure later from Mission Control",
  "Data lives in a different tool we'll integrate manually",
  "Don't have admin access to the upstream system yet",
  "Other (typed)",
];

export function CredentialConcierge({ companyId, onComplete }: Props) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["concierge", companyId],
    queryFn: () => wavexOsOnboardingApi.listCredentials(companyId),
  });
  const [skipAllBusy, setSkipAllBusy] = useState(false);
  const [skipAllConfirm, setSkipAllConfirm] = useState(false);
  const [skipAllError, setSkipAllError] = useState<string | null>(null);
  const [skipAllReport, setSkipAllReport] = useState<{ skipped: number; failed: number } | null>(null);

  if (list.isLoading) {
    return <div style={{ padding: "2rem", color: "var(--text-dim)" }}>Loading credential state…</div>;
  }
  if (list.isError) {
    return <div style={{ padding: "2rem", color: "var(--warning)" }}>Failed: {(list.error as Error).message}</div>;
  }

  const data = list.data!;
  const required = data.connectors.filter((c) => c.bucket === "required");
  const suggested = data.connectors.filter((c) => c.bucket === "suggested");
  const deferred = data.connectors.filter((c) => c.bucket === "deferred");

  const refresh = () => qc.invalidateQueries({ queryKey: ["concierge", companyId] });

  const pendingRequired = required.filter((c) => c.status === "pending");

  async function handleSkipAll(): Promise<void> {
    setSkipAllBusy(true);
    setSkipAllError(null);
    const reason = "Deferred to post-onboarding (operator skip-all)";
    let skipped = 0;
    let failed = 0;
    for (const c of pendingRequired) {
      try {
        await wavexOsOnboardingApi.skipCredential({ companyId, connectorId: c.connectorId, reason });
        skipped++;
      } catch {
        failed++;
      }
    }
    setSkipAllReport({ skipped, failed });
    setSkipAllConfirm(false);
    await refresh();
    setSkipAllBusy(false);
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "2rem" }}>
      <H2>Credential Concierge</H2>
      <P>
        Vault credentials for every connector your fleet needs. Required
        connectors must be either configured + tested OR explicitly skipped
        (with a reason recorded in the manifest) before you can finalize.
        Suggested + deferred can be added now or later from Mission Control.
      </P>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ fontSize: 13 }}>
            <strong>{data.progress.requiredReady}/{data.progress.requiredCount}</strong>{" "}
            required connectors addressed
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ height: 6, width: 200, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${data.progress.requiredCount === 0 ? 100 : Math.round(100 * data.progress.requiredReady / data.progress.requiredCount)}%`,
                background: "var(--accent)",
                transition: "width 0.3s ease-out",
              }} />
            </div>
            {pendingRequired.length > 0 && (
              <button
                type="button"
                className="secondary"
                onClick={() => { setSkipAllConfirm(true); setSkipAllError(null); }}
                disabled={skipAllBusy}
                title="Defer every pending required connector — configure them post-onboarding from Mission Control"
                style={{ fontSize: 12, padding: "0.3rem 0.7rem" }}
              >
                ↷ Skip all ({pendingRequired.length})
              </button>
            )}
          </div>
        </div>
        {skipAllReport && (
          <div style={{ fontSize: 12, color: "var(--accent)", marginTop: "0.5rem" }}>
            ✓ Skipped {skipAllReport.skipped}{skipAllReport.failed > 0 ? ` · ${skipAllReport.failed} failed` : ""} — configure later from Mission Control.
          </div>
        )}
        {skipAllError && (
          <div style={{ fontSize: 12, color: "var(--warning)", marginTop: "0.5rem" }}>✗ {skipAllError}</div>
        )}
      </Card>

      {skipAllConfirm && (
        <SkipAllModal
          count={pendingRequired.length}
          busy={skipAllBusy}
          onCancel={() => setSkipAllConfirm(false)}
          onConfirm={() => void handleSkipAll()}
        />
      )}

      {required.length > 0 && (
        <Section title="Required" rows={required} companyId={companyId} onChange={refresh} />
      )}
      {suggested.length > 0 && (
        <Section title="Suggested" rows={suggested} companyId={companyId} onChange={refresh} />
      )}
      {deferred.length > 0 && (
        <Section title="Deferred (revisit later)" rows={deferred} companyId={companyId} onChange={refresh} />
      )}

      <NavRow
        next={{ onClick: onComplete, label: "Continue → swarm" }}
        nextDisabled={!data.progress.allRequiredAddressed}
      />

      {!data.progress.allRequiredAddressed && (
        <p className="text-dim" style={{ fontSize: 12, marginTop: 8, textAlign: "right" }}>
          Address all {data.progress.requiredCount} required connectors to continue.
        </p>
      )}
    </div>
  );
}

function SkipAllModal({
  count, busy, onCancel, onConfirm,
}: {
  count: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
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
        <h3 style={{ marginTop: 0 }}>Skip {count} pending required connector{count === 1 ? "" : "s"}?</h3>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: "1rem" }}>
          Each will be marked as <code>skipped</code> with reason{" "}
          <em>"Deferred to post-onboarding (operator skip-all)"</em>. The
          manifest still records the requirement so Mission Control can
          surface them later for configuration.
        </p>
        <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: "1.25rem" }}>
          You can re-vault any of them after onboarding by clicking{" "}
          <em>vault credentials to un-skip</em> on the connector card.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{ background: "var(--warning)", color: "#000" }}
          >
            {busy ? "Skipping…" : `Skip all ${count} →`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title, rows, companyId, onChange,
}: {
  title: string;
  rows: ConnectorRow[];
  companyId: string;
  onChange: () => void;
}) {
  return (
    <div style={{ marginTop: "1rem" }}>
      <h3 style={{ fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
        {title}
      </h3>
      {rows.map((r) => (
        <ConnectorCard key={r.connectorId} row={r} companyId={companyId} onChange={onChange} />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectorRow["status"] }) {
  const map = {
    vaulted_valid:       { label: "✓ Vaulted + tested",   bg: "var(--accent)",  fg: "var(--bg)" },
    vaulted_unvalidated: { label: "● Vaulted (untested)", bg: "var(--warning)", fg: "var(--bg)" },
    skipped:             { label: "↷ Skipped",            bg: "var(--text-dim)", fg: "var(--bg)" },
    pending:             { label: "○ Pending",            bg: "transparent", fg: "var(--text-dim)" },
  } as const;
  const m = map[status];
  return (
    <span style={{
      padding: "2px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase",
      letterSpacing: "0.05em", borderRadius: 3, background: m.bg, color: m.fg,
      border: status === "pending" ? "1px solid var(--border)" : "none",
    }}>
      {m.label}
    </span>
  );
}

function ConnectorCard({ row, companyId, onChange }: { row: ConnectorRow; companyId: string; onChange: () => void }) {
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>(
    () => Object.fromEntries(row.expectedKeys.map((k) => [k, ""])),
  );
  const [busy, setBusy] = useState<"vault" | "test" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipMode, setSkipMode] = useState(false);
  const [skipReason, setSkipReason] = useState(SKIP_REASONS[0]);
  const [skipCustomReason, setSkipCustomReason] = useState("");
  /** When the operator has skipped this connector but wants to un-skip
   *  (re-show the paste form), this overrides the skipped-state hide. */
  const [revealAfterSkip, setRevealAfterSkip] = useState(false);

  // Reset local input state when server state for this connector changes.
  useEffect(() => {
    setKeyInputs(Object.fromEntries(row.expectedKeys.map((k) => [k, ""])));
  }, [row.expectedKeys.join(","), row.status]);

  async function handleVault(): Promise<void> {
    setBusy("vault");
    setError(null);
    try {
      // Vault every key the operator filled in. Skip empties.
      for (const key of row.expectedKeys) {
        const v = keyInputs[key]?.trim();
        if (!v) continue;
        await wavexOsOnboardingApi.pasteCredential({
          companyId, connectorId: row.connectorId, key, plaintext: v,
        });
      }
      // Auto-test if a probe exists
      if (row.hasProbe) {
        try {
          await wavexOsOnboardingApi.testCredential({ companyId, connectorId: row.connectorId });
        } catch { /* test failure is recorded server-side; surface via list refresh */ }
      }
      onChange();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleTest(): Promise<void> {
    setBusy("test");
    setError(null);
    try {
      await wavexOsOnboardingApi.testCredential({ companyId, connectorId: row.connectorId });
      onChange();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleSkip(): Promise<void> {
    const reason = skipReason === "Other (typed)" ? skipCustomReason.trim() : skipReason;
    if (reason.length < 3) { setError("Reason required (≥3 chars)"); return; }
    setBusy("skip");
    setError(null);
    try {
      await wavexOsOnboardingApi.skipCredential({ companyId, connectorId: row.connectorId, reason });
      setSkipMode(false);
      onChange();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const allRequiredKeysFilled = row.expectedKeys.length > 0
    && row.expectedKeys.every((k) => keyInputs[k]?.trim().length);
  const isAlreadyVaulted = row.status === "vaulted_valid" || row.status === "vaulted_unvalidated";

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{row.connectorId}</span>
        <span className="text-dim" style={{ fontSize: 11 }}>· {row.priority}</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {row.keysUrl && (
            <a
              href={row.keysUrl}
              target="_blank"
              rel="noreferrer noopener"
              title={`Open ${row.connectorId} key management page`}
              style={{
                fontSize: 11, padding: "0.15rem 0.5rem", borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                textDecoration: "none",
              }}
            >
              ↗ Get key
            </a>
          )}
          <StatusBadge status={row.status} />
        </div>
      </div>
      <div className="text-dim" style={{ fontSize: 12, marginBottom: "0.75rem" }}>{row.rationale}</div>

      {/* MCP-first: highest priority. If the customer already has an MCP
          server installed for this connector, skip every other UI surface
          and just confirm they're set. No paste, no OAuth popup. */}
      {row.mcpManaged && row.status !== "skipped" && (
        <div style={{
          padding: "0.6rem", background: "var(--bg)", borderRadius: 4, fontSize: 12,
          border: "1px solid var(--accent)",
        }}>
          <div style={{ color: "var(--accent)", fontWeight: 600, marginBottom: 4 }}>
            ✓ Connected via your existing {row.mcpSourcedFrom} MCP
          </div>
          <div className="text-dim">
            We detected the <code>{row.connectorId}</code> MCP server on your machine —
            your fleet will use that connection. No keys to paste.
          </div>
        </div>
      )}

      {/* Pre-vaulted (claude-code from Pillar 2 — no expected keys) */}
      {!row.mcpManaged && row.expectedKeys.length === 0 && !row.composioManaged && (
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
          ✓ Configured upstream (Pillar 2 / 5). No additional credentials needed.
        </div>
      )}

      {/* MCP-install hint — third option below MCP-detected / OAuth / paste.
          Renders when an official MCP is available but the customer hasn't
          installed it, so they can pick: install MCP → no credentials needed. */}
      {!row.mcpManaged && row.mcpAvailable && row.mcpInstallHint && row.status !== "skipped" && (
        <div style={{
          marginBottom: "0.5rem",
          padding: "0.5rem 0.65rem",
          fontSize: 11,
          color: "var(--text-dim)",
          background: "var(--surface-2)",
          border: "1px dashed var(--border)",
          borderRadius: 4,
          lineHeight: 1.5,
        }}>
          <span style={{ color: "var(--accent)" }}>◇</span>
          {" "}{row.mcpInstallHint.install_hint}
          {" "}
          <a
            href={row.mcpInstallHint.docs}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)" }}
          >
            Install MCP ↗
          </a>
        </div>
      )}

      {/* Composio-managed (only when no MCP available) */}
      {!row.mcpManaged && row.composioManaged && !skipMode && row.status !== "skipped" && (
        <ComposioConnectBlock
          connectorId={row.connectorId}
          companyId={companyId}
          onSkip={() => setSkipMode(true)}
          onConnected={onChange}
          parentBusy={busy !== null}
        />
      )}

      {/* Direct-key paste form — hidden when already skipped unless the
          operator clicked "vault credentials to un-skip". Also hidden when
          we found a matching MCP server (handled above). */}
      {!row.mcpManaged && row.expectedKeys.length > 0 && !skipMode && (row.status !== "skipped" || revealAfterSkip) && (
        <div>
          {row.expectedKeys.map((k) => {
            const isVaulted = row.vaultedKeys.includes(k);
            return (
              <div key={k} style={{ marginBottom: "0.5rem" }}>
                <label style={{ display: "block", fontSize: 11, marginBottom: 2, color: "var(--text-dim)" }}>
                  {k}
                  {isVaulted && (
                    <span style={{ marginLeft: 6, padding: "1px 5px", background: "var(--accent)", color: "var(--bg)", borderRadius: 3, fontSize: 9, fontWeight: 600, textTransform: "uppercase" }}>
                      saved · vaulted
                    </span>
                  )}
                </label>
                <input
                  type={k.includes("token") || k.includes("key") || k.includes("pat") || k.includes("secret") ? "password" : "text"}
                  value={keyInputs[k] ?? ""}
                  onChange={(e) => setKeyInputs((s) => ({ ...s, [k]: e.target.value }))}
                  placeholder={isVaulted ? "(saved — type to rotate)" : `paste ${k}`}
                  disabled={busy !== null}
                  style={{ fontSize: 12 }}
                />
              </div>
            );
          })}

          {row.lastTestResult && (
            <div style={{
              fontSize: 11,
              color: row.lastTestResult.ok ? "var(--accent)" : "var(--warning)",
              marginTop: "0.5rem",
            }}>
              {row.lastTestResult.ok ? "✓" : "✗"} {row.lastTestResult.detail}
              {row.lastTestedAt && (
                <span className="text-dim" style={{ marginLeft: 6 }}>
                  · {new Date(row.lastTestedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void handleVault()}
              disabled={busy !== null || !allRequiredKeysFilled}
              style={{ fontSize: 12 }}
            >
              {busy === "vault" ? "Vaulting…" : isAlreadyVaulted ? "Re-vault + test" : "Vault & Test"}
            </button>
            {isAlreadyVaulted && row.hasProbe && (
              <button
                type="button"
                className="secondary"
                onClick={() => void handleTest()}
                disabled={busy !== null}
                style={{ fontSize: 12 }}
              >
                {busy === "test" ? "Testing…" : "Re-test"}
              </button>
            )}
            <button
              type="button"
              className="secondary"
              onClick={() => setSkipMode(true)}
              disabled={busy !== null}
              style={{ fontSize: 12 }}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Skip mode */}
      {skipMode && (
        <div style={{ marginTop: "0.5rem" }}>
          <label style={{ display: "block", fontSize: 11, marginBottom: 4, color: "var(--text-dim)" }}>
            Why are you skipping?
          </label>
          <select value={skipReason} onChange={(e) => setSkipReason(e.target.value)} style={{ fontSize: 12, marginBottom: 6 }}>
            {SKIP_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {skipReason === "Other (typed)" && (
            <input
              type="text"
              value={skipCustomReason}
              onChange={(e) => setSkipCustomReason(e.target.value)}
              placeholder="describe (≥3 chars)"
              style={{ fontSize: 12, marginBottom: 6 }}
            />
          )}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={() => void handleSkip()} disabled={busy !== null} style={{ fontSize: 12 }}>
              {busy === "skip" ? "Skipping…" : "Confirm skip"}
            </button>
            <button type="button" className="secondary" onClick={() => setSkipMode(false)} disabled={busy !== null} style={{ fontSize: 12 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Already-skipped state — surface the reason; offer un-skip button
          that reveals the paste form (or Composio button) so the operator
          can change their mind without leaving the page. */}
      {row.status === "skipped" && !skipMode && !revealAfterSkip && (
        <div style={{ fontSize: 12, marginTop: "0.5rem", color: "var(--text-dim)" }}>
          ↷ Skipped — reason: <em>"{row.skipReason}"</em>
          {row.expectedKeys.length > 0 && (
            <button type="button" className="secondary" onClick={() => setRevealAfterSkip(true)} style={{ fontSize: 11, marginLeft: 8 }}>
              vault credentials to un-skip
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 11, color: "var(--warning)", marginTop: "0.5rem" }}>
          ✗ {error}
        </div>
      )}
    </Card>
  );
}

/** Per-toolkit Composio connect widget.
 *
 *  Two surfaces:
 *
 *  1. Hosted mode (customer's installer pointed WAVEX_INFERENCE_HUB_URL at
 *     the operator's Mac mini): the [Connect] button POSTs to mock-core's
 *     /wavex-os/onboarding/connectors/oauth/initiate, which proxies to the
 *     hub. Hub returns a Composio-hosted redirect URL — we open it in a
 *     popup, then poll the hub's connection list every 2s until this
 *     toolkit appears with status `ACTIVE` (Composio's enum). When detected,
 *     we mark vaulted_unvalidated server-side via the existing paste route
 *     with a sentinel ref, then call `onConnected` to refresh.
 *
 *  2. Disabled mode (no hub OR hub returned needsLiveWiring=true OR
 *     non-hosted with composio-shim disabled): the old "Skip for now"
 *     callout — operator can still skip + configure later.
 *
 *  The component figures out which mode it's in lazily on first [Connect]
 *  click: we try initiate; if `url` comes back null with `needsLiveWiring`,
 *  we flip to disabled-mode UI permanently. */
function ComposioConnectBlock({
  connectorId, companyId, onSkip, onConnected, parentBusy,
}: {
  connectorId: string;
  companyId: string;
  onSkip: () => void;
  onConnected: () => void;
  parentBusy: boolean;
}) {
  const [state, setState] = useState<"idle" | "opening" | "pending" | "needsManual" | "connected" | "error">("idle");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [popupRef, setPopupRef] = useState<Window | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Poll the hub list every 2s while pending. Stops when this toolkit
  // shows up active OR the popup is detected closed without success.
  useEffect(() => {
    if (state !== "pending") return;
    const id = setInterval(() => { void checkStatus(); }, 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pendingId]);

  async function handleConnect(): Promise<void> {
    setState("opening");
    setErrorMsg(null);
    try {
      const r = await wavexOsOnboardingApi.initiateConnectorOAuth({
        companyId,
        toolkitSlug: connectorId,
      });
      if (r.needsLiveWiring || !r.url) {
        setState("needsManual");
        return;
      }
      // Open the Composio URL in a popup. It immediately 302s to the native
      // provider's OAuth screen (Google/Slack/etc.) — customer never sees
      // Composio's UI, only the familiar provider consent screen.
      const popup = window.open(
        r.url,
        `wavex-oauth-${connectorId}`,
        "width=520,height=720,menubar=no,toolbar=no,location=yes,status=no",
      );
      if (!popup) {
        setErrorMsg("Popup blocked. Allow popups for this site and try again.");
        setState("error");
        return;
      }
      setPopupRef(popup);
      setPendingId(r.pendingConnectionId);
      setState("pending");
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.message : (e as Error).message);
      setState("error");
    }
  }

  async function checkStatus(): Promise<void> {
    // Detect popup closed by user (cancellation) → return to idle.
    if (popupRef && popupRef.closed && state === "pending") {
      // Continue polling once more in case OAuth completed but the bounce
      // page closed before we noticed. After two checks with no match, stop.
    }
    try {
      const r = await wavexOsOnboardingApi.listHostedConnections();
      const match = r.connections.find(
        (c) => c.toolkit_slug === connectorId && c.status?.toLowerCase() === "active",
      );
      if (match) {
        setState("connected");
        try { popupRef?.close(); } catch { /* cross-origin tolerance */ }
        // Mark vaulted_unvalidated server-side via the existing credential
        // route so the manifest reflects the connection. We use a sentinel
        // "composio:<id>" plaintext that the vault doesn't try to interpret —
        // the actual auth token lives at Composio.
        try {
          await wavexOsOnboardingApi.pasteCredential({
            companyId,
            connectorId,
            key: "composio_connection_id",
            plaintext: `composio:${match.id ?? "unknown"}`,
          });
        } catch { /* server may reject if no expectedKeys; concierge still re-renders */ }
        onConnected();
      }
    } catch {
      // Transient network errors are ignored — next tick retries.
    }
  }

  // ── Disabled mode (no hub or hub says composio_unavailable) ──
  if (state === "needsManual") {
    return (
      <div style={{ padding: "0.6rem", background: "var(--bg)", borderRadius: 4, fontSize: 12 }}>
        <div style={{ marginBottom: 4 }}>
          <strong>Composio OAuth not available.</strong>
        </div>
        <div className="text-dim" style={{ marginBottom: "0.5rem" }}>
          The operator's hub doesn't have Composio configured (or the customer install
          is in non-hosted mode). Skip for now and configure from Mission Control once
          the credential lands.
        </div>
        <button
          type="button"
          className="secondary"
          onClick={onSkip}
          disabled={parentBusy}
          style={{ fontSize: 12 }}
        >
          Skip
        </button>
      </div>
    );
  }

  // ── Active OAuth flow ──
  return (
    <div style={{ padding: "0.6rem", background: "var(--bg)", borderRadius: 4, fontSize: 12 }}>
      <div style={{ marginBottom: 6 }}>
        <strong>Connect via OAuth.</strong>
        <span className="text-dim" style={{ marginLeft: 6 }}>
          Opens {connectorId}'s sign-in in a popup. No keys to paste.
        </span>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void handleConnect()}
          disabled={parentBusy || state === "opening" || state === "pending" || state === "connected"}
          style={{ fontSize: 12 }}
        >
          {state === "connected" ? "✓ Connected" :
           state === "pending" ? "Connecting…" :
           state === "opening" ? "Opening…" :
           "Connect"}
        </button>
        {state !== "connected" && state !== "pending" && (
          <button
            type="button"
            className="secondary"
            onClick={onSkip}
            disabled={parentBusy}
            style={{ fontSize: 12 }}
          >
            Skip
          </button>
        )}
        {state === "pending" && (
          <span className="text-dim" style={{ fontSize: 11 }}>
            Waiting for OAuth completion in popup…
          </span>
        )}
      </div>
      {state === "error" && errorMsg && (
        <div style={{ fontSize: 11, color: "var(--warning)", marginTop: "0.5rem" }}>
          ✗ {errorMsg}
        </div>
      )}
    </div>
  );
}
