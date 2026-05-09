/**
 * OPΩ-ONB-TEST-001-rev2 · Appendix §1
 *
 * Mocks ONLY:
 *   - Pillar 1 T2 enrichment (external website fetch is non-deterministic)
 *   - Pillar 2 shell probe (binary availability differs across CI agents)
 *
 * Does NOT mock:
 *   - T2 refinement calls in Phases 2/3/4 (the system behavior being tested)
 *   - T2 imprint call in Finalize
 *   - Monte Carlo (deterministic TS, seeded per fixture)
 *
 * Every mock is driven by fields in the fixture JSON. Fixture edits change
 * test inputs; no code changes required.
 */

import type { ClaudeCodeProbe } from "../../../src/claude-code-check.js";
import type { Pillar1Input } from "../../../src/phases/phase-1-onboard/pillar-1.js";
import type { Pillar2Input } from "../../../src/phases/phase-1-onboard/pillar-2.js";

export interface FixtureEnrichment {
  company_context: string;
  has_product: boolean;
  industry_hint: string;
  business_model_hint: string;
}

export interface FixtureShellResult {
  exit_code: number;
  stdout?: string;
  stderr?: string;
}

export interface FixturePillar1 {
  org_name: string;
  input: string;
  mocked_enrichment: FixtureEnrichment;
}

export interface FixturePillar2 {
  claude_plan: "max_20x" | "max_5x" | "api_only" | "other";
  claude_plan_other_note?: string;
  mocked_shell_result: FixtureShellResult;
}

/**
 * Build a `Pillar1Input` from the fixture's pillar_1 block using the
 * existing `deterministicOverride` hook. No code path in production uses
 * that hook — it's purely a test seam.
 */
export function buildPillar1Input(fixture: FixturePillar1): Pillar1Input {
  return {
    org_name: fixture.org_name,
    raw_input: fixture.input,
    deterministicOverride: {
      org_name: fixture.org_name,
      company_context: fixture.mocked_enrichment.company_context,
      has_product: fixture.mocked_enrichment.has_product,
      industry_hint: fixture.mocked_enrichment.industry_hint,
      business_model_hint: fixture.mocked_enrichment.business_model_hint,
      raw_input: fixture.input,
    },
  };
}

/**
 * Build a `Pillar2Input` from the fixture's pillar_2 block using the new
 * `mockedProbe` hook.
 */
export function buildPillar2Input(fixture: FixturePillar2): Pillar2Input {
  const shell = fixture.mocked_shell_result;
  const succeeded = shell.exit_code === 0;
  const probe: ClaudeCodeProbe = {
    installed: succeeded,
    version: succeeded ? "2.1.114 (mocked)" : undefined,
    authenticated: succeeded,
    billing_type: succeeded ? "subscription_included" : undefined,
    test_output: shell.stdout ?? (succeeded ? "OK" : undefined),
    error: succeeded ? undefined : `mocked shell exit ${shell.exit_code}: ${shell.stderr ?? ""}`,
  };
  return {
    claude_plan: fixture.claude_plan,
    claude_plan_other_note: fixture.claude_plan_other_note,
    mockedProbe: probe,
  };
}
