/** Pillar 1 — Identity. Op-omega's enrichment with F1 fail-closed. */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import type { Pillar1Response } from "@op-omega/plugin-onboarding";
import { Card, Field, H2, NavRow, P } from "../components/primitives";
import { HaltScreen } from "../components/HaltScreen";

const INDUSTRIES = [
  "AI / ML / SaaS", "Concierge / Hospitality", "E-commerce / Retail",
  "Real Estate", "Healthcare / Wellness", "Finance / Crypto",
  "Travel / Tourism", "Education / EdTech", "Media / Content", "Other",
];

interface Props {
  companyId: string;
  initial: Pillar1Response | undefined;
  onComplete: () => void;
}

export function Pillar1({ companyId, initial, onComplete }: Props) {
  const [companyName, setCompanyName] = useState(initial?.companyName ?? "");
  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [companyContext, setContext] = useState(initial?.companyContext ?? "");
  const [businessModel, setBusinessModel] = useState(initial?.businessModel ?? "");
  const [icp, setIcp] = useState(initial?.icp ?? "");
  const [positioning, setPositioning] = useState(initial?.positioning ?? "");
  const [tone, setTone] = useState(initial?.tone ?? "");

  const submit = useMutation({
    mutationFn: (input: { enrichWithAI: boolean }) =>
      opOmegaOnboardingApi.pillar1({
        companyId,
        companyName, industry,
        companyContext: companyContext.trim() || undefined,
        businessModel: businessModel.trim() || undefined,
        icp: icp.trim() || undefined,
        positioning: positioning.trim() || undefined,
        tone: tone.trim() || undefined,
        enrichWithAI: input.enrichWithAI,
      }),
    onSuccess: (data, vars) => {
      // If we asked for enrichment, populate fields with what came back
      if (vars.enrichWithAI && data.pillar1) {
        if (data.pillar1.companyContext && !companyContext.trim()) setContext(data.pillar1.companyContext);
        if (data.pillar1.businessModel && !businessModel.trim()) setBusinessModel(data.pillar1.businessModel);
        if (data.pillar1.icp && !icp.trim()) setIcp(data.pillar1.icp);
        if (data.pillar1.positioning && !positioning.trim()) setPositioning(data.pillar1.positioning);
        if (data.pillar1.tone && !tone.trim()) setTone(data.pillar1.tone);
      }
    },
  });

  const canProceed = companyName.trim().length > 0 && industry.length > 0;
  const halt = submit.error instanceof ApiError ? submit.error.halt : undefined;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Pillar 1 — Identity</H2>
      <P>
        Tell us who you are. Required: company name + industry. Optional fields below sharpen
        agent context (better KPIs, more relevant connectors, less generic workflows). Click{" "}
        <strong>✨ Enhance with AI</strong> to draft them from your name + industry via Claude.
      </P>

      {halt && <HaltScreen halt={halt} onRetry={() => submit.reset()} />}

      <Card>
        <Field label="Company name" required>
          <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Acme Concierge" autoFocus />
        </Field>
        <Field label="Industry" required>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">Pick an industry…</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <span>Company context <span className="text-dim" style={{ fontSize: 12 }}>(optional)</span></span>
          <button
            type="button"
            className="secondary"
            disabled={!canProceed || submit.isPending}
            onClick={() => submit.mutate({ enrichWithAI: true })}
            style={{ fontSize: 12, padding: "0.3rem 0.7rem" }}
          >
            {submit.isPending ? "Inferring..." : "✨ Enhance with AI"}
          </button>
        </div>
        <textarea
          value={companyContext}
          onChange={(e) => setContext(e.target.value)}
          rows={3}
          placeholder="One paragraph: what you do, who for, what's unique. Or click 'Enhance with AI'."
          style={{ marginBottom: "1rem" }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field label="Business model"><input value={businessModel} onChange={(e) => setBusinessModel(e.target.value)} placeholder="SaaS / DTC / marketplace" /></Field>
          <Field label="Tone"><input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="warm / formal / playful" /></Field>
        </div>
        <Field label="ICP — ideal customer"><input value={icp} onChange={(e) => setIcp(e.target.value)} placeholder="Founders 1-10 employees, US-based" /></Field>
        <Field label="Positioning"><input value={positioning} onChange={(e) => setPositioning(e.target.value)} placeholder="Faster than X, cheaper than Y" /></Field>

        {submit.data?.inference_latency_ms && (
          <div className="text-dim" style={{ fontSize: 11, marginBottom: "0.5rem" }}>
            ✓ Enrichment resolved in {submit.data.inference_latency_ms}ms · enrichment_status:{" "}
            <code>{submit.data.pillar1.enrichment_status}</code>
          </div>
        )}
      </Card>

      <NavRow
        next={{
          onClick: () => submit.mutate({ enrichWithAI: false }, { onSuccess: () => onComplete() }),
          label: submit.isPending ? "Saving..." : "Verify Claude Max →",
        }}
        nextDisabled={!canProceed || submit.isPending}
      />
    </div>
  );
}
