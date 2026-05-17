#!/usr/bin/env node
/** Auto-derive affinities for every template in the registry that doesn't
 *  have explicit hand-authored affinities. Heuristics use the template's
 *  upstream division + filename keywords to assign reasonable defaults.
 *
 *  Output: packages/wavex-os-server/src/selection/affinities-auto.ts
 *  This file is GIT-COMMITTED (deterministic, repo-versioned) so the
 *  scorer doesn't need to do this work at runtime.
 *
 *  Usage:
 *    node scripts/generate-affinities.mjs           # write
 *    node scripts/generate-affinities.mjs --check   # dry-run, print summary */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REGISTRY = path.join(ROOT, "packages", "agent-templates", "_registry.json");
const OUT = path.join(ROOT, "packages", "wavex-os-server", "src", "selection", "affinities-auto.ts");
const EXPLICIT = path.join(ROOT, "packages", "wavex-os-server", "src", "selection", "affinities.ts");

const args = process.argv.slice(2);
const CHECK = args.includes("--check");

/** Pull explicitly-tagged templateIds out of affinities.ts so the generator
 *  doesn't overwrite hand-authored entries. We just regex the keys; not
 *  bullet-proof but works for the current well-formatted file. */
function loadExplicitKeys() {
  const src = readFileSync(EXPLICIT, "utf8");
  const matches = [...src.matchAll(/^\s+"([a-z][a-z0-9-]+)":\s*\{/gm)];
  return new Set(matches.map((m) => m[1]));
}

const explicitKeys = loadExplicitKeys();
const registry = JSON.parse(readFileSync(REGISTRY, "utf8"));

/** Match keywords in templateId (already kebab-case). Returns array of tags
 *  that match. Used to layer tag bundles onto the base division-derived ones. */
function tagsFromKeywords(id) {
  const t = id.toLowerCase();
  const tags = { industries: [], stages: [], gtm: [], connectors: [] };

  // Industry keywords
  if (/(blockchain|crypto|defi|web3|nft|token|onchain|zk|crypto)/.test(t)) tags.industries.push("fintech", "regulated");
  if (/(compliance|gdpr|hipaa|sox|soc2|pci|audit|regulatory|policy|consent)/.test(t)) tags.industries.push("regulated");
  if (/(health|clinic|patient|medical|pharma|biotech|fhir)/.test(t)) tags.industries.push("healthtech", "regulated");
  if (/(payment|invoice|invoicing|billing|treasury|tax|reconcil|ledger|account|finance)/.test(t)) tags.industries.push("fintech");
  if (/(commerce|shop|retail|cart|checkout|catalog|brand|consumer|merchandis|skincare|beauty|apparel)/.test(t)) tags.industries.push("ecommerce-dtc", "saas-b2c");
  if (/(marketplace|two-sided|liquidity|matching|escrow|seller|buyer|gig)/.test(t)) tags.industries.push("marketplace");
  if (/(developer|sdk|cli|api|engineer|github|repo|opensource|open-source)/.test(t)) tags.industries.push("saas-b2b", "open-source");
  if (/(b2b|enterprise|saas|workflow|ops|productivity)/.test(t)) tags.industries.push("saas-b2b");
  if (/(student|learn|course|curriculum|education|edu|teacher|class)/.test(t)) tags.industries.push("edtech");
  if (/(agency|consult|services|retainer|client)/.test(t)) tags.industries.push("agency-services");
  if (/(community|forum|discord|reddit|social)/.test(t)) tags.industries.push("open-source", "saas-b2c");
  if (/(hardware|device|iot|firmware|sensor|robot|machine)/.test(t)) tags.industries.push("hardware");

  // GTM keywords
  if (/(ads|paid-media|paid-social|programmatic|ppc|adwords|meta-ads|google-ads)/.test(t)) tags.gtm.push("paid-led");
  if (/(seo|content|blog|writer|editor|copy|article)/.test(t)) tags.gtm.push("self-serve", "community-led");
  if (/(community|advocate|ambassador|forum|discord)/.test(t)) tags.gtm.push("community-led");
  if (/(outbound|cold|prospect|linkedin|sdr|bdr)/.test(t)) tags.gtm.push("assisted-demo", "high-touch-enterprise");
  if (/(enterprise|account|deal|negotiat|procurement|rfp|contract)/.test(t)) tags.gtm.push("high-touch-enterprise");
  if (/(self-serve|plg|product-led|onboard|activation|trial|signup)/.test(t)) tags.gtm.push("self-serve");
  if (/(assisted|demo|webinar|consult)/.test(t)) tags.gtm.push("assisted-demo");
  if (/(referral|partner|affiliate|word-of-mouth)/.test(t)) tags.gtm.push("referral-led");

  // Stage keywords
  if (/(scale|enterprise|director|head-of|principal|chief|architect|lead)/.test(t)) {
    tags.stages.push("1m_5m_arr", "5m_10m_arr", "10m_plus_arr");
  } else if (/(intern|junior|associate|coordinator|specialist|jr\b)/.test(t)) {
    tags.stages.push("0_10k_arr", "10k_100k_mrr", "100k_500k_arr");
  } else {
    // Default mid-stage
    tags.stages.push("10k_100k_mrr", "100k_500k_arr", "500k_1m_arr", "1m_5m_arr");
  }

  // Connector keywords
  if (/shopify/.test(t)) tags.connectors.push("shopify");
  if (/stripe/.test(t)) tags.connectors.push("stripe");
  if (/(meta|facebook)-ads/.test(t)) tags.connectors.push("meta-ads-api");
  if (/google-ads/.test(t)) tags.connectors.push("google-ads-api");
  if (/(salesforce|sfdc)/.test(t)) tags.connectors.push("salesforce");
  if (/(hubspot|crm)/.test(t)) tags.connectors.push("hubspot");
  if (/(klaviyo|mailchimp|sendgrid)/.test(t)) tags.connectors.push("klaviyo");
  if (/(linkedin)/.test(t)) tags.connectors.push("linkedin-sales-nav");
  if (/(github|gitlab)/.test(t)) tags.connectors.push("github");
  if (/(slack|discord)/.test(t)) tags.connectors.push("slack", "discord");
  if (/(mixpanel|posthog|amplitude|analytics)/.test(t)) tags.connectors.push("mixpanel", "posthog");
  if (/(segment)/.test(t)) tags.connectors.push("segment");

  return tags;
}

/** Per-division base tag bundles. Layered first, keyword tags layered on top. */
const DIVISION_DEFAULTS = {
  engineering: {
    industries: ["saas-b2b", "open-source"], stages: ["10k_100k_mrr", "100k_500k_arr", "1m_5m_arr"],
    gtm: ["self-serve", "assisted-demo"], connectors: ["github"],
  },
  marketing: {
    industries: ["saas-b2b", "saas-b2c", "ecommerce-dtc", "marketplace"],
    stages: ["100k_500k_arr", "500k_1m_arr", "1m_5m_arr"],
    gtm: ["self-serve", "paid-led", "community-led"],
    connectors: [],
  },
  "paid-media": {
    industries: ["ecommerce-dtc", "saas-b2c", "marketplace"],
    stages: ["100k_500k_arr", "1m_5m_arr"],
    gtm: ["paid-led"],
    connectors: ["meta-ads-api", "google-ads-api"],
  },
  sales: {
    industries: ["saas-b2b", "fintech", "agency-services"],
    stages: ["100k_500k_arr", "500k_1m_arr", "1m_5m_arr", "5m_10m_arr"],
    gtm: ["assisted-demo", "high-touch-enterprise"],
    connectors: ["hubspot", "salesforce"],
  },
  product: {
    industries: ["saas-b2b", "saas-b2c", "marketplace"],
    stages: ["10k_100k_mrr", "100k_500k_arr", "500k_1m_arr"],
    gtm: ["self-serve", "assisted-demo"],
    connectors: [],
  },
  design: {
    industries: ["saas-b2b", "saas-b2c", "ecommerce-dtc"],
    stages: ["100k_500k_arr", "500k_1m_arr", "1m_5m_arr"],
    gtm: ["self-serve", "paid-led"],
    connectors: [],
  },
  finance: {
    industries: ["saas-b2b", "fintech"], stages: ["500k_1m_arr", "1m_5m_arr", "5m_10m_arr"],
    gtm: ["assisted-demo", "high-touch-enterprise"], connectors: [],
  },
  support: {
    industries: ["saas-b2b", "marketplace", "ecommerce-dtc"],
    stages: ["100k_500k_arr", "500k_1m_arr", "1m_5m_arr"],
    gtm: ["self-serve", "assisted-demo"],
    connectors: [],
  },
  testing: {
    industries: ["saas-b2b", "fintech", "regulated"],
    stages: ["100k_500k_arr", "500k_1m_arr", "1m_5m_arr"],
    gtm: ["assisted-demo", "high-touch-enterprise"],
    connectors: [],
  },
  "project-management": {
    industries: ["saas-b2b", "agency-services"],
    stages: ["500k_1m_arr", "1m_5m_arr", "5m_10m_arr"],
    gtm: ["high-touch-enterprise", "assisted-demo"],
    connectors: [],
  },
  specialized: {
    industries: [], stages: ["100k_500k_arr", "1m_5m_arr"],
    gtm: [], connectors: [],
  },
  integrations: {
    industries: ["saas-b2b", "marketplace"], stages: ["10k_100k_mrr", "100k_500k_arr"],
    gtm: ["self-serve"], connectors: [],
  },
  strategy: {
    industries: ["saas-b2b", "agency-services"], stages: ["1m_5m_arr", "5m_10m_arr", "10m_plus_arr"],
    gtm: ["high-touch-enterprise", "referral-led"], connectors: [],
  },
};

function uniq(arr) { return [...new Set(arr)]; }

const auto = {};
let counted = 0;
let skipped = 0;
const sample = [];

for (const t of registry.templates) {
  if (explicitKeys.has(t.templateId)) { skipped++; continue; }
  const division = t.division;
  const base = DIVISION_DEFAULTS[division] ?? { industries: [], stages: [], gtm: [], connectors: [] };
  const kw = tagsFromKeywords(t.templateId);
  const merged = {
    industries: uniq([...base.industries, ...kw.industries]),
    stages: uniq([...base.stages, ...kw.stages]),
    gtm: uniq([...base.gtm, ...kw.gtm]),
    connectors: uniq([...base.connectors, ...kw.connectors]),
  };
  auto[t.templateId] = merged;
  counted++;
  if (sample.length < 5) sample.push({ id: t.templateId, division, ...merged });
}

console.log(`Generator scanned ${registry.templates.length} templates`);
console.log(`  ${counted} got auto-derived affinities`);
console.log(`  ${skipped} skipped (have explicit affinities in affinities.ts)`);
console.log(``);
console.log(`Sample auto-derivations:`);
for (const s of sample) {
  console.log(`  ${s.id.padEnd(28)} (${s.division.padEnd(13)})`);
  console.log(`    industries: ${s.industries.join(", ") || "—"}`);
  console.log(`    gtm:        ${s.gtm.join(", ") || "—"}`);
  console.log(`    connectors: ${s.connectors.join(", ") || "—"}`);
}

if (CHECK) {
  console.log(``);
  console.log(`(--check mode: no file written)`);
  process.exit(0);
}

const header = `/** AUTO-GENERATED by scripts/generate-affinities.mjs.
 *  Do NOT edit by hand — re-run the generator after any registry update.
 *
 *  These affinities are derived from each template's division + templateId
 *  keywords. The hand-authored entries in affinities.ts always take
 *  precedence (the scorer checks AFFINITIES first, then AUTO_AFFINITIES). */

import type { TemplateAffinities } from "./affinities.js";

export const AUTO_AFFINITIES: Record<string, TemplateAffinities> = ${JSON.stringify(auto, null, 2)};
`;

writeFileSync(OUT, header);
console.log(``);
console.log(`Wrote ${path.relative(ROOT, OUT)} (${counted} entries)`);
