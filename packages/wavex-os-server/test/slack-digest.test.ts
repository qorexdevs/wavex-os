/** Covers normalizeClassification — the guard that pins a model's raw
 *  classification JSON to the urgent/info/fyi enum and a [0,1] confidence. */

import { describe, expect, it } from "vitest";
import { normalizeClassification } from "../src/avatar/runners/slack-digest.js";

describe("normalizeClassification", () => {
  it("passes a well-formed classification through unchanged", () => {
    const cls = normalizeClassification({ importance: "urgent", confidence: 0.88, reasoning: "active incident" });
    expect(cls).toEqual({ importance: "urgent", confidence: 0.88, reasoning: "active incident" });
  });

  it("falls back to fyi when importance is off-enum", () => {
    expect(normalizeClassification({ importance: "critical", confidence: 0.7 }).importance).toBe("fyi");
    expect(normalizeClassification({ confidence: 0.7 }).importance).toBe("fyi");
  });

  it("clamps confidence into [0,1]", () => {
    expect(normalizeClassification({ importance: "info", confidence: 1.5 }).confidence).toBe(1);
    expect(normalizeClassification({ importance: "info", confidence: -0.2 }).confidence).toBe(0);
  });

  it("defaults confidence to 0.5 when missing or not finite", () => {
    expect(normalizeClassification({ importance: "info" }).confidence).toBe(0.5);
    expect(normalizeClassification({ importance: "info", confidence: NaN }).confidence).toBe(0.5);
  });

  it("supplies a placeholder reasoning when absent", () => {
    expect(normalizeClassification({ importance: "fyi" }).reasoning).toBe("no reasoning provided");
  });
});
