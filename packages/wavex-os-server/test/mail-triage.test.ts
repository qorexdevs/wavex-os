/** Covers normalizeClassification — pins the classifier's raw JSON to the
 *  now/soon/fyi enum and a [0,1] confidence before it reaches the autonomy
 *  gate and the dashboard. */

import { describe, expect, it } from "vitest";
import { matchVip, normalizeClassification } from "../src/avatar/runners/mail-triage.js";

describe("normalizeClassification", () => {
  it("passes a well-formed classification through unchanged", () => {
    const cls = normalizeClassification({
      classification: "now",
      draft: "thanks, on it",
      confidence: 0.9,
      reasoning: "VIP sender",
      open_question: null,
    });
    expect(cls).toEqual({
      classification: "now",
      draft: "thanks, on it",
      confidence: 0.9,
      reasoning: "VIP sender",
      open_question: null,
    });
  });

  it("falls back to fyi when classification is off-enum or missing", () => {
    expect(normalizeClassification({ classification: "urgent", confidence: 0.8 }).classification).toBe("fyi");
    expect(normalizeClassification({ confidence: 0.8 }).classification).toBe("fyi");
  });

  it("clamps confidence into [0,1] and defaults non-finite to 0.5", () => {
    expect(normalizeClassification({ classification: "soon", confidence: 2 }).confidence).toBe(1);
    expect(normalizeClassification({ classification: "soon", confidence: -1 }).confidence).toBe(0);
    expect(normalizeClassification({ classification: "soon", confidence: NaN }).confidence).toBe(0.5);
    expect(normalizeClassification({ classification: "soon" }).confidence).toBe(0.5);
  });

  it("nulls draft and open_question when absent", () => {
    const cls = normalizeClassification({ classification: "fyi" });
    expect(cls.draft).toBeNull();
    expect(cls.open_question).toBeNull();
    expect(cls.reasoning).toBe("no reasoning provided");
  });
});

describe("matchVip", () => {
  const vips = [
    { email: "ceo@acme.com", label: "CEO" },
    { email: "Lead@partner.io" },
  ];

  it("matches a sender ignoring case and surrounding whitespace", () => {
    expect(matchVip("CEO@Acme.com", vips)).toEqual({ email: "ceo@acme.com", label: "CEO" });
    expect(matchVip("  lead@partner.io ", vips)).toEqual({ email: "Lead@partner.io" });
  });

  it("returns null for a non-VIP sender or empty inputs", () => {
    expect(matchVip("random@nowhere.com", vips)).toBeNull();
    expect(matchVip("", vips)).toBeNull();
    expect(matchVip("ceo@acme.com", [])).toBeNull();
  });
});
