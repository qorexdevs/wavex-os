import { useMutation } from "@tanstack/react-query";
import { wavexOsOnboardingApi } from "../../../api/wavexOsOnboarding";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { KPIVerification, type KPIVerificationInputs } from "./KPIVerification";

export function KPIVerifyPhase({
  companyId,
  initialKpis,
  onDone,
}: {
  companyId: string;
  initialKpis: Record<string, unknown> | null;
  onDone: () => void;
}) {
  const submit = useMutation({
    mutationFn: (body: { values: Record<string, number>; verified_fields: string[] }) =>
      wavexOsOnboardingApi.verifyKpis({ companyId, ...body }),
    onSuccess: () => onDone(),
  });

  if (!initialKpis) {
    return (
      <Card className="space-y-4 p-6 text-sm">
        <div className="space-y-1">
          <h3 className="font-medium text-foreground">KPI snapshot not available</h3>
          <p className="text-muted-foreground">
            Pillar 3 didn't seed a KPI snapshot — likely a fresh / pre-revenue company. You can skip
            this step and provide KPIs later from the dashboard, or revisit Pillar 3 to add stage
            details.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => submit.mutate({ values: {}, verified_fields: [] })}
            disabled={submit.isPending}
          >
            {submit.isPending ? "Skipping…" : "Skip for now"}
          </Button>
        </div>
      </Card>
    );
  }

  const defaults: KPIVerificationInputs = {
    mrr: Number(initialKpis.mrr ?? 0),
    nrr: Number(initialKpis.nrr ?? 1),
    grr: Number(initialKpis.grr ?? 0.9),
    cac: Number(initialKpis.cac ?? 0),
    cac_payback_months: Number(initialKpis.cac_payback_months ?? 12),
    burn_multiple: Number(initialKpis.burn_multiple ?? 1.5),
    activation_rate: Number(initialKpis.activation_rate ?? 0.3),
    sales_cycle_days: Number(initialKpis.sales_cycle_days ?? 30),
    win_rate: Number(initialKpis.win_rate ?? 0.2),
    ltv_cac_ratio: Number(initialKpis.ltv_cac_ratio ?? 2),
    pipeline_velocity: Number(initialKpis.pipeline_velocity ?? 0),
    narrative_strength: Number(initialKpis.narrative_strength ?? 0.5),
  };

  return (
    <KPIVerification
      initial={defaults}
      onSubmit={(state) =>
        submit.mutate({
          values: state.values as unknown as Record<string, number>,
          verified_fields: Array.from(state.verified_fields),
        })
      }
      onSkip={() => submit.mutate({ values: {}, verified_fields: [] })}
    />
  );
}
