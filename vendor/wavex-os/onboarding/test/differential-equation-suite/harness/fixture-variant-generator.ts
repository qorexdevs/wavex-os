/**
 * OPΩ-ONB-TEST-001-rev2 · Step 7 · Variant Generator
 *
 * Takes a base fixture + pillar + alternative answer → writes a variant JSON
 * into `fixtures/variants/generated/`. Runs regenerate on every suite
 * invocation; directory is gitignored.
 *
 * Suite 1 (divergence) uses these variants to assert that toggling one pillar
 * answer produces the expected downstream manifest diff.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { OnboardingFixture } from "./run-onboarding-pipeline.js";

export type PillarToVary = 1 | 3 | 4 | 5;

/** The alternatives we vary against, per pillar. Pillar 2 is verified/gate —
 * not a surface-variation axis. */
export const PILLAR_ALTERNATIVES = {
  1: [
    { key: "has_product_false", change: (f: OnboardingFixture): OnboardingFixture => ({
      ...f,
      pillar_1: {
        ...f.pillar_1,
        input: "no product yet",
        mocked_enrichment: { ...f.pillar_1.mocked_enrichment, has_product: false, industry_hint: "unknown", business_model_hint: "unknown" },
      },
    }) },
  ],
  3: [
    { key: "stage_less_than_10k", change: (f: OnboardingFixture): OnboardingFixture => ({
      ...f,
      pillar_3: { ...f.pillar_3, stage: "less_than_10k_mrr" },
    }) },
    { key: "stage_more_than_1m", change: (f: OnboardingFixture): OnboardingFixture => ({
      ...f,
      pillar_3: { ...f.pillar_3, stage: "more_than_1m_mrr" },
    }) },
    { key: "product_state_prototype", change: (f: OnboardingFixture): OnboardingFixture => ({
      ...f,
      pillar_3: { ...f.pillar_3, product_state: "prototype_mvp", stage: "pre_launch" },
    }) },
  ],
  4: [
    { key: "gtm_inbound_plg", change: (f: OnboardingFixture): OnboardingFixture => ({
      ...f,
      pillar_4: { ...f.pillar_4, lead_source: "inbound_ads_meta_google", lead_sources: ["inbound_ads_meta_google"], sales_motion: "self_serve_plg", close_channel: undefined },
    }) },
    { key: "gtm_content_led", change: (f: OnboardingFixture): OnboardingFixture => ({
      ...f,
      pillar_4: { ...f.pillar_4, lead_source: "content_seo", lead_sources: ["content_seo"], sales_motion: "self_serve_plg", close_channel: undefined },
    }) },
    { key: "gtm_referral", change: (f: OnboardingFixture): OnboardingFixture => ({
      ...f,
      pillar_4: { ...f.pillar_4, lead_source: "referral_word_of_mouth", lead_sources: ["referral_word_of_mouth"], sales_motion: "assisted_demo", close_channel: "mixed" },
    }) },
    { key: "gtm_bootstrap", change: (f: OnboardingFixture): OnboardingFixture => ({
      ...f,
      pillar_4: { ...f.pillar_4, lead_source: "none_yet", lead_sources: ["none_yet"], sales_motion: "none_yet", close_channel: undefined },
    }) },
  ],
  5: [
    { key: "comm_telegram", change: (f: OnboardingFixture): OnboardingFixture => ({
      ...f,
      pillar_5: { ...f.pillar_5, comm_channel: "telegram" },
    }) },
    { key: "comm_email_only", change: (f: OnboardingFixture): OnboardingFixture => ({
      ...f,
      pillar_5: { comm_channel: "email_only" },
    }) },
  ],
} as const;

export interface Variant {
  base_fixture_id: string;
  pillar_varied: PillarToVary;
  alternative_key: string;
  variant: OnboardingFixture;
}

export function makeVariantId(base: OnboardingFixture, pillar: PillarToVary, altKey: string): string {
  return `${base.fixture_id}__p${pillar}_${altKey}`;
}

export function generateVariants(base: OnboardingFixture): Variant[] {
  const out: Variant[] = [];
  for (const pillar of [1, 3, 4, 5] as PillarToVary[]) {
    const alts = PILLAR_ALTERNATIVES[pillar];
    for (const alt of alts) {
      const modified = alt.change(base);
      const variant: OnboardingFixture = {
        ...modified,
        fixture_id: makeVariantId(base, pillar, alt.key),
        description: `${base.fixture_id} with pillar_${pillar} toggled to ${alt.key}`,
      };
      out.push({
        base_fixture_id: base.fixture_id,
        pillar_varied: pillar,
        alternative_key: alt.key,
        variant,
      });
    }
  }
  return out;
}

export async function writeVariantsForBase(
  base: OnboardingFixture,
  outDir: string,
): Promise<Variant[]> {
  await mkdir(outDir, { recursive: true });
  const variants = generateVariants(base);
  for (const v of variants) {
    const path = join(outDir, `${v.variant.fixture_id}.json`);
    await writeFile(path, JSON.stringify(v.variant, null, 2), "utf8");
  }
  return variants;
}
