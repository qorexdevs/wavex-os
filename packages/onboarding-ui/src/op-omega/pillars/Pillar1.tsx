/** Pillar 1 — Identity. Op-omega upstream contract:
 *  Input  : { companyId, org_name, raw_input, manual_context? }
 *    raw_input is a URL or product description; the plugin enriches via T2.
 *    manual_context bypasses T2 enrichment when provided.
 *  Output : Pillar1Response with snake_case enrichment fields. */

import { useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import type { Pillar1Response } from "@op-omega/plugin-onboarding";
import { Card, Field, H2, NavRow, P } from "../components/primitives";
import { HaltScreen } from "../components/HaltScreen";

interface Props {
  companyId: string;
  initial: Pillar1Response | undefined;
  onComplete: () => void;
}

export function Pillar1({ companyId, initial, onComplete }: Props) {
  const [orgName, setOrgName] = useState(initial?.org_name ?? "");
  const [rawInput, setRawInput] = useState("");
  const [manualContext, setManualContext] = useState(initial?.company_context ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [halt, setHalt] = useState<ApiError["halt"]>(undefined);
  const [result, setResult] = useState<Pillar1Response | undefined>(initial);

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    setHalt(undefined);
    try {
      const resp = await opOmegaOnboardingApi.pillar1({
        companyId,
        org_name: orgName.trim(),
        raw_input: rawInput.trim() || orgName.trim(),
        manual_context: manualContext.trim().length >= 40 ? manualContext.trim() : undefined,
      });
      setResult(resp.response);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.halt) setHalt(e.halt);
        else setError(e.message);
      } else {
        setError((e as Error).message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = orgName.trim().length > 0 && !submitting;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Pillar 1 — Identity</H2>
      <P>
        Tell us who you are. The pipeline enriches your input via T2 to draft an industry hint,
        business model, ICP, and competitive positioning. Provide a URL OR ≥40 chars of manual context.
      </P>

      {halt && <HaltScreen halt={halt} onRetry={() => { setHalt(undefined); setError(null); }} />}
      {error && <Card><p style={{ color: "var(--warning)", margin: 0 }}>✗ {error}</p></Card>}

      <Card>
        <Field label="Company name" required>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Concierge"
            autoFocus
          />
        </Field>
        <Field label="URL or short pitch (raw input for T2 enrichment)">
          <input
            type="text"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="acme.com  OR  AI concierge for boutique hotels"
          />
        </Field>
        <Field label="Manual context (≥40 chars — bypasses T2 enrichment if provided)">
          <textarea
            value={manualContext}
            onChange={(e) => setManualContext(e.target.value)}
            rows={3}
            placeholder="One paragraph: what you do, who for, what's unique. Skips T2 enrichment when provided."
          />
        </Field>

        {result && (
          <div style={{ marginTop: "1rem", padding: "0.75rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4 }}>
            <div className="text-dim" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              ENRICHMENT RESULT (status: <code>{result.enrichment_status ?? "—"}</code>)
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <div><strong>Context:</strong> {result.company_context}</div>
              <div><strong>Industry:</strong> {result.industry_hint}</div>
              <div><strong>Business model:</strong> {result.business_model_hint}</div>
              <div><strong>Has product:</strong> {result.has_product ? "yes" : "no"}</div>
              {result.ideal_customer_profile && <div><strong>ICP:</strong> {result.ideal_customer_profile}</div>}
              {result.competitive_position && <div><strong>Position:</strong> {result.competitive_position}</div>}
              {result.tone_signal && <div><strong>Tone:</strong> {result.tone_signal}</div>}
            </div>
          </div>
        )}
      </Card>

      <NavRow
        back={result ? { onClick: () => setResult(undefined), label: "← Re-enrich" } : undefined}
        next={result
          ? { onClick: onComplete, label: "Continue →" }
          : { onClick: submit, label: submitting ? "Enriching…" : "Enrich →" }}
        nextDisabled={!canSubmit && !result}
      />
    </div>
  );
}
