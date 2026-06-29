/** Covers normalizeRecommendation — the guard that pins a model's raw
 *  recommendation JSON to the accept/decline/propose-time enum, a [0,1]
 *  confidence, and proposed_times that only ride with propose-time. */

import { describe, expect, it } from "vitest";
import { normalizeRecommendation, markConflicts, eventInsideWorkingHours, eventSpillsAfterHours } from "../src/avatar/runners/calendar-triage.js";
import type { CalendarEvent } from "../src/avatar/runners/calendar/types.js";

function ev(eventId: string, start: string, end: string): CalendarEvent {
  return {
    eventId, summary: eventId, organizer: { name: "o", email: "o@x.com" },
    attendees: [], start, end, responseStatus: "needsAction",
  };
}

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

describe("markConflicts", () => {
  it("flags both invites when their ranges overlap", () => {
    const events = markConflicts([
      ev("a", "2026-06-29T10:00:00Z", "2026-06-29T11:00:00Z"),
      ev("b", "2026-06-29T10:30:00Z", "2026-06-29T11:30:00Z"),
    ]);
    expect(events.map((e) => e.hasConflict)).toEqual([true, true]);
  });

  it("leaves back-to-back invites unflagged", () => {
    const events = markConflicts([
      ev("a", "2026-06-29T10:00:00Z", "2026-06-29T11:00:00Z"),
      ev("b", "2026-06-29T11:00:00Z", "2026-06-29T12:00:00Z"),
    ]);
    expect(events.every((e) => e.hasConflict)).toBe(false);
  });

  it("only flags the invites that actually clash", () => {
    const events = markConflicts([
      ev("a", "2026-06-29T10:00:00Z", "2026-06-29T11:00:00Z"),
      ev("b", "2026-06-29T10:30:00Z", "2026-06-29T11:30:00Z"),
      ev("c", "2026-06-29T14:00:00Z", "2026-06-29T15:00:00Z"),
    ]);
    expect(events.map((e) => Boolean(e.hasConflict))).toEqual([true, true, false]);
  });

  it("skips invites whose times don't parse", () => {
    const events = markConflicts([
      ev("a", "not a date", "still not"),
      ev("b", "2026-06-29T10:30:00Z", "2026-06-29T11:30:00Z"),
    ]);
    expect(events.every((e) => e.hasConflict)).toBe(false);
  });

  it("grades a half-or-more overlap as a hard conflict", () => {
    // both 1h, overlapping 30min -> 0.5 of the shorter event
    const events = markConflicts([
      ev("a", "2026-06-29T10:00:00Z", "2026-06-29T11:00:00Z"),
      ev("b", "2026-06-29T10:30:00Z", "2026-06-29T11:30:00Z"),
    ]);
    expect(events.map((e) => e.conflictKind)).toEqual(["hard", "hard"]);
  });

  it("grades a tail overlap as a soft conflict", () => {
    // a is 2h, b is 1h, they share 15min -> 0.25 of the shorter (b)
    const events = markConflicts([
      ev("a", "2026-06-29T10:00:00Z", "2026-06-29T12:00:00Z"),
      ev("b", "2026-06-29T11:45:00Z", "2026-06-29T12:45:00Z"),
    ]);
    expect(events.map((e) => e.conflictKind)).toEqual(["soft", "soft"]);
  });

  it("keeps the strongest grade when an invite clashes both ways", () => {
    // b sits fully inside a (hard with a); c only clips b's tail (soft)
    const events = markConflicts([
      ev("a", "2026-06-29T10:00:00Z", "2026-06-29T13:00:00Z"),
      ev("b", "2026-06-29T11:00:00Z", "2026-06-29T12:00:00Z"),
      ev("c", "2026-06-29T11:50:00Z", "2026-06-29T12:30:00Z"),
    ]);
    expect(events[1].conflictKind).toBe("hard");
  });

  it("leaves conflictKind unset when nothing clashes", () => {
    const events = markConflicts([
      ev("a", "2026-06-29T10:00:00Z", "2026-06-29T11:00:00Z"),
      ev("b", "2026-06-29T14:00:00Z", "2026-06-29T15:00:00Z"),
    ]);
    expect(events.every((e) => e.conflictKind === undefined)).toBe(true);
  });
});

describe("eventInsideWorkingHours", () => {
  const profile = (tz: string) => ({
    name: "o", role: "ops", working_hours: ["09:00", "17:00"] as [string, string], tz,
  });

  it("resolves the start hour in the operator's tz, not UTC", () => {
    // 23:00Z is 16:00 in Los Angeles (PDT) — inside 09-17 there, outside in UTC
    const e = ev("a", "2026-06-29T23:00:00Z", "2026-06-29T23:30:00Z");
    expect(eventInsideWorkingHours(e, profile("America/Los_Angeles"))).toBe(true);
    expect(eventInsideWorkingHours(e, profile("UTC"))).toBe(false);
  });

  it("counts the working-hours boundaries as inside", () => {
    const e = ev("a", "2026-06-29T16:00:00Z", "2026-06-29T16:30:00Z"); // 09:00 PDT
    expect(eventInsideWorkingHours(e, profile("America/Los_Angeles"))).toBe(true);
  });

  it("falls back to UTC when the tz is unknown", () => {
    const e = ev("a", "2026-06-29T12:00:00Z", "2026-06-29T12:30:00Z");
    expect(eventInsideWorkingHours(e, profile("Mars/Phobos"))).toBe(true);
  });
});

describe("eventSpillsAfterHours", () => {
  const profile = (tz: string) => ({
    name: "o", role: "ops", working_hours: ["09:00", "17:00"] as [string, string], tz,
  });

  it("flags an invite that starts inside but runs past EOD", () => {
    const e = ev("a", "2026-06-29T16:30:00Z", "2026-06-29T18:30:00Z");
    expect(eventSpillsAfterHours(e, profile("UTC"))).toBe(true);
  });

  it("leaves a fully-inside invite unflagged", () => {
    const e = ev("a", "2026-06-29T10:00:00Z", "2026-06-29T11:00:00Z");
    expect(eventSpillsAfterHours(e, profile("UTC"))).toBe(false);
  });

  it("treats an end exactly on the boundary as inside", () => {
    const e = ev("a", "2026-06-29T16:00:00Z", "2026-06-29T17:00:00Z");
    expect(eventSpillsAfterHours(e, profile("UTC"))).toBe(false);
  });

  it("ignores invites that start outside hours", () => {
    const e = ev("a", "2026-06-29T07:00:00Z", "2026-06-29T08:30:00Z");
    expect(eventSpillsAfterHours(e, profile("UTC"))).toBe(false);
  });

  it("resolves the spill in the operator's tz", () => {
    // 23:30Z-01:30Z is 16:30-18:30 in Los Angeles — inside start, ends after 17:00 there
    const e = ev("a", "2026-06-29T23:30:00Z", "2026-06-30T01:30:00Z");
    expect(eventSpillsAfterHours(e, profile("America/Los_Angeles"))).toBe(true);
  });

  it("can't spill on an unparseable end", () => {
    const e = ev("a", "2026-06-29T16:30:00Z", "not-a-date");
    expect(eventSpillsAfterHours(e, profile("UTC"))).toBe(false);
  });
});
