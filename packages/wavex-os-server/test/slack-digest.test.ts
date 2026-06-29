/** Covers normalizeClassification — the guard that pins a model's raw
 *  classification JSON to the urgent/info/fyi enum and a [0,1] confidence. */

import { describe, expect, it } from "vitest";
import { normalizeClassification, inPrivacyZone, isVipAuthor, applyVipFloor } from "../src/avatar/runners/slack-digest.js";

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

describe("inPrivacyZone", () => {
  const mention = { channel: "#hr-confidential", author: { name: "People Ops", email: "people@yourco.example" } };

  it("never skips when no zones are configured", () => {
    expect(inPrivacyZone(mention, [])).toBe(false);
    expect(inPrivacyZone(mention, ["", "  "])).toBe(false);
  });

  it("matches a zone term in the channel", () => {
    expect(inPrivacyZone(mention, ["#hr"])).toBe(true);
    expect(inPrivacyZone(mention, ["Confidential"])).toBe(true);
  });

  it("matches a zone term in the author", () => {
    expect(inPrivacyZone(mention, ["people@yourco"])).toBe(true);
  });

  it("leaves an unrelated mention alone", () => {
    expect(inPrivacyZone({ channel: "#general", author: { name: "Sam" } }, ["#hr", "legal"])).toBe(false);
  });
});

describe("isVipAuthor", () => {
  const vips = [{ email: "ceo@yourco.example", label: "CEO" }];

  it("matches a VIP email ignoring case and surrounding space", () => {
    expect(isVipAuthor({ email: "CEO@yourco.example" }, vips)).toBe(true);
    expect(isVipAuthor({ email: " ceo@yourco.example " }, [{ email: "ceo@yourco.example" }])).toBe(true);
  });

  it("is false for a non-VIP or an author with no email", () => {
    expect(isVipAuthor({ email: "intern@yourco.example" }, vips)).toBe(false);
    expect(isVipAuthor({}, vips)).toBe(false);
    expect(isVipAuthor({ email: "ceo@yourco.example" }, [])).toBe(false);
  });
});

describe("applyVipFloor", () => {
  const vips = [{ email: "ceo@yourco.example" }];
  const fyi = { importance: "fyi" as const, confidence: 0.4, reasoning: "low signal" };
  const base = {
    channel: "#general", channelId: "C1", author: { name: "Chief", email: "ceo@yourco.example" },
    ts: "2026-01-01T00:00:00Z", text: "@operator can you look at this when you get a sec?",
    permalink: "https://x.example/1",
  };

  it("raises a VIP's direct fyi mention to urgent", () => {
    const out = applyVipFloor(fyi, base, vips);
    expect(out.importance).toBe("urgent");
    expect(out.reasoning).toContain("VIP author");
  });

  it("leaves a VIP broadcast at fyi", () => {
    const out = applyVipFloor(fyi, { ...base, text: "@channel standup moved to 11" }, vips);
    expect(out.importance).toBe("fyi");
  });

  it("does not touch a non-VIP or an already higher rating", () => {
    expect(applyVipFloor(fyi, { ...base, author: { name: "Sam", email: "sam@yourco.example" } }, vips).importance).toBe("fyi");
    const info = { importance: "info" as const, confidence: 0.6, reasoning: "ask, no deadline" };
    expect(applyVipFloor(info, base, vips)).toEqual(info);
  });
});
