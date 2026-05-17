/**
 * Credential Concierge step · Phase 5 UI of credential-concierge integration.
 *
 * Two modes (the same component, different `mode` prop):
 *  - "bootstrap": gathers the Composio API key BEFORE the connector_pick step.
 *    Without this, the operator can't OAuth Slack/Gmail/etc. via Composio.
 *  - "direct": gathers non-Composio direct credentials AFTER the connector_pick step
 *    (github_pat, supabase_service_role_key, supabase_project_url, etc.).
 *
 * Skip flow: operator can skip any credential — gets a warning surface explaining
 * what won't work. Continue button is enabled regardless. This avoids friction
 * for pre-product operators who don't yet have all their accounts set up.
 *
 * Unknown flow: operator clicks "I don't see this credential" → opens a dialog
 * where they paste a credential with a free-text label + purpose. The vault
 * stores it under `custom:{slug}` for later registry promotion via coo.credentials.
 */

import { useMemo, useState } from "react";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  wavexOsOnboardingApi,
  type ConciergeSlotState,
} from "../../../api/wavexOsOnboarding";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Input } from "../../ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { ErrorLine, H2, P } from "./primitives";

/**
 * Mirror of server `CREDENTIAL_REGISTRY` — duplicated client-side so the UI
 * doesn't need a round-trip per render to fetch definitions. Synced manually
 * with `server/src/services/credential-registry.ts`. If you change one, change
 * the other (or do a server-render path in v2 to eliminate the copy).
 */
const CREDENTIAL_DISPLAY: Record<
  string,
  {
    displayName: string;
    providerName: string;
    whyNeeded: string;
    signupUrl: string;
    steps: string[];
    estimatedTimeMinutes: number;
    formatDescription: string;
    formatPattern: string | null;
  }
> = {
  composio_api_key: {
    displayName: "Composio API Key",
    providerName: "Composio",
    whyNeeded:
      "Composio handles login flows for Gmail, Slack, GitHub, and 850+ other apps so you don't have to set each one up manually.",
    signupUrl: "https://app.composio.dev/signup",
    steps: [
      "Sign up at https://app.composio.dev",
      "Click Settings → API Keys",
      'Click "Create New API Key", give it a name like "Operator Omega"',
      "Copy the key (you won't see it again)",
    ],
    estimatedTimeMinutes: 3,
    formatDescription: 'Starts with "ak_" or "comp_"',
    formatPattern: "^(ak_|comp_)[A-Za-z0-9_-]{8,}$",
  },
  github_pat: {
    displayName: "GitHub Personal Access Token",
    providerName: "GitHub",
    whyNeeded:
      "Lets the Swarm see when you ship code so cpo.build can join releases to user activation patterns.",
    signupUrl: "https://github.com/settings/tokens?type=beta",
    steps: [
      "Go to https://github.com/settings/tokens?type=beta",
      'Click "Generate new token" with name "Operator Omega" and 90-day expiration',
      "Repository access: pick the repos you want tracked",
      "Permissions: minimum is `metadata: read` and `contents: read`",
      "Generate + copy",
    ],
    estimatedTimeMinutes: 5,
    formatDescription: 'Starts with "ghp_", "github_pat_", or "ghs_"',
    formatPattern: "^(ghp_|github_pat_|ghs_)[A-Za-z0-9_]{20,}$",
  },
  supabase_project_url: {
    displayName: "Supabase Project URL",
    providerName: "Supabase",
    whyNeeded: "Tells the Swarm where your event data lives.",
    signupUrl: "https://supabase.com/dashboard",
    steps: [
      "Open your Supabase project's Settings → API",
      'Copy the "Project URL" (looks like https://xyz.supabase.co)',
    ],
    estimatedTimeMinutes: 2,
    formatDescription: "https://<project-id>.supabase.co",
    formatPattern: "^https://[a-z0-9]+\\.supabase\\.co/?$",
  },
  supabase_service_role_key: {
    displayName: "Supabase Service Role Key",
    providerName: "Supabase",
    whyNeeded:
      "Lets the Data agents read every event in your project. High-trust — your Swarm runs in dry-run mode for 14 days so nothing writes back without your approval.",
    signupUrl: "https://supabase.com/dashboard",
    steps: [
      "Open your Supabase project's Settings → API",
      'Find "Project API keys" → copy "service_role" (NOT anon)',
    ],
    estimatedTimeMinutes: 1,
    formatDescription: "JWT format starting with 'eyJ'",
    formatPattern: "^eyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$",
  },
  supabase_anon_key: {
    displayName: "Supabase Anon Key",
    providerName: "Supabase",
    whyNeeded: "Optional read-only key for less-privileged Supabase reads. Recommended alongside the service-role key.",
    signupUrl: "https://supabase.com/dashboard",
    steps: ["Open Settings → API → copy the 'anon' key"],
    estimatedTimeMinutes: 1,
    formatDescription: "JWT format starting with 'eyJ'",
    formatPattern: "^eyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$",
  },
  mixpanel_project_token: {
    displayName: "Mixpanel Project Token",
    providerName: "Mixpanel",
    whyNeeded: "Alternate source for product activity events — improves anomaly detection in cdo.signal.",
    signupUrl: "https://mixpanel.com/register",
    steps: [
      "In Mixpanel, click your project name → Settings → Project Settings",
      "Click the API tab and copy the Project Token (NOT the API secret)",
    ],
    estimatedTimeMinutes: 3,
    formatDescription: "32 lowercase hex characters",
    formatPattern: "^[a-f0-9]{32}$",
  },
};

export function CredentialConciergeStep({
  companyId,
  mode,
  onComplete,
}: {
  companyId: string;
  /** "bootstrap" = Composio API key only. "direct" = all non-Composio direct credentials. */
  mode: "bootstrap" | "direct";
  onComplete: () => void;
}) {
  const qc = useQueryClient();
  const [unknownDialogOpen, setUnknownDialogOpen] = useState(false);

  const state = useQuery({
    queryKey: ["wavex-os", "credentials", companyId],
    queryFn: () => wavexOsOnboardingApi.credentialsState(companyId),
    enabled: Boolean(companyId),
  });

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["wavex-os", "credentials", companyId] });
  };

  const slots = useMemo(() => {
    if (!state.data) return [];
    if (mode === "bootstrap") {
      return state.data.required.includes("composio_api_key")
        ? [{ key: "composio_api_key", slotState: state.data.bootstrap.composio_api_key }]
        : [];
    }
    // direct mode — non-composio_api_key credentials
    return state.data.required
      .filter((k) => k !== "composio_api_key")
      .map((k) => ({ key: k, slotState: state.data.direct[k] ?? "pending" }));
  }, [state.data, mode]);

  const allDoneOrSkipped = slots.every((s) => s.slotState === "valid" || s.slotState === "skipped");
  // Block Continue while any CredentialCard's paste mutation is mid-flight, so a
  // double-click doesn't drop a freshly-pasted credential's validation result.
  const pendingPastes = useIsMutating({ mutationKey: ["credentials-paste", companyId] });
  const continueDisabled = pendingPastes > 0;

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {mode === "bootstrap" ? <Sparkles className="size-3.5" /> : <KeyRound className="size-3.5" />}
          {mode === "bootstrap" ? "Wiring your tools · 1 of 3" : "Wiring your tools · 3 of 3"}
        </div>
        <H2>
          {mode === "bootstrap"
            ? "First — connect Composio"
            : "Now — direct credentials your Swarm needs"}
        </H2>
        <P>
          {mode === "bootstrap"
            ? "Composio handles 850+ app logins for you. We need one key from them to enable everything else."
            : "Some tools your Swarm uses need their own credentials (these aren't OAuth-based). Paste each, or skip and provide later."}
        </P>
      </header>

      <section className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs">
        <div className="mb-1 flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
          <Lock className="size-3.5" /> Encrypted at rest
        </div>
        <div className="text-foreground">
          Every credential you paste is encrypted server-side before it touches the database. Operator Ω
          never logs them; we only ever decrypt them on-demand for the agent that needs them.
        </div>
      </section>

      {state.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading recommendations…
        </div>
      )}
      {state.isError && (
        <ErrorLine>
          {state.error instanceof Error ? state.error.message : "Failed to load credential state"}
        </ErrorLine>
      )}

      {slots.length === 0 && state.data && (
        <Card className="p-3 text-sm text-muted-foreground">
          Nothing to configure here for your profile — click Continue to advance.
        </Card>
      )}

      <div className="space-y-2">
        {slots.map((s) => (
          <CredentialCard
            key={s.key}
            companyId={companyId}
            credentialKey={s.key}
            slotState={s.slotState}
            onChanged={refetch}
          />
        ))}
      </div>

      {mode === "direct" && (
        <button
          type="button"
          className="text-xs text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
          onClick={() => setUnknownDialogOpen(true)}
        >
          I don't see this credential type
        </button>
      )}

      <UnknownCredentialDialog
        open={unknownDialogOpen}
        onOpenChange={setUnknownDialogOpen}
        companyId={companyId}
        onAdded={refetch}
      />

      <footer className="space-y-2 border-t pt-3">
        <div className="text-xs text-muted-foreground">
          {continueDisabled
            ? "Validating credential…"
            : allDoneOrSkipped
              ? "Ready to continue."
              : "You can skip any credential and provide it later from your dashboard."}
        </div>
        <div className="flex justify-end">
          <Button onClick={onComplete} disabled={continueDisabled}>
            Continue <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>
      </footer>
    </Card>
  );
}

function CredentialCard({
  companyId,
  credentialKey,
  slotState,
  onChanged,
}: {
  companyId: string;
  credentialKey: string;
  slotState: ConciergeSlotState;
  onChanged: () => void;
}) {
  const display = CREDENTIAL_DISPLAY[credentialKey];
  const [draft, setDraft] = useState("");
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [result, setResult] = useState<{ status: string; recoveryHint?: string; error?: string } | null>(null);
  // Operator clicked "Paste it now" on a previously-skipped card. Re-opens the
  // paste UI; paste itself clears the persisted skip flag (concierge handles).
  const [unskipping, setUnskipping] = useState(false);

  const paste = useMutation({
    // Stable key so CredentialConciergeStep's parent footer can detect any in-flight
    // paste via useIsMutating and disable Continue accordingly.
    mutationKey: ["credentials-paste", companyId],
    mutationFn: () =>
      wavexOsOnboardingApi.credentialsPaste({ companyId, credentialKey, plaintext: draft }),
    onSuccess: (res) => {
      setResult(res);
      if (res.status === "valid") {
        setDraft("");
      }
      onChanged();
    },
    onError: (e) => {
      setResult({ status: "error", error: e instanceof Error ? e.message : "Failed" });
    },
  });

  const skip = useMutation({
    mutationFn: () =>
      wavexOsOnboardingApi.credentialsSkip({
        companyId,
        credentialKey,
        reason: "operator_skipped",
      }),
    onSuccess: () => onChanged(),
  });

  const formatOk = useMemo(() => {
    if (!display?.formatPattern) return draft.length > 0;
    return new RegExp(display.formatPattern).test(draft);
  }, [draft, display]);

  if (!display) {
    return (
      <Card className="p-3 text-sm">
        <code className="font-mono text-xs">{credentialKey}</code> — registry definition missing
      </Card>
    );
  }

  const isConfigured = slotState === "valid";
  const isSkippedRaw = slotState === "skipped";
  const isSkipped = isSkippedRaw && !unskipping;

  return (
    <div
      className={
        isConfigured
          ? "rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3"
          : isSkipped
            ? "rounded-md border border-muted bg-muted/20 p-3 opacity-70"
            : "rounded-md border p-3"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{display.displayName}</span>
            {isConfigured && (
              <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                <Check className="size-3" /> Validated
              </span>
            )}
            {isSkipped && (
              <>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Skipped</span>
                <button
                  type="button"
                  className="text-[10px] text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                  onClick={() => setUnskipping(true)}
                >
                  Paste it now
                </button>
              </>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{display.whyNeeded}</div>

          {!isConfigured && !isSkipped && (
            <>
              <button
                type="button"
                className="mt-2 text-xs text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                onClick={() => setStepsExpanded((v) => !v)}
              >
                {stepsExpanded ? "Hide steps" : "How do I get this?"} ·{" "}
                {display.estimatedTimeMinutes} min
              </button>
              {stepsExpanded && (
                <div className="mt-2 rounded border bg-muted/20 p-2 text-xs">
                  <div className="mb-1 flex items-center gap-1">
                    <a
                      href={display.signupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                    >
                      Open {display.providerName} <ExternalLink className="ml-0.5 inline size-3" />
                    </a>
                  </div>
                  <ol className="ml-4 list-decimal space-y-0.5">
                    {display.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="mt-3 space-y-1">
                <Input
                  type="password"
                  placeholder={display.formatDescription}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setResult(null);
                  }}
                  className={
                    draft.length > 0 && !formatOk
                      ? "border-amber-500/60"
                      : undefined
                  }
                />
                {draft.length > 0 && !formatOk && (
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">
                    Format check: expected {display.formatDescription}
                  </div>
                )}
                {result && result.status === "valid" && (
                  <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="size-3.5" /> Validated
                  </div>
                )}
                {result && result.status !== "valid" && result.status !== "error" && (
                  <div className="flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                    <span>{result.recoveryHint ?? result.error ?? `Status: ${result.status}`}</span>
                  </div>
                )}
                {result && result.status === "error" && (
                  <ErrorLine>{result.error ?? "Submit failed"}</ErrorLine>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => paste.mutate()}
                    disabled={!formatOk || paste.isPending}
                  >
                    {paste.isPending ? (
                      <>
                        <Loader2 className="mr-1 size-3 animate-spin" /> Validating…
                      </>
                    ) : (
                      <>Paste &amp; Validate</>
                    )}
                  </Button>
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => skip.mutate()}
                    disabled={skip.isPending}
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function UnknownCredentialDialog({
  open,
  onOpenChange,
  companyId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
  onAdded: () => void;
}) {
  const [label, setLabel] = useState("");
  const [purpose, setPurpose] = useState("");
  const [plaintext, setPlaintext] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      wavexOsOnboardingApi.credentialsUnknown({
        companyId,
        label,
        purpose,
        plaintext,
      }),
    onSuccess: () => {
      setLabel("");
      setPurpose("");
      setPlaintext("");
      setErr(null);
      onAdded();
      onOpenChange(false);
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "Failed"),
  });

  const valid = label.trim().length >= 2 && purpose.trim().length >= 5 && plaintext.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tell us about this credential</DialogTitle>
          <DialogDescription>
            We'll store it securely but can't validate it for you. Your COO agent will check in on
            rotation later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-[11px] uppercase text-muted-foreground">Label</label>
            <Input
              placeholder="Internal Stripe webhook secret"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase text-muted-foreground">What does it do?</label>
            <Input
              placeholder="Verifies webhook signatures from our internal billing system"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
            <div className="text-[10px] text-muted-foreground">
              At least 5 characters — helps your COO agent flag this for registry promotion later.
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase text-muted-foreground">Credential value</label>
            <Input
              type="password"
              placeholder="Paste the credential here"
              value={plaintext}
              onChange={(e) => setPlaintext(e.target.value)}
            />
          </div>
          {err && <ErrorLine>{err}</ErrorLine>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => submit.mutate()} disabled={!valid || submit.isPending}>
            {submit.isPending ? (
              <>
                <Loader2 className="mr-1 size-3 animate-spin" /> Saving…
              </>
            ) : (
              <>Save securely</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
