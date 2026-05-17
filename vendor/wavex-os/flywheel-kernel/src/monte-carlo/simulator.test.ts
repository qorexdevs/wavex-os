import { describe, expect, it } from "vitest";
import { runMonteCarlo, simulateStrategy } from "./simulator.js";
import { STRATEGIES, getStrategy } from "./strategies.js";
import type { KPISnapshot } from "../types.js";

const START: KPISnapshot = {
  t: "2026-04-20T00:00:00Z",
  mrr: 45_000,
  nrr: 1.05,
  grr: 0.92,
  cac: 900,
  cac_payback_months: 12,
  burn_multiple: 1.3,
  activation_rate: 0.38,
  sales_cycle_days: 28,
  win_rate: 0.22,
  ltv_cac_ratio: 2.8,
  pipeline_velocity: 150_000,
  narrative_strength: 0.5,
};

describe("Monte Carlo simulator", () => {
  it("returns 5 strategies", () => {
    const report = runMonteCarlo(START, 15, 10, 42);
    expect(report.strategies).toHaveLength(5);
    const ids = report.strategies.map((s) => s.strategy_id).sort();
    expect(ids).toEqual(STRATEGIES.map((s) => s.id).sort());
  });

  it("is deterministic with the same seed", () => {
    const a = runMonteCarlo(START, 15, 10, 42);
    const b = runMonteCarlo(START, 15, 10, 42);
    expect(a.winner.strategy_id).toBe(b.winner.strategy_id);
    for (let i = 0; i < a.strategies.length; i++) {
      expect(a.strategies[i].mean_mrr_growth).toBeCloseTo(b.strategies[i].mean_mrr_growth, 10);
    }
  });

  it("different seeds produce (possibly) different winners but valid reports", () => {
    const a = runMonteCarlo(START, 15, 10, 1);
    const b = runMonteCarlo(START, 15, 10, 2);
    for (const rep of [a, b]) {
      expect(rep.strategies).toHaveLength(5);
      expect(rep.winner.rationale).toContain(rep.winner.strategy_id);
    }
  });

  it("winner has best Sharpe among non-ruinous strategies", () => {
    const report = runMonteCarlo(START, 30, 20, 42);
    const winner = report.strategies.find((s) => s.strategy_id === report.winner.strategy_id)!;
    const eligible = report.strategies.filter((s) => s.p_ruin < 0.25);
    const pool = eligible.length > 0 ? eligible : report.strategies;
    for (const candidate of pool) {
      expect(winner.sharpe).toBeGreaterThanOrEqual(candidate.sharpe - 1e-9);
    }
  });

  it("simulateStrategy returns sensible stats", () => {
    const r = simulateStrategy(START, getStrategy("BALANCED"), 20, 15, 42);
    expect(r.n_runs).toBe(15);
    expect(r.mean_burn_multiple).toBeGreaterThan(0);
    expect(r.p_auto_catalytic).toBeGreaterThanOrEqual(0);
    expect(r.p_auto_catalytic).toBeLessThanOrEqual(1);
    expect(Number.isFinite(r.sharpe)).toBe(true);
  });

  it("reports p_auto_catalytic > 0 for at least one strategy on a healthy starting state", () => {
    const healthy: KPISnapshot = { ...START, nrr: 1.12, burn_multiple: 1.1 };
    const report = runMonteCarlo(healthy, 30, 30, 42);
    const anyReached = report.strategies.some((s) => s.p_auto_catalytic > 0);
    expect(anyReached).toBe(true);
  });
});
