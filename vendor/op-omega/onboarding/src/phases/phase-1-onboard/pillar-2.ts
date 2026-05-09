/**
 * Pillar 2 — Inference Bootstrap. Load-bearing: gates all downstream pillars.
 *
 * Calls `probeClaudeCode()` to verify the operator's claude CLI is installed,
 * authenticated, and returning results. Fails loudly if not.
 */

import { probeClaudeCode, type ClaudeCodeProbe } from "../../claude-code-check.js";
import type {
  Pillar2Response,
  ClaudePlan,
  InferenceBudgetProfile,
} from "../../schema/pillar-responses.js";

export interface Pillar2Input {
  claude_plan: ClaudePlan;
  claude_plan_other_note?: string;
  /** Override claude binary path — mostly for tests. */
  claudeBin?: string;
  /** Skip the live test call when we only want the version probe. */
  skipTestCall?: boolean;
  /**
   * Test-only: inject a mocked probe result to bypass real subprocess. Used by
   * the differential-equation suite to deterministically exercise both the
   * happy path and the claude-code-fails edge case without depending on the
   * local CLI state.
   */
  mockedProbe?: ClaudeCodeProbe;
}

function budgetProfileFor(plan: ClaudePlan): InferenceBudgetProfile {
  if (plan === "max_20x") return "premium";
  if (plan === "max_5x") return "standard";
  return "conservative";
}

export interface Pillar2Outcome {
  response: Pillar2Response;
  /** True iff the handler is willing to gate open Phase 1 progression. */
  ok: boolean;
  /** If ok === false, a human-readable hint with the next step. */
  fix_hint?: string;
}

export async function handlePillar2(input: Pillar2Input): Promise<Pillar2Outcome> {
  const probe: ClaudeCodeProbe = input.mockedProbe ?? (await probeClaudeCode({
    bin: input.claudeBin,
    skipTestCall: input.skipTestCall,
  }));

  const verified = probe.installed && probe.authenticated;
  const response: Pillar2Response = {
    claude_code_verified: verified,
    claude_plan: input.claude_plan,
    claude_plan_other_note: input.claude_plan_other_note,
    claude_version: probe.version,
    test_call_output: probe.test_output,
    inference_budget_profile: budgetProfileFor(input.claude_plan),
    verified_at: new Date().toISOString(),
  };

  if (!probe.installed) {
    return {
      response,
      ok: false,
      fix_hint:
        "claude CLI not found. Install from https://docs.claude.com/en/docs/claude-code/quickstart and run `claude` once to finish setup.",
    };
  }
  if (!probe.authenticated) {
    return {
      response,
      ok: false,
      fix_hint: `claude installed (${probe.version}) but test call failed. Run \`claude\` in a terminal and sign in with your Max account. Error: ${probe.error ?? "unknown"}`,
    };
  }

  return { response, ok: true };
}
