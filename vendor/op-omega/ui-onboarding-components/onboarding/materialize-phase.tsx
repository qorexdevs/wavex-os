import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Cable, CheckCircle2, ListChecks, Loader2, MessageSquare, Play, ShieldCheck } from "lucide-react";
import { opOmegaOnboardingApi, type OnboardingStatus, type Pillar1Response } from "../../../api/opOmegaOnboarding";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { ErrorLine, P } from "./primitives";
import { displayGtmProfile, type GtmProfileEnum } from "./gtm-profile";

export function MaterializePhase({
  companyId,
  status,
  onDone,
}: {
  companyId: string;
  status?: OnboardingStatus | null;
  onDone: (company: { id: string; name: string; issuePrefix: string } | null) => void;
}) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof opOmegaOnboardingApi.materialize>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: () => opOmegaOnboardingApi.materialize({ companyId }),
    onSuccess: (r) => {
      setResult(r);
      setErr(null);
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "Materialize failed"),
  });

  // Friction-fix #2/#5: poll for the first auto-fire after materialize so the
  // operator gets immediate feedback that the loop is closing. Polls every 3s
  // for up to 60s (the 30s scheduler tick + ~5-15s adapter run window).
  const [pollAttempts, setPollAttempts] = useState(0);
  const POLL_LIMIT = 20; // 20 × 3s = 60s
  const loopStatus = useQuery({
    queryKey: ["op-omega", "loop-status", companyId, result?.created.length ?? 0],
    queryFn: () => opOmegaOnboardingApi.loopStatus(companyId),
    enabled: !!result && pollAttempts < POLL_LIMIT,
    refetchInterval: (q) => {
      // Stop polling once a verified run lands.
      if (q.state.data?.loop_verified_at) return false;
      return 3000;
    },
  });
  useEffect(() => {
    if (result && !loopStatus.data?.loop_verified_at) {
      const t = setTimeout(() => setPollAttempts((n) => n + 1), 3000);
      return () => clearTimeout(t);
    }
  }, [result, loopStatus.data?.loop_verified_at, pollAttempts]);
  const loopVerifiedAt = loopStatus.data?.loop_verified_at ?? null;
  const recentRun = loopStatus.data?.most_recent_run ?? null;
  const activeCount = loopStatus.data?.active_agent_count ?? null;
  const polling = !!result && !loopVerifiedAt && pollAttempts < POLL_LIMIT;
  const pollExhausted = !!result && !loopVerifiedAt && pollAttempts >= POLL_LIMIT;

  const orgName = (status?.responses?.pillar_1 as Pillar1Response | null)?.org_name?.trim() || "Your";
  const gtmProfile = (status?.responses?.pillar_4 as { gtm_profile_enum?: GtmProfileEnum } | null)?.gtm_profile_enum;
  const commChannel = (status?.responses?.pillar_5 as { comm_channel?: string } | null)?.comm_channel;

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Play className="size-5 text-emerald-600" />
        <h2 className="text-lg font-semibold">Materialize the swarm</h2>
      </div>
      <P>
        Creates any active agents from the manifest that don't yet exist in Paperclip. dry_run stays on
        — nothing writes externally until you flip the 14-day window off.
      </P>
      {err && (
        <div className="space-y-2">
          <ErrorLine>{err}</ErrorLine>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setErr(null);
              run.mutate();
            }}
            disabled={run.isPending}
          >
            {run.isPending ? "Retrying…" : "Try again"}
          </Button>
        </div>
      )}
      {!result && !err && (
        <div className="flex justify-end">
          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? "Creating agents…" : "Materialize"} <Play className="ml-1 size-3.5" />
          </Button>
        </div>
      )}
      {result && (
        <>
          <CelebrationHeader
            orgName={orgName}
            createdCount={result.created.length}
            totalCount={result.created.length + result.updated.length + result.skipped.length}
          />

          {/* Loop-firing live indicator (friction-fix #2/#5) — shows the
              operator that the auto-timer is actually closing the loop. */}
          <LoopFireStatus
            polling={polling}
            verifiedAt={loopVerifiedAt}
            recentRun={recentRun}
            activeCount={activeCount}
            exhausted={pollExhausted}
          />

          <div className="grid grid-cols-3 gap-2 text-xs">
            <Card className="p-2 text-center">
              <div className="text-lg font-bold">{result.created.length}</div>
              <div className="text-muted-foreground">created</div>
            </Card>
            <Card className="p-2 text-center">
              <div className="text-lg font-bold">{result.updated.length}</div>
              <div className="text-muted-foreground">updated</div>
            </Card>
            <Card className="p-2 text-center">
              <div className="text-lg font-bold">{result.skipped.length}</div>
              <div className="text-muted-foreground">skipped</div>
            </Card>
          </div>

          {result.created.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[11px] font-semibold uppercase text-muted-foreground">
                Your {result.created.length} new agents
              </summary>
              <ul className="mt-1 grid grid-cols-2 gap-0.5 pl-4 text-xs">
                {result.created.map((a) => (
                  <li key={a.agentId}>
                    <code>{a.name}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <NextActions gtmProfile={gtmProfile} commChannel={commChannel} />

          <div className="flex justify-end">
            <Button onClick={() => onDone(result.company)}>
              Open dashboard <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function LoopFireStatus({
  polling,
  verifiedAt,
  recentRun,
  activeCount,
  exhausted,
}: {
  polling: boolean;
  verifiedAt: string | null;
  recentRun: { agent_name: string | null; invocation_source: string; finished_at: string } | null;
  activeCount: number | null;
  exhausted: boolean;
}) {
  if (!polling && !verifiedAt && !exhausted) return null;

  if (polling) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-xs">
        <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-sky-600 dark:text-sky-400" />
        <div>
          <div className="font-medium text-sky-700 dark:text-sky-300">
            Watching for first check-in…
          </div>
          <div className="text-muted-foreground">
            Your auto-timer fires every 30 seconds. The first agent should check in within a minute.
            {activeCount !== null && ` ${activeCount} agents waiting to run.`}
          </div>
        </div>
      </div>
    );
  }

  if (verifiedAt && recentRun) {
    const t = new Date(verifiedAt);
    const timeStr = t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
    const isAuto = recentRun.invocation_source === "timer";
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <div className="font-medium text-emerald-700 dark:text-emerald-300">
            Loop verified — first check-in {timeStr}
          </div>
          <div className="text-muted-foreground">
            {recentRun.agent_name ? <code>{recentRun.agent_name}</code> : "An agent"} fired{" "}
            {isAuto ? "via the auto-timer" : `on ${recentRun.invocation_source}`}.
          </div>
        </div>
      </div>
    );
  }

  if (exhausted) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
        <Loader2 className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <div className="font-medium text-amber-700 dark:text-amber-300">
            First check-in pending
          </div>
          <div className="text-muted-foreground">
            Agents materialized but no auto-fire observed in 60 seconds. The first run should appear
            in your dashboard shortly. If not, try a manual wakeup from the agents page.
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function CelebrationHeader({
  orgName,
  createdCount,
  totalCount,
}: {
  orgName: string;
  createdCount: number;
  totalCount: number;
}) {
  return (
    <section className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-base font-semibold">{orgName}'s team is live</h3>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {createdCount} agent{createdCount === 1 ? "" : "s"} created in this run · {totalCount} in your roster.{" "}
        Every external action is held for your review for the next 14 days.
      </div>
    </section>
  );
}

function NextActions({
  gtmProfile,
  commChannel,
}: {
  gtmProfile?: GtmProfileEnum;
  commChannel?: string;
}) {
  const profileDisplay = gtmProfile ? displayGtmProfile(gtmProfile) : null;
  const channelLabel = commChannelDisplay(commChannel);

  return (
    <section className="rounded-md border p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
        <ListChecks className="size-3.5" /> What to do next
      </div>
      <ol className="space-y-2">
        <li className="flex gap-2 text-sm">
          <Cable className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <div className="font-medium">Plug your first connector</div>
            <div className="text-xs text-muted-foreground">
              Open the Connectors tab from your dashboard. Supabase or Mixpanel wakes your data agents fastest.
            </div>
          </div>
        </li>
        <li className="flex gap-2 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-purple-600 dark:text-purple-400" />
          <div>
            <div className="font-medium">Open the Swarm view</div>
            <div className="text-xs text-muted-foreground">
              {profileDisplay
                ? `Your ${profileDisplay.name} team is online — ${profileDisplay.primary_agents}.`
                : "See which agents are active vs parked."}
            </div>
          </div>
        </li>
        <li className="flex gap-2 text-sm">
          <MessageSquare className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <div>
            <div className="font-medium">Watch for your first check-in</div>
            <div className="text-xs text-muted-foreground">
              {channelLabel
                ? `Your CEO agent reports via ${channelLabel}. First heartbeat lands within 15 minutes.`
                : "Your CEO agent posts its first status update within 15 minutes."}
            </div>
          </div>
        </li>
      </ol>
    </section>
  );
}

function commChannelDisplay(ch?: string): string | null {
  if (!ch) return null;
  if (ch === "telegram") return "Telegram";
  if (ch === "slack") return "Slack";
  if (ch === "sms") return "SMS";
  if (ch === "email_only") return "email";
  return null;
}
