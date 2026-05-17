/**
 * NEW-C3.1 · Operator confirmation of Pillar 1 enriched signals.
 *
 * Shown after Pillar 1 submits, before Pillar 2. Displays the three
 * inferred signals that cascade into Phase 2/3/4 decisions (industry,
 * business model, has-product). Operator can edit any field; on confirm,
 * corrections override enriched values downstream.
 */

import { useState } from "react";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { Check } from "lucide-react";

export interface Pillar1Enrichment {
  industry_hint: string;
  business_model_hint: string;
  has_product: boolean;
}

export interface Pillar1InferenceCorrections {
  industry_hint?: string;
  business_model_hint?: string;
  has_product?: boolean;
}

export interface Pillar1InferencePreviewProps {
  enriched: Pillar1Enrichment;
  onConfirm: (result: { confirmed: true; corrections?: Pillar1InferenceCorrections }) => void;
}

const INDUSTRY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "dev_tools", label: "Developer tools" },
  { value: "dev_infrastructure", label: "Developer infrastructure" },
  { value: "fintech", label: "Fintech" },
  { value: "fintech_retail", label: "Fintech (retail)" },
  { value: "healthtech", label: "Healthtech" },
  { value: "legal_tech", label: "Legal tech" },
  { value: "dtc_ecommerce", label: "DTC ecommerce" },
  { value: "consumer_mobile", label: "Consumer mobile" },
  { value: "enterprise_saas", label: "Enterprise SaaS" },
  { value: "marketplace", label: "Marketplace" },
  { value: "edtech", label: "Edtech" },
  { value: "agency_services", label: "Agency / services" },
  { value: "unknown", label: "Other" },
];

const BUSINESS_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "subscription", label: "Subscription" },
  { value: "usage_based", label: "Usage-based" },
  { value: "marketplace_take_rate", label: "Marketplace (take rate)" },
  { value: "one_time_purchase", label: "One-time purchase" },
  { value: "freemium", label: "Freemium" },
  { value: "enterprise_license", label: "Enterprise license" },
  { value: "services_retainer", label: "Services / retainer" },
  { value: "unknown", label: "Other" },
];

export function Pillar1InferencePreview({ enriched, onConfirm }: Pillar1InferencePreviewProps) {
  const [industry, setIndustry] = useState(enriched.industry_hint);
  const [businessModel, setBusinessModel] = useState(enriched.business_model_hint);
  const [hasProduct, setHasProduct] = useState(enriched.has_product);

  function handleConfirm() {
    const corrections: Pillar1InferenceCorrections = {};
    if (industry !== enriched.industry_hint) corrections.industry_hint = industry;
    if (businessModel !== enriched.business_model_hint) corrections.business_model_hint = businessModel;
    if (hasProduct !== enriched.has_product) corrections.has_product = hasProduct;
    onConfirm({
      confirmed: true,
      corrections: Object.keys(corrections).length > 0 ? corrections : undefined,
    });
  }

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">Does this match your company?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These three signals drive the rest of the onboarding — your connectors, agent roster,
          and Monte Carlo strategy. Correct anything that's wrong before we commit.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Industry</label>
          <select
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            {INDUSTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            {!INDUSTRY_OPTIONS.some((o) => o.value === industry) && (
              <option value={industry}>{industry}</option>
            )}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Business model</label>
          <select
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            value={businessModel}
            onChange={(e) => setBusinessModel(e.target.value)}
          >
            {BUSINESS_MODEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            {!BUSINESS_MODEL_OPTIONS.some((o) => o.value === businessModel) && (
              <option value={businessModel}>{businessModel}</option>
            )}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Has product</label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={hasProduct ? "default" : "outline"}
              onClick={() => setHasProduct(true)}
            >
              Yes
            </Button>
            <Button
              size="sm"
              variant={!hasProduct ? "default" : "outline"}
              onClick={() => setHasProduct(false)}
            >
              No
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleConfirm}>
          <Check className="mr-1 size-3.5" /> Confirm and continue
        </Button>
      </div>
    </Card>
  );
}
