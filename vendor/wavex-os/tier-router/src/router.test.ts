import { describe, expect, it } from "vitest";
import { decide } from "./router.js";
import type { BudgetSnapshot, TierRoutingRequest } from "./types.js";

function req(overrides: Partial<TierRoutingRequest["task_metadata"]> = {}): TierRoutingRequest {
  return {
    agent_id: "test.agent",
    prompt: "…",
    task_metadata: {
      creativity_required: false,
      customer_facing: false,
      reasoning_depth: "none",
      ...overrides,
    },
  };
}

const OK_BUDGET: BudgetSnapshot = {
  claude5hPctUsed: 10,
  claudeWeeklyPctUsed: 5,
  canRouteT2: true,
  canOverflow: false,
  apiOverflowMonthlyRemainingUsd: 0,
  recommendation: "ok",
};

const HALT_BUDGET: BudgetSnapshot = {
  claude5hPctUsed: 100,
  claudeWeeklyPctUsed: 90,
  canRouteT2: false,
  canOverflow: false,
  apiOverflowMonthlyRemainingUsd: 0,
  recommendation: "halt",
};

describe("tier-router decide()", () => {
  it("routes deterministic tasks to T0", () => {
    const d = decide(req(), OK_BUDGET);
    expect(d.tier).toBe(0);
    expect(d.runtime).toBe("typescript");
  });

  it("routes shallow non-customer-facing to T1 Ollama", () => {
    const d = decide(req({ reasoning_depth: "shallow", creativity_required: false }), OK_BUDGET);
    expect(d.tier).toBe(1);
    expect(d.runtime).toBe("ollama");
  });

  it("routes creative requests to T2 when budget has headroom", () => {
    const d = decide(
      req({ creativity_required: true, reasoning_depth: "deep", customer_facing: true }),
      OK_BUDGET,
    );
    expect(d.tier).toBe(2);
    expect(d.runtime).toBe("claude-code");
  });

  it("routes deep reasoning to T2 even when non-customer-facing", () => {
    const d = decide(
      req({ reasoning_depth: "deep", customer_facing: false, creativity_required: false }),
      OK_BUDGET,
    );
    expect(d.tier).toBe(2);
  });

  it("defers T2 when budget halted and no overflow", () => {
    const d = decide(
      req({ reasoning_depth: "deep", creativity_required: true, customer_facing: true }),
      HALT_BUDGET,
    );
    expect(d.deferred).toBeDefined();
    expect(d.deferred?.reason).toContain("halt");
  });

  it("uses overflow when critical priority + budget available", () => {
    const d = decide(
      req({ reasoning_depth: "deep", creativity_required: true, customer_facing: true, priority: "critical" }),
      { ...HALT_BUDGET, canOverflow: true, apiOverflowMonthlyRemainingUsd: 25 },
    );
    expect(d.tier).toBe(2);
    expect(d.runtime).toBe("claude-api-overflow");
    expect(d.useOverflow).toBe(true);
  });

  it("does NOT use overflow for non-critical priority, defers instead", () => {
    const d = decide(
      req({ reasoning_depth: "deep", creativity_required: true, customer_facing: true, priority: "normal" }),
      { ...HALT_BUDGET, canOverflow: true, apiOverflowMonthlyRemainingUsd: 25 },
    );
    expect(d.deferred).toBeDefined();
  });

  it("allows T2 for critical priority in tight-headroom band", () => {
    const tight: BudgetSnapshot = { ...OK_BUDGET, claude5hPctUsed: 85 };
    const d = decide(
      req({ creativity_required: true, reasoning_depth: "deep", customer_facing: true, priority: "critical" }),
      tight,
    );
    expect(d.tier).toBe(2);
    expect(d.runtime).toBe("claude-code");
  });
});
