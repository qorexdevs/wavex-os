/**
 * Operator Ω · Connector Onboarding
 *
 * Chat-styled multi-phase dialog. Branches on `authMethod`:
 *  - paste → existing step-by-step paste flow
 *  - oauth → one-time app-cred setup (client_id/client_secret) → popup OAuth
 *  - supabase also has a follow-up project picker after OAuth
 */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Link, Check, ShieldAlert, ArrowRight, Key, Cable, Copy, CheckCircle2 } from "lucide-react";
import {
  opOmegaApi,
  beginOAuthPopup,
  type ConnectorSpec,
  type SupabaseProject,
} from "../../api/opOmega";
import { cn } from "@/lib/utils";

type Phase =
  | { kind: "pick" }
  | { kind: "paste-fill"; spec: ConnectorSpec; step: number; values: Record<string, string> }
  | { kind: "oauth-setup"; spec: ConnectorSpec; redirectUri: string }
  | { kind: "oauth-authorize"; spec: ConnectorSpec }
  | { kind: "supabase-pick"; spec: ConnectorSpec; projects: SupabaseProject[] }
  | { kind: "done"; spec: ConnectorSpec; summary: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

function OmegaMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-xs font-semibold text-purple-700 dark:text-purple-300">Ω</span>
      <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function OperatorSlot({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-end gap-2.5">
      <div className="max-w-[80%] rounded-lg bg-primary/10 px-3 py-2 text-sm">{children}</div>
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold">You</span>
    </div>
  );
}

export function ConnectorOnboardingDialog({ open, onOpenChange, companyId }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [draftValue, setDraftValue] = useState("");
  const [appClientId, setAppClientId] = useState("");
  const [appClientSecret, setAppClientSecret] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const qc = useQueryClient();

  const connectorsQ = useQuery({
    queryKey: ["op-omega", "connectors", companyId],
    queryFn: () => opOmegaApi.listConnectors(companyId),
    enabled: open && !!companyId,
  });
  const oauthAppsQ = useQuery({
    queryKey: ["op-omega", "oauth-apps", companyId],
    queryFn: () => opOmegaApi.listOAuthApps(companyId),
    enabled: open && !!companyId,
  });

  const pasteMut = useMutation({
    mutationFn: (args: { id: string; secrets: Record<string, string> }) =>
      opOmegaApi.onboardConnector(args.id, { companyId, secrets: args.secrets }),
    onSuccess: async (result) => {
      qc.invalidateQueries({ queryKey: ["agents", companyId] });
      qc.invalidateQueries({ queryKey: ["secrets", companyId] });
      setDraftValue("");
      setErrorMsg(null);

      qc.invalidateQueries({ queryKey: ["op-omega", "connectors", companyId] });

      if (result.followup === "supabase-pick-project") {
        try {
          const projects = await opOmegaApi.supabaseListProjects(companyId);
          setPhase((prev) =>
            prev.kind === "paste-fill" ? { kind: "supabase-pick", spec: prev.spec, projects } : prev,
          );
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : "Failed to list Supabase projects");
        }
        return;
      }

      setPhase((prev) =>
        prev.kind === "paste-fill"
          ? {
              kind: "done",
              spec: prev.spec,
              summary: `Stored ${Object.keys(result.secretsCreated).length} secret${Object.keys(result.secretsCreated).length === 1 ? "" : "s"} · bound to ${Array.from(
                new Set(result.agentsPatched.map((p) => p.agentName)),
              ).join(", ") || "no agents"}.`,
            }
          : prev,
      );
    },
    onError: (err) => setErrorMsg(err instanceof Error ? err.message : "Onboarding failed"),
  });

  const saveAppMut = useMutation({
    mutationFn: (args: { provider: "github" | "slack" | "supabase"; clientId: string; clientSecret: string }) =>
      opOmegaApi.saveOAuthApp(args.provider, {
        companyId,
        clientId: args.clientId,
        clientSecret: args.clientSecret,
      }),
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: ["op-omega", "oauth-apps", companyId] });
      setAppClientId("");
      setAppClientSecret("");
      setErrorMsg(null);
      setPhase((prev) => (prev.kind === "oauth-setup" ? { kind: "oauth-authorize", spec: prev.spec } : prev));
    },
    onError: (err) => setErrorMsg(err instanceof Error ? err.message : "Failed to save app credentials"),
  });

  const resetAppMut = useMutation({
    mutationFn: (provider: "github" | "slack" | "supabase") =>
      opOmegaApi.resetOAuthApp(provider, companyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["op-omega", "oauth-apps", companyId] });
    },
  });

  const supabasePickMut = useMutation({
    mutationFn: (args: { projectRef: string }) =>
      opOmegaApi.supabaseSelectProject({ companyId, projectRef: args.projectRef }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["agents", companyId] });
      qc.invalidateQueries({ queryKey: ["secrets", companyId] });
      setPhase((prev) =>
        prev.kind === "supabase-pick"
          ? {
              kind: "done",
              spec: prev.spec,
              summary: `Project ${result.projectRef} connected. Service-role key fetched via Management API and bound to ${Array.from(new Set(result.agentsPatched.map((p) => p.agentName))).join(", ")}.`,
            }
          : prev,
      );
    },
    onError: (err) => setErrorMsg(err instanceof Error ? err.message : "Failed to select project"),
  });

  function reset() {
    setPhase({ kind: "pick" });
    setDraftValue("");
    setAppClientId("");
    setAppClientSecret("");
    setErrorMsg(null);
    pasteMut.reset();
    saveAppMut.reset();
    supabasePickMut.reset();
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function selectConnector(spec: ConnectorSpec) {
    setErrorMsg(null);
    if (spec.authMethod === "paste") {
      setPhase({ kind: "paste-fill", spec, step: 0, values: {} });
      setDraftValue("");
      return;
    }
    // oauth path
    const appStatus = oauthAppsQ.data?.find((a) => a.provider === spec.oauthProvider);
    if (!appStatus || !appStatus.configured) {
      setPhase({ kind: "oauth-setup", spec, redirectUri: appStatus?.redirectUri ?? "" });
    } else {
      setPhase({ kind: "oauth-authorize", spec });
    }
  }

  async function startOAuth(spec: ConnectorSpec) {
    if (!spec.oauthProvider) return;
    setErrorMsg(null);
    try {
      const result = await beginOAuthPopup(spec.oauthProvider, companyId);
      qc.invalidateQueries({ queryKey: ["agents", companyId] });
      qc.invalidateQueries({ queryKey: ["secrets", companyId] });
      if (result.followup === "supabase-pick-project") {
        const projects = await opOmegaApi.supabaseListProjects(companyId);
        setPhase({ kind: "supabase-pick", spec, projects });
      } else {
        const keys = Object.keys(result.bindings ?? {});
        setPhase({
          kind: "done",
          spec,
          summary: `Stored ${keys.length} secret${keys.length === 1 ? "" : "s"}: ${keys.join(", ")} · bound to ${Array.from(new Set(spec.agentBindings.map((b) => b.agentName))).join(", ")}.`,
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "OAuth failed");
    }
  }

  function advancePaste() {
    if (phase.kind !== "paste-fill") return;
    const field = phase.spec.secretFields[phase.step];
    if (!field) return;
    const value = draftValue.trim();
    if (!value && field.required) {
      setErrorMsg("This field is required.");
      return;
    }
    if (value && !new RegExp(field.validationPattern).test(value)) {
      setErrorMsg(`Value doesn't match the expected format: ${field.validationPattern}`);
      return;
    }
    setErrorMsg(null);
    const nextValues = { ...phase.values, [field.key]: value };
    const nextStep = phase.step + 1;
    if (nextStep >= phase.spec.secretFields.length) {
      pasteMut.mutate({ id: phase.spec.id, secrets: nextValues });
    } else {
      setPhase({ ...phase, step: nextStep, values: nextValues });
      setDraftValue("");
    }
  }

  const title = useMemo(() => {
    if (phase.kind === "pick") return "Connect a system";
    if (phase.kind === "done") return `Connected · ${phase.spec.displayName}`;
    return `Connect · ${phase.kind === "paste-fill" || phase.kind === "oauth-setup" || phase.kind === "oauth-authorize" || phase.kind === "supabase-pick" ? phase.spec.displayName : ""}`;
  }, [phase]);

  const connectors = connectorsQ.data ?? [];
  const oauthApps = oauthAppsQ.data ?? [];

  function copyRedirect(uri: string) {
    navigator.clipboard.writeText(uri).then(() => {
      setCopiedRedirect(true);
      setTimeout(() => setCopiedRedirect(false), 1500);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Operator-supplied. Values land in Paperclip's secret store and bind to chief agents as
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-[11px]">secret_ref</code>
            — never exposed after this dialog closes.
          </DialogDescription>
        </DialogHeader>

        {phase.kind === "pick" && (
          <div className="space-y-3">
            <OmegaMessage>
              Which system do you want to plug in? OAuth flows don't need you to paste anything sensitive.
            </OmegaMessage>
            <div className="grid gap-2">
              {connectorsQ.isLoading && <div className="text-sm text-muted-foreground">Loading specs…</div>}
              {connectors.map((spec) => {
                const app = oauthApps.find((a) => a.provider === spec.oauthProvider);
                const isOAuth = spec.authMethod === "oauth";
                const oauthReady = !isOAuth || !!app?.configured;
                const connected = spec.status === "connected";
                const partial = spec.status === "partial";
                return (
                  <button
                    key={spec.id}
                    type="button"
                    onClick={() => selectConnector(spec)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition hover:bg-accent",
                      connected ? "bg-emerald-500/5 border-emerald-500/30" : "bg-card",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="size-3 rounded-full" style={{ background: spec.color }} aria-hidden />
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-semibold">
                          {spec.displayName}
                          {isOAuth ? (
                            <Cable className="size-3 text-muted-foreground" aria-label="OAuth" />
                          ) : (
                            <Key className="size-3 text-muted-foreground" aria-label="Paste" />
                          )}
                          {connected && (
                            <span className="flex items-center gap-0.5 rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="size-2.5" /> Connected
                            </span>
                          )}
                          {partial && (
                            <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">Partial</span>
                          )}
                          {isOAuth && oauthReady && !connected && !partial && <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">OAuth ready</span>}
                          {isOAuth && !oauthReady && <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">OAuth setup needed</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {spec.category} · feeds <code>{spec.feedsBundle}</code>
                          {connected && " · click to rotate secret"}
                          {partial && " · click to finish setup"}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {phase.kind === "paste-fill" && phase.spec.secretFields[phase.step] && (
          <div className="space-y-3">
            <OmegaMessage>{phase.spec.chatIntro}</OmegaMessage>
            {phase.spec.secretFields.slice(0, phase.step).map((f) => (
              <OperatorSlot key={f.key}>
                <span className="font-medium">{f.label}:</span>{" "}
                <code className="ml-1 rounded bg-background/60 px-1 py-0.5 text-[11px]">•••••• stored</code>
              </OperatorSlot>
            ))}
            <OmegaMessage>
              <div className="mb-1 font-medium">{phase.spec.secretFields[phase.step].label}</div>
              <div className="text-xs text-muted-foreground">{phase.spec.secretFields[phase.step].whereToFind}</div>
            </OmegaMessage>
            <div className="flex flex-col gap-2 pl-8">
              <Input
                type="password"
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && advancePaste()}
                placeholder={`Paste ${phase.spec.secretFields[phase.step].label.toLowerCase()}`}
                className={cn("font-mono text-xs", errorMsg && "border-red-500/50")}
                autoFocus
                disabled={pasteMut.isPending}
              />
              {errorMsg && (
                <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Step {phase.step + 1} of {phase.spec.secretFields.length}</span>
                <Button type="button" size="sm" onClick={advancePaste} disabled={pasteMut.isPending}>
                  {phase.step + 1 === phase.spec.secretFields.length ? (pasteMut.isPending ? "Saving…" : "Save & bind") : "Next"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {phase.kind === "oauth-setup" && (
          <div className="space-y-3">
            <OmegaMessage>
              First, register an OAuth app in {phase.spec.displayName}. Copy the redirect URI below and paste it into the app config <strong>exactly</strong> (don't retype — exact match is required, or the callback fails). Then paste the app's <code>client_id</code> and <code>client_secret</code> here.
            </OmegaMessage>
            <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              <div className="font-semibold text-amber-700 dark:text-amber-300">Redirect URI — paste into the {phase.spec.displayName} app's callback-URL field:</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-muted px-2 py-1 font-mono text-[11px]">{phase.redirectUri}</code>
                <Button size="sm" variant="outline" onClick={() => copyRedirect(phase.redirectUri)}>
                  {copiedRedirect ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
              <div className="pt-1 text-[11px] text-muted-foreground">
                Register an app at:{" "}
                {phase.spec.oauthProvider === "github" && (
                  <a
                    href="https://github.com/settings/developers"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    github.com/settings/developers → New OAuth App
                  </a>
                )}
                {phase.spec.oauthProvider === "slack" && (
                  <a
                    href="https://api.slack.com/apps"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    api.slack.com/apps → Create New App → OAuth &amp; Permissions
                  </a>
                )}
                {phase.spec.oauthProvider === "supabase" && (
                  <a
                    href="https://supabase.com/dashboard/account/tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    supabase.com/dashboard → Account → OAuth Apps
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 pl-8">
              <Input
                placeholder="client_id"
                value={appClientId}
                onChange={(e) => setAppClientId(e.target.value)}
                className="font-mono text-xs"
                autoFocus
              />
              <Input
                type="password"
                placeholder="client_secret"
                value={appClientSecret}
                onChange={(e) => setAppClientSecret(e.target.value)}
                className="font-mono text-xs"
              />
              {errorMsg && (
                <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Scopes: <code>{(oauthApps.find((a) => a.provider === phase.spec.oauthProvider)?.scopes) ?? "…"}</code></span>
                <Button
                  size="sm"
                  onClick={() =>
                    phase.spec.oauthProvider &&
                    saveAppMut.mutate({
                      provider: phase.spec.oauthProvider,
                      clientId: appClientId.trim(),
                      clientSecret: appClientSecret.trim(),
                    })
                  }
                  disabled={saveAppMut.isPending || !appClientId || !appClientSecret}
                >
                  {saveAppMut.isPending ? "Saving…" : "Save & continue"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {phase.kind === "oauth-authorize" && (
          <div className="space-y-3">
            <OmegaMessage>
              App credentials are set for {phase.spec.displayName}. Click Authorize to open a popup at{" "}
              <code>{phase.spec.oauthProvider === "github" ? "github.com" : phase.spec.oauthProvider === "slack" ? "slack.com" : "api.supabase.com"}</code>.
              If you get a 404, the app's client_id is stale — use "Edit credentials" below to re-enter them.
            </OmegaMessage>
            {errorMsg && (
              <div className="flex items-start gap-1.5 pl-8 text-xs text-red-600 dark:text-red-400">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            <div className="flex items-center justify-between pl-8">
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                disabled={resetAppMut.isPending}
                onClick={async () => {
                  if (!phase.spec.oauthProvider) return;
                  await resetAppMut.mutateAsync(phase.spec.oauthProvider);
                  const app = (await opOmegaApi.listOAuthApps(companyId)).find((a) => a.provider === phase.spec.oauthProvider);
                  setPhase({ kind: "oauth-setup", spec: phase.spec, redirectUri: app?.redirectUri ?? "" });
                }}
              >
                Edit credentials
              </button>
              <Button size="sm" onClick={() => startOAuth(phase.spec)}>
                Authorize {phase.spec.displayName}
              </Button>
            </div>
          </div>
        )}

        {phase.kind === "supabase-pick" && (
          <div className="space-y-3">
            <OmegaMessage>
              OAuth is done — here are your Supabase projects. Pick the one that backs Operator Ω. I'll fetch its service-role key via the Management API and bind it to cfo, cdo, and coo.
            </OmegaMessage>
            <div className="grid gap-2 pl-8">
              {phase.projects.length === 0 && <div className="text-sm text-muted-foreground">No projects on this account.</div>}
              {phase.projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={supabasePickMut.isPending}
                  onClick={() => supabasePickMut.mutate({ projectRef: p.id })}
                  className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-left transition hover:bg-accent"
                >
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.id} · {p.region}
                      {p.status ? ` · ${p.status}` : ""}
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </button>
              ))}
              {errorMsg && (
                <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {phase.kind === "done" && (
          <div className="space-y-3">
            <OmegaMessage>
              <div className="mb-2 flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="size-4" /> {phase.spec.displayName} is connected.
              </div>
              <div className="text-xs text-muted-foreground">{phase.summary}</div>
            </OmegaMessage>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={reset}>
                Connect another
              </Button>
              <Button type="button" size="sm" onClick={() => handleClose(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
