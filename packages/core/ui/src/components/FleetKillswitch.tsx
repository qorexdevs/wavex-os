/** Fleet-wide pause/resume control rendered next to the budget incident
 *  banner on the Paperclip Dashboard. Reversible — pause toggles all
 *  active/running agents to `paused`, resume flips them back.
 *
 *  Confirmation modal uses the rose-bordered danger-zone pattern from the
 *  legacy halt-screen so the operator can't pause the fleet by accident. */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PauseCircle, PlayCircle, ShieldAlert } from "lucide-react";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";

interface Props {
  companyId: string;
  activeAgents: number;
  pausedAgents: number;
}

export function FleetKillswitch({ companyId, activeAgents, pausedAgents }: Props) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<"pause" | "resume" | null>(null);

  const pause = useMutation({
    mutationFn: () => agentsApi.pauseFleet(companyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dashboard(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
      setConfirming(null);
    },
  });
  const resume = useMutation({
    mutationFn: () => agentsApi.resumeFleet(companyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dashboard(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
      setConfirming(null);
    },
  });

  // Resume mode kicks in only when *every* enabled agent is paused — partial
  // pause leaves the killswitch in pause mode so the operator can finish the
  // job rather than accidentally resume in-flight work.
  const allPaused = pausedAgents > 0 && activeAgents === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(allPaused ? "resume" : "pause")}
        disabled={pause.isPending || resume.isPending}
        className={
          allPaused
            ? "inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-60"
            : "inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-500/15 disabled:opacity-60"
        }
      >
        {allPaused
          ? (<><PlayCircle className="h-3.5 w-3.5" /> Resume fleet</>)
          : (<><PauseCircle className="h-3.5 w-3.5" /> Pause fleet</>)
        }
      </button>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirming(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-rose-500/40 bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold">
                  {confirming === "pause" ? "Pause the fleet?" : "Resume the fleet?"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {confirming === "pause"
                    ? `${activeAgents} active agent${activeAgents === 1 ? "" : "s"} will pause. In-flight runs cancel.`
                    : `${pausedAgents} paused agent${pausedAgents === 1 ? "" : "s"} will resume. Heartbeats restart on schedule.`}
                </p>
                {confirming === "pause" && (
                  <div className="mt-3 rounded border border-rose-500/40 bg-rose-500/5 p-2.5 text-[11px] text-rose-100/90">
                    This is logged. Run the resume action to bring the fleet back.
                  </div>
                )}
                {(pause.isError || resume.isError) && (
                  <div className="mt-2 text-xs text-rose-300">
                    {(pause.error as Error | undefined)?.message ?? (resume.error as Error | undefined)?.message}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pause.isPending || resume.isPending}
                onClick={() => (confirming === "pause" ? pause.mutate() : resume.mutate())}
                className={
                  confirming === "pause"
                    ? "rounded-md bg-rose-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-60"
                    : "rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
                }
              >
                {pause.isPending || resume.isPending
                  ? "Working…"
                  : confirming === "pause" ? "Pause fleet" : "Resume fleet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
