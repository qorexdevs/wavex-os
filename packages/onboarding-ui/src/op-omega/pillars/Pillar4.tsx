/** Pillar 4 — GTM Motion. */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { opOmegaOnboardingApi } from "../lib/api";
import type { GtmProfile, Pillar4Response } from "@op-omega/plugin-onboarding";
import { Card, ChipMultiSelect, Field, H2, NavRow, P, RadioGroup } from "../components/primitives";

const GTM: Array<{ value: GtmProfile; label: string; description: string }> = [
  { value: "outbound_b2b", label: "Outbound B2B", description: "Cold email + SDR pipeline; ACV >$5k" },
  { value: "inbound_content", label: "Inbound content", description: "SEO + content; long sales cycles" },
  { value: "paid_acquisition", label: "Paid acquisition", description: "Meta / Google / programmatic" },
  { value: "creator_led", label: "Creator-led", description: "Influencer / creator partnerships" },
  { value: "community_led", label: "Community-led", description: "Discord / Slack / forums drive growth" },
  { value: "freemium_self_serve", label: "Freemium self-serve", description: "Free → paid, no humans" },
  { value: "marketplace", label: "Marketplace", description: "Two-sided supply + demand" },
  { value: "enterprise_sales", label: "Enterprise sales", description: "Top-down, multi-month" },
  { value: "custom", label: "Custom / other", description: "None of the above" },
];

const LEAD_SOURCES = ["organic_search", "paid_search", "social_paid", "social_organic", "outbound", "referral", "partnerships", "content", "events", "direct"];

interface Props {
  companyId: string;
  initial: Pillar4Response | undefined;
  onComplete: () => void;
}

export function Pillar4({ companyId, initial, onComplete }: Props) {
  const [gtm, setGtm] = useState<GtmProfile>(initial?.gtm_profile_enum ?? "inbound_content");
  const [salesMotion, setSalesMotion] = useState(initial?.sales_motion ?? "");
  const [other, setOther] = useState(initial?.gtm_profile_other ?? "");
  const [sources, setSources] = useState<string[]>(initial?.lead_sources ?? []);

  const submit = useMutation({
    mutationFn: () => opOmegaOnboardingApi.pillar4({
      companyId,
      lead_sources: sources,
      sales_motion: salesMotion.trim() || undefined,
      gtm_profile_enum: gtm,
      gtm_profile_other: gtm === "custom" ? other.trim() || undefined : undefined,
    }),
    onSuccess: onComplete,
  });

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Pillar 4 — GTM Motion</H2>
      <P>How customers find you. Drives connector selection (Composio vs direct keys) and which C-suite roles get spawned.</P>

      <Card>
        <Field label="Primary GTM profile">
          <RadioGroup value={gtm} onChange={setGtm} options={GTM} />
        </Field>
        {gtm === "custom" && (
          <Field label="Describe your motion">
            <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="e.g. Conference-led, education partnerships" />
          </Field>
        )}
      </Card>

      <Card>
        <Field label="Lead sources" hint="(pick all that apply)">
          <ChipMultiSelect values={sources} onChange={setSources} options={LEAD_SOURCES.map((v) => ({ value: v, label: v.replace(/_/g, " ") }))} />
        </Field>
        <Field label="Sales motion (optional)">
          <input value={salesMotion} onChange={(e) => setSalesMotion(e.target.value)} placeholder="e.g. PLG with assisted onboarding for enterprise" />
        </Field>
      </Card>

      <NavRow next={{ onClick: () => submit.mutate(), label: submit.isPending ? "Saving..." : "Continue →" }} nextDisabled={submit.isPending} />
      {submit.isError && <div style={{ color: "var(--warning)", fontSize: 13, marginTop: "0.5rem" }}>{(submit.error as Error).message}</div>}
    </div>
  );
}
