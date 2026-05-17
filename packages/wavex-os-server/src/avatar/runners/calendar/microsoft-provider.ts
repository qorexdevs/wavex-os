/** Microsoft Calendar implementation of CalendarProvider — Microsoft Graph events. */

import type { CalendarEvent, CalendarProvider, CalendarRecommendation } from "./types.js";

function fixtures(seed: string): CalendarEvent[] {
  const now = new Date();
  const isoIn = (deltaMs: number) => new Date(now.getTime() + deltaMs).toISOString();
  const tag = seed.slice(-6);
  return [
    {
      eventId: `mscal-${tag}-1`,
      summary: "Quarterly business review — partner attending",
      organizer: { name: "Pat Allen", email: "pat@boardco.example" },
      attendees: ["operator", "exec-team@yourco.example"],
      start: isoIn(2 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
      end: isoIn(2 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000),
      responseStatus: "needsAction",
      body: "Recurring QBR. Partner sitting in this quarter — please bring the burn slide.",
    },
    {
      eventId: `mscal-${tag}-2`,
      summary: "Vendor demo — IT compliance scan tool",
      organizer: { name: "VendorOps", email: "demos@vendorops.example" },
      attendees: ["operator"],
      start: isoIn(24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
      end: isoIn(24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000 + 30 * 60 * 1000),
      responseStatus: "needsAction",
      body: "30-min walkthrough of our SOC2 monitoring suite.",
    },
    {
      eventId: `mscal-${tag}-3`,
      summary: "Team all-hands — Friday celebration",
      organizer: { name: "People Ops", email: "people@yourco.example" },
      attendees: ["operator", "everyone"],
      start: isoIn(4 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000),
      end: isoIn(4 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000),
      responseStatus: "needsAction",
    },
  ];
}

const STUB_RECS: Record<string, CalendarRecommendation> = {
  "1": {
    suggested: "accept",
    proposed_times: null,
    draft_message: null,
    confidence: 0.9,
    reasoning: "Recurring QBR, partner attending, inside working hours.",
  },
  "2": {
    suggested: "decline",
    proposed_times: null,
    draft_message: "Not the right time for us to evaluate this — circling back when we're scoping SOC2 work.",
    confidence: 0.81,
    reasoning: "Vendor cold demo, no internal champion, not in current priorities.",
  },
  "3": {
    suggested: "accept",
    proposed_times: null,
    draft_message: null,
    confidence: 0.95,
    reasoning: "Internal all-hands, inside working hours.",
  },
};

export const microsoftCalendarProvider: CalendarProvider = {
  id: "microsoft_calendar",
  label: "Microsoft Calendar",
  async fetchPendingInvites(avatarId, opts) {
    if (opts.dryRun) return fixtures(avatarId);
    return [];
  },
  recommendStub(event) {
    const last = event.eventId.slice(-1);
    return STUB_RECS[last] ?? STUB_RECS["1"];
  },
};
