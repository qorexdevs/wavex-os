import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ShieldAlert, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { wavexOsOnboardingApi } from "../../../api/wavexOsOnboarding";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { H2, P } from "./primitives";

export function Pillar2({
  companyId,
  onDone,
  initial,
}: {
  companyId: string;
  onDone: () => void;
  initial?: { claude_plan?: "max_20x" | "max_5x" | "api_only" | "other"; claude_plan_other_note?: string };
}) {
  const [plan, setPlan] = useState<"max_20x" | "max_5x" | "api_only" | "other">(initial?.claude_plan ?? "max_20x");
  const [note, setNote] = useState(initial?.claude_plan_other_note ?? "");
  const [fixHint, setFixHint] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: () =>
      wavexOsOnboardingApi.pillar2({
        companyId,
        claude_plan: plan,
        claude_plan_other_note: note || undefined,
      }),
    onSuccess: (res) => {
      if (res.ok) onDone();
      else setFixHint(res.fix_hint ?? "Claude Code verification failed.");
    },
  });
  return (
    <>
      <H2>Verifying your setup</H2>
      <P>
        Every downstream step uses Claude. We'll verify <code>claude</code> is installed and signed in
        to your plan before we go further.
      </P>
      <div className="flex flex-col gap-2">
        {(["max_20x", "max_5x", "api_only", "other"] as const).map((opt) => (
          <label
            key={opt}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm",
              plan === opt && "border-emerald-500 bg-emerald-500/5",
            )}
          >
            <input type="radio" checked={plan === opt} onChange={() => setPlan(opt)} />
            <span className="font-medium">
              {opt === "max_20x"
                ? "Claude Max 20×"
                : opt === "max_5x"
                  ? "Claude Max 5×"
                  : opt === "api_only"
                    ? "API only (pay-as-you-go)"
                    : "Other — specify"}
            </span>
          </label>
        ))}
      </div>
      {plan === "other" && (
        <Input placeholder="Describe your plan" value={note} onChange={(e) => setNote(e.target.value)} />
      )}
      {fixHint && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <div className="font-semibold">Setup needed</div>
            <div className="mt-1 whitespace-pre-wrap">{fixHint}</div>
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? "Verifying Claude Code…" : "Verify & Continue"}{" "}
          <Zap className="ml-1 size-3.5" />
        </Button>
      </div>
    </>
  );
}
