/** Covers normalizeRecommendation — the guard that pins a model's raw
 *  recommendation JSON to the accept/decline/propose-time enum, a [0,1]
 *  confidence, and proposed_times that only ride with propose-time. */

import { describe, expect, it } from "vitest";
import { normalizeRecommendation } from "../src/avatar/runners/calendar-triage.js";

describe("normalizeRecommendation", () => {
  it("passes a well-formed propose-time recommendation through", () => {
    const rec = normalizeRecommendation({
      suggested: "propose-time",
      proposed_times: ["2026-06-29T15:00:00Z"],
      draft_message: "could we move it?",
      confidence: 0.72,
      reasoning: "soft conflict",
    });
    expect(rec).toEqual({
      suggested: "propose-time",
      proposed_times: ["2026-06-29T15:00:00Z"],
      draft_message: "could we move it?",
      confidence: 0.72,
      reasoning: "soft conflict",
    });
  });

  it("falls back to decline when suggested is off-enum", () => {
    expect(normalizeRecommendation({ suggested: "maybe", confidence: 0.6 }).suggested).toBe("decline");
    expect(normalizeRecommendation({ confidence: 0.6 }).suggested).toBe("decline");
  });

  it("drops proposed_times unless the suggestion is propose-time", () => {
    expect(normalizeRecommendation({ suggested: "accept", proposed_times: ["2026-06-29T15:00:00Z"] }).proposed_times).toBeNull();
  });

  it("keeps only string entries in proposed_times", () => {
    const rec = normalizeRecommendation({ suggested: "propose-time", proposed_times: ["2026-06-29T15:00:00Z", 42, null] });
    expect(rec.proposed_times).toEqual(["2026-06-29T15:00:00Z"]);
  });

  it("nulls proposed_times when not an array", () => {
    expect(normalizeRecommendation({ suggested: "propose-time", proposed_times: "tomorrow" }).proposed_times).toBeNull();
  });

  it("drops proposed_times that don't parse as a datetime", () => {
    const rec = normalizeRecommendation({
      suggested: "propose-time",
      proposed_times: ["2026-06-29T15:00:00Z", "any time Tuesday", "next week"],
    });
    expect(rec.proposed_times).toEqual(["2026-06-29T15:00:00Z"]);
  });

  it("clamps confidence into [0,1] and defaults non-finite", () => {
    expect(normalizeRecommendation({ suggested: "accept", confidence: 1.5 }).confidence).toBe(1);
    expect(normalizeRecommendation({ suggested: "accept", confidence: -0.2 }).confidence).toBe(0);
    expect(normalizeRecommendation({ suggested: "accept" }).confidence).toBe(0.5);
    expect(normalizeRecommendation({ suggested: "accept", confidence: NaN }).confidence).toBe(0.5);
  });

  it("supplies placeholder reasoning and null draft when absent", () => {
    const rec = normalizeRecommendation({ suggested: "decline" });
    expect(rec.reasoning).toBe("no reasoning provided");
    expect(rec.draft_message).toBeNull();
  });
});
