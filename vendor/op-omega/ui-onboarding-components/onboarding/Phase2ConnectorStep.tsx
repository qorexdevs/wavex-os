/**
 * Phase 2 Connector Step · Composio integration onboarding fold-in.
 *
 * Surfaces connector recommendations inline in onboarding (between Pillar 5
 * and the manifest preview phases). Each recommendation renders as a card
 * with a Connect button that opens a popup OAuth flow. The component polls
 * the popup's `closed` state, then refetches the recommendations to detect
 * when a connection has landed.
 *
 * Operator can plug zero, one, or many — Continue is always enabled. Cycle-0
 * F2 (operator must plug connectors) auto-resolves the moment they connect
 * one or more here.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Cable, Check, ExternalLink, Loader2, Plug, ShieldAlert } from "lucide-react";
import {
  opOmegaOnboardingApi,
  type ConnectorRecommendationEntry,
} from "../../../api/opOmegaOnboarding";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { friendlyConnectorName } from "./connector-view";
import { ErrorLine, H2, P } from "./primitives";
import { ApiError } from "../../../api/client";

/**
 * Detect "Composio session expired / key revoked" errors. The server tags
 * these with `code: "composio.invalid_api_key"` (see
 * server/src/routes/connectors.ts). On any such error, the operator's
 * recovery is "paste a fresh API key" — i.e. go back to composio_bootstrap.
 */
function isComposioSessionExpired(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  const code = (err.body as { code?: string } | null)?.code;
  return code === "composio.invalid_api_key";
}

export function Phase2ConnectorStep({
  companyId,
  onComplete,
  onSessionExpired,
}: {
  companyId: string;
  onComplete: () => void;
  /**
   * Fired when a Composio call returns `composio.invalid_api_key` —
   * indicates the API key was valid at bootstrap time but has since been
   * revoked, rotated, or expired. The parent should route back to
   * composio_bootstrap so the operator can paste a fresh key.
   */
  onSessionExpired?: () => void;
}) {
  const qc = useQueryClient();
  // Locally-tracked "skip for now" decisions per toolkit slug — keeps the operator
  // moving without requiring a server round-trip. Persisted to localStorage so
  // a refresh in the middle of this step doesn't resurface already-skipped tools.
  const declinedStorageKey = `op-omega.declined-connectors.${companyId}`;
  const [declined, setDeclined] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(declinedStorageKey);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(declinedStorageKey, JSON.stringify([...declined]));
    } catch {
      // Quota / private browsing — fail silently; operator just loses persistence.
    }
  }, [declined, declinedStorageKey]);

  const recs = useQuery({
    queryKey: ["op-omega", "connector-recommendations", companyId],
    queryFn: () => opOmegaOnboardingApi.connectorRecommendations(companyId),
    enabled: Boolean(companyId),
  });

  // Capture child-card session-expired signals here so we render the recovery
  // banner once at the step level instead of N times across cards.
  const [sessionExpired, setSessionExpired] = useState(false);
  useEffect(() => {
    if (sessionExpired && onSessionExpired) {
      // Don't auto-route — operator may want to manually go back. Render
      // an explicit "Re-paste your key" button + banner instead.
    }
  }, [sessionExpired, onSessionExpired]);
  useEffect(() => {
    // Recommendations call also routes through Composio (it queries
    // connection state), so a 401 there means "session expired" too.
    if (recs.isError && isComposioSessionExpired(recs.error)) {
      setSessionExpired(true);
    }
  }, [recs.isError, recs.error]);

  const refetch = () => {
    qc.invalidateQueries({
      queryKey: ["op-omega", "connector-recommendations", companyId],
    });
  };

  // Friction-fix #3: detect whether the Composio bootstrap step was completed.
  // If composio_api_key isn't `valid`, Connect buttons would 500 with friendly
  // copy but the operator wouldn't see the recovery hint inline. Surface a
  // banner at the top + gate Connect buttons with explicit guidance.
  const credentialsState = useQuery({
    queryKey: ["op-omega", "credentials", companyId],
    queryFn: () => opOmegaOnboardingApi.credentialsState(companyId),
    enabled: Boolean(companyId),
  });
  const composioReady = credentialsState.data?.bootstrap.composio_api_key === "valid";

  const required = recs.data?.required ?? [];
  const suggested = recs.data?.suggested ?? [];
  const allEntries = useMemo(() => [...required, ...suggested], [required, suggested]);

  const connectedCount = allEntries.filter((e) => e.status === "configured").length;
  const pendingCount = allEntries.filter(
    (e) => e.status !== "configured" && !declined.has(e.id),
  ).length;

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Cable className="size-3.5" /> Wiring your tools · 2 of 3
        </div>
        <H2>Connect the tools your Swarm needs</H2>
        <P>
          We've matched these tools to your answers. Connecting now means your data
          agents wake up the moment your team goes live. You can always plug more
          later from the dashboard.
        </P>
      </header>

      {recs.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading recommendations…
        </div>
      )}
      {recs.isError && (
        <ErrorLine>
          {recs.error instanceof Error ? recs.error.message : "Failed to load recommendations"}
        </ErrorLine>
      )}

      {sessionExpired && onSessionExpired && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-xs">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="flex-1 space-y-2">
            <div className="font-medium text-red-700 dark:text-red-300">
              Composio session expired
            </div>
            <div className="text-muted-foreground">
              Your API key was valid at bootstrap but Composio is now rejecting it
              (revoked, rotated, or otherwise invalidated). Re-paste a fresh key
              to continue.
            </div>
            <Button size="sm" variant="outline" onClick={onSessionExpired}>
              Re-paste API key
            </Button>
          </div>
        </div>
      )}

      {/* Friction-fix #3: warn when Composio bootstrap was skipped or invalid.
          Connect buttons would otherwise return 500 with a friendly message
          that's only visible inline on the failing card. */}
      {credentialsState.data && !composioReady && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <div className="font-medium text-amber-700 dark:text-amber-300">
              Composio API key not validated
            </div>
            <div className="text-muted-foreground">
              Connect buttons need a valid Composio API key. Either go back to the bootstrap step to
              paste it, or skip these tools and connect them later from your dashboard.
            </div>
          </div>
        </div>
      )}

      {required.length > 0 && (
        <ToolkitSection
          title="Required for your setup"
          subtitle="Your Swarm leans on these. Plug at least one before going live for best signal."
          entries={required}
          companyId={companyId}
          declined={declined}
          onDecline={(id) =>
            setDeclined((prev) => {
              const next = new Set(prev);
              next.add(id);
              return next;
            })
          }
          onConnected={refetch}
          composioReady={composioReady}
          onSessionExpired={() => setSessionExpired(true)}
        />
      )}

      {suggested.length > 0 && (
        <ToolkitSection
          title="Recommended for your situation"
          subtitle="These unlock additional capabilities specific to your stage and motion."
          entries={suggested}
          companyId={companyId}
          declined={declined}
          onDecline={(id) =>
            setDeclined((prev) => {
              const next = new Set(prev);
              next.add(id);
              return next;
            })
          }
          onConnected={refetch}
          composioReady={composioReady}
          onSessionExpired={() => setSessionExpired(true)}
        />
      )}

      <footer className="space-y-2 border-t pt-3">
        <div className="text-xs text-muted-foreground">
          {connectedCount > 0
            ? `${connectedCount} connected · ${pendingCount} still pending. You can plug the rest later from your dashboard.`
            : pendingCount > 0
              ? `${pendingCount} recommendations available. Skipping is fine — your CDO will surface this on cycle-1.`
              : "All caught up — continue when ready."}
        </div>
        <div className="flex justify-end">
          <Button onClick={onComplete}>
            Continue <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>
      </footer>
    </Card>
  );
}

function ToolkitSection({
  title,
  subtitle,
  entries,
  companyId,
  declined,
  onDecline,
  onConnected,
  composioReady,
  onSessionExpired,
}: {
  title: string;
  subtitle: string;
  entries: ConnectorRecommendationEntry[];
  companyId: string;
  declined: Set<string>;
  onDecline: (id: string) => void;
  onConnected: () => void;
  composioReady: boolean;
  onSessionExpired: () => void;
}) {
  return (
    <section className="space-y-2">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="space-y-2">
        {entries.map((entry) => (
          <ToolkitCard
            key={entry.id}
            entry={entry}
            companyId={companyId}
            declined={declined.has(entry.id)}
            onDecline={() => onDecline(entry.id)}
            onConnected={onConnected}
            composioReady={composioReady}
            onSessionExpired={onSessionExpired}
          />
        ))}
      </div>
    </section>
  );
}

function ToolkitCard({
  entry,
  companyId,
  declined,
  onDecline,
  onConnected,
  composioReady,
  onSessionExpired,
}: {
  entry: ConnectorRecommendationEntry;
  companyId: string;
  declined: boolean;
  onDecline: () => void;
  onConnected: () => void;
  composioReady: boolean;
  onSessionExpired: () => void;
}) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Set when an attempt completes (popup closed) but the entry didn't transition
  // to `configured`. Used to surface "didn't see a connection — try again?" so
  // the operator isn't left guessing whether their OAuth click succeeded.
  const [attemptCompleted, setAttemptCompleted] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const initiate = useMutation({
    mutationFn: () =>
      opOmegaOnboardingApi.initiateConnector({
        companyId,
        toolkitSlug: entry.id,
        source: "onboarding_phase_2",
      }),
    onSuccess: (res) => {
      if (!res.redirectUrl) {
        setErr("No OAuth URL returned by Composio. Try again or skip for now.");
        return;
      }
      // Intentionally omit `noopener` — we need a Window reference to poll
      // popup.closed for the OAuth completion signal.
      const popup = window.open(
        res.redirectUrl,
        `composio-${entry.id}`,
        "width=600,height=700",
      );
      if (!popup) {
        setErr("Popup blocked. Allow popups for this site and try again.");
        return;
      }
      popupRef.current = popup;
      setPopupOpen(true);
      setErr(null);
      // Clear any prior "didn't connect" warning from a previous attempt.
      setAttemptCompleted(false);
    },
    onError: (e) => {
      // Composio session expired (key was valid at bootstrap, now revoked /
      // rotated). Bubble up so the parent banner offers an explicit
      // "Re-paste API key" recovery — surfacing only the raw "Invalid API
      // key" string from the inline error wouldn't tell the operator what to do.
      if (isComposioSessionExpired(e)) {
        onSessionExpired();
        setErr("Composio rejected the API key. Use the recovery banner above to paste a fresh one.");
        return;
      }
      setErr(e instanceof Error ? e.message : "Failed to initiate connection");
    },
  });

  // COMPOSIO-002 fix · primary signal: postMessage from the callback page.
  // The server's /api/connectors/callback now renders an HTML page that
  // posts {kind:"composio-callback", ok, toolkitSlug, ...} to its opener
  // before self-closing. This gives us a real success/failure signal
  // instead of guessing from `popup.closed` (which fires regardless of
  // whether OAuth actually completed).
  useEffect(() => {
    if (!popupOpen) return;
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as
        | { kind?: string; ok?: boolean; toolkitSlug?: string; reason?: string }
        | null
        | undefined;
      if (!data || data.kind !== "composio-callback") return;
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setPopupOpen(false);
      popupRef.current = null;
      // Only mark "attemptCompleted" (= surface the warning) when the
      // postMessage explicitly says it failed. On success the parent
      // refetches and the entry flips to `configured` — no warning.
      if (!data.ok) {
        setAttemptCompleted(true);
        if (data.reason) setErr(`OAuth: ${data.reason}`);
      }
      onConnected();
    };
    window.addEventListener("message", onMessage);

    // Fallback: if postMessage never arrives (older browsers, opener-blocked,
    // user navigates the popup elsewhere), the popup-closed poll still fires
    // and refetches. The `attemptCompleted` flag is only set if entry.status
    // is still pending after the refetch (handled by the effect below).
    pollIntervalRef.current = window.setInterval(() => {
      if (popupRef.current?.closed) {
        if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setPopupOpen(false);
        popupRef.current = null;
        setAttemptCompleted(true);
        onConnected();
      }
    }, 500);

    return () => {
      window.removeEventListener("message", onMessage);
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [popupOpen, onConnected]);

  // Once the parent's refetch lands and the entry IS configured, drop the
  // attempt-completed flag (no warning needed).
  useEffect(() => {
    if (entry.status === "configured" && attemptCompleted) {
      setAttemptCompleted(false);
    }
  }, [entry.status, attemptCompleted]);

  const isConfigured = entry.status === "configured";
  const isPending = !isConfigured && !declined;

  return (
    <div
      className={
        isConfigured
          ? "rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3"
          : declined
            ? "rounded-md border border-muted bg-muted/20 p-3 opacity-70"
            : "rounded-md border p-3"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{friendlyConnectorName(entry.id)}</span>
            {isConfigured && (
              <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                <Check className="size-3" /> Connected
              </span>
            )}
            {declined && !isConfigured && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Skipped
              </span>
            )}
            {entry.priority && (
              <span className="rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">
                {entry.priority}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{entry.rationale}</div>
          {entry.composio?.display_name && (
            <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
              Connected as <span className="font-mono">{entry.composio.display_name}</span>
            </div>
          )}
        </div>

        {isPending && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            {popupOpen ? (
              <>
                <Button size="sm" variant="outline" disabled>
                  <Loader2 className="mr-1 size-3 animate-spin" /> Waiting…
                </Button>
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => {
                    // Operator wants to abort the OAuth attempt. Stop polling +
                    // close the popup if we still have a handle to it.
                    if (pollIntervalRef.current) {
                      window.clearInterval(pollIntervalRef.current);
                      pollIntervalRef.current = null;
                    }
                    if (popupRef.current && !popupRef.current.closed) {
                      try {
                        popupRef.current.close();
                      } catch {
                        // cross-origin: leave it; user can close manually
                      }
                    }
                    popupRef.current = null;
                    setPopupOpen(false);
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  // Clear any prior popup-blocker / OAuth-init error before
                  // a fresh attempt so the operator doesn't see stale text.
                  setErr(null);
                  initiate.mutate();
                }}
                disabled={initiate.isPending || !composioReady}
                title={!composioReady ? "Paste a valid Composio API key in the bootstrap step first" : undefined}
              >
                {initiate.isPending ? (
                  <>
                    <Loader2 className="mr-1 size-3 animate-spin" /> Opening…
                  </>
                ) : !composioReady ? (
                  <>
                    <Plug className="mr-1 size-3" /> Connect
                  </>
                ) : (
                  <>
                    <Plug className="mr-1 size-3" /> Connect <ExternalLink className="ml-1 size-3" />
                  </>
                )}
              </Button>
            )}
            {!popupOpen && (
              <button
                type="button"
                className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                onClick={onDecline}
              >
                Skip for now
              </button>
            )}
          </div>
        )}
      </div>

      {err && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {/* Popup closed without a successful connection — give the operator a
          clear next step instead of leaving them to guess. */}
      {attemptCompleted && !isConfigured && !declined && !popupOpen && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Didn't see a connection land. The OAuth window may have been closed early or denied —
            click Connect to try again.
          </span>
        </div>
      )}
    </div>
  );
}
