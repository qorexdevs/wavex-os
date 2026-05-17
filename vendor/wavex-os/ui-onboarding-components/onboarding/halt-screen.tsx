import { ArrowRight, ShieldAlert } from "lucide-react";
import type { OnboardingHaltPayload } from "../../../api/wavexOsOnboarding";
import { Button } from "../../ui/button";

export function HaltScreen({
  halt,
  onRetry,
  onOverrideRequest,
  confirmBypass,
  onConfirmOverride,
  onCancelOverride,
}: {
  halt: OnboardingHaltPayload;
  onRetry: () => void;
  onOverrideRequest: () => void;
  confirmBypass: boolean;
  onConfirmOverride: () => void;
  onCancelOverride: () => void;
}) {
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
      <div className="mb-2 flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
        <ShieldAlert className="size-4" /> Step held
      </div>
      <div className="mb-3 text-foreground">{halt.operator_message}</div>
      {halt.engineer_detail && (
        <details className="mb-3 text-[10px] text-muted-foreground">
          <summary className="cursor-pointer">Technical detail</summary>
          <div className="mt-1 font-mono">{halt.engineer_detail}</div>
        </details>
      )}
      {!confirmBypass && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onRetry}>
            Retry <ArrowRight className="ml-1 size-3.5" />
          </Button>
          {halt.allow_override && (
            <Button variant="outline" onClick={onOverrideRequest}>
              Proceed without this check
            </Button>
          )}
        </div>
      )}
      {confirmBypass && halt.allow_override && (
        <div className="space-y-2 rounded border border-rose-500/40 bg-rose-500/5 p-3 text-xs">
          <div className="font-semibold text-rose-700 dark:text-rose-400">Are you sure?</div>
          <div className="text-muted-foreground">
            Proceeding without this check means the safeguards it enforces will not apply for this run. The override is logged.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancelOverride}>
              Cancel
            </Button>
            <Button onClick={onConfirmOverride}>I understand — proceed</Button>
          </div>
        </div>
      )}
    </div>
  );
}
