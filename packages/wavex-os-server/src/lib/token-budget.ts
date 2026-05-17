/** Per-company T2 token budget. The operator sets a project-level cap;
 *  withTokenAccounting checks current usage against it before each call.
 *  When usage >= cap, new T2 calls are rejected (HTTP 429 from routes)
 *  with an explicit raise hint — the operator can re-set a higher cap and
 *  continue. Calls already in flight are not aborted (would waste spend).
 *
 *  Budget lives in the same per-company onboarding dir as token-usage.json
 *  and is wiped by Reset along with the rest of the company state. */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getOnboardingDir } from "../state-bridge.js";
import { readTokenUsage } from "./token-accounting.js";

export interface TokenBudget {
  /** Hard cap on input + output tokens combined. Setting to null disables
   *  enforcement entirely (the default until the operator opts in). */
  cap_tokens: number | null;
  /** When set, the operator chose this cap explicitly (vs the default). */
  set_at: string | null;
}

const DEFAULT_BUDGET: TokenBudget = { cap_tokens: null, set_at: null };

function budgetPath(companyId: string): string {
  return join(getOnboardingDir(companyId), "token-budget.json");
}

export async function readBudget(companyId: string): Promise<TokenBudget> {
  try {
    const raw = await readFile(budgetPath(companyId), "utf8");
    return JSON.parse(raw) as TokenBudget;
  } catch {
    return DEFAULT_BUDGET;
  }
}

export async function writeBudget(companyId: string, capTokens: number | null): Promise<TokenBudget> {
  const path = budgetPath(companyId);
  await mkdir(dirname(path), { recursive: true });
  const next: TokenBudget = {
    cap_tokens: capTokens,
    set_at: capTokens === null ? null : new Date().toISOString(),
  };
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2), "utf8");
  const { rename } = await import("node:fs/promises");
  await rename(tmp, path);
  return next;
}

export class BudgetExhaustedError extends Error {
  constructor(
    public readonly companyId: string,
    public readonly used: number,
    public readonly cap: number,
  ) {
    super(`token budget exhausted: ${used} used >= ${cap} cap`);
    this.name = "BudgetExhaustedError";
  }
}

/** Returns the current total token spend for a company (input+output). */
export async function currentSpend(companyId: string): Promise<number> {
  const usage = await readTokenUsage(companyId);
  if (!usage) return 0;
  return usage.total.input_tokens + usage.total.output_tokens;
}

/** Throws BudgetExhaustedError when the company has hit its cap. No-op
 *  when no budget is set (cap_tokens=null). Called by withTokenAccounting
 *  before each T2 route handler runs its fn. */
export async function assertWithinBudget(companyId: string): Promise<void> {
  const budget = await readBudget(companyId);
  if (budget.cap_tokens === null) return;
  const used = await currentSpend(companyId);
  if (used >= budget.cap_tokens) {
    throw new BudgetExhaustedError(companyId, used, budget.cap_tokens);
  }
}
