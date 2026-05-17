/** Google Calendar implementation of CalendarProvider. */

import type { CalendarEvent, CalendarProvider, CalendarRecommendation } from "./types.js";

function fixtures(seed: string): CalendarEvent[] {
  const now = new Date();
  const isoIn = (deltaMs: number) => new Date(now.getTime() + deltaMs).toISOString();
  const tag = seed.slice(-6);
  return [
    {
      eventId: `gcal-${tag}-1`,
      summary: "Board prep sync — Series A close",
      organizer: { name: "Sarah Lin", email: "sarah@accelpartners.example" },
      attendees: ["operator", "cfo@yourco.example"],
      start: isoIn(24 * 60 * 60 * 1000),
      end: isoIn(24 * 60 * 60 * 1000 + 45 * 60 * 1000),
      responseStatus: "needsAction",
      body: "Quick board prep ahead of Tuesday — please bring the cap table.",
    },
    {
      eventId: `gcal-${tag}-2`,
      summary: "Coffee — catch-up (no agenda)",
      organizer: { name: "Alex Park", email: "alex@friendlyco.example" },
      attendees: ["operator"],
      start: isoIn(3 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000), // 3d from now, 7pm — outside hours
      end: isoIn(3 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000 + 30 * 60 * 1000),
      responseStatus: "needsAction",
    },
    {
      eventId: `gcal-${tag}-3`,
      summary: "Pricing strategy brainstorm",
      organizer: { name: "Jordan Chen", email: "jordan@yourco.example" },
      attendees: ["operator", "marketing@yourco.example"],
      start: isoIn(2 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
      end: isoIn(2 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
      responseStatus: "needsAction",
      body: "Need 1hr to lock pricing tiers before our investor update.",
    },
  ];
}

const STUB_RECS: Record<string, CalendarRecommendation> = {
  "1": {
    suggested: "accept",
    proposed_times: null,
    draft_message: null,
    confidence: 0.88,
    reasoning: "VIP organizer (board partner), inside working hours, no conflict.",
  },
  "2": {
    suggested: "propose-time",
    proposed_times: null,                  // runner can fill from working_hours
    draft_message: "Happy to grab coffee — anything during the day work? Evenings I'm usually heads-down.",
    confidence: 0.74,
    reasoning: "Outside working hours; personal-network ping, no urgency.",
  },
  "3": {
    suggested: "accept",
    proposed_times: null,
    draft_message: null,
    confidence: 0.82,
    reasoning: "Internal sync, inside working hours, time-sensitive (investor update).",
  },
};

export const googleCalendarProvider: CalendarProvider = {
  id: "google_calendar",
  label: "Google Calendar",
  async fetchPendingInvites(avatarId, opts) {
    if (opts.dryRun) return fixtures(avatarId);
    return [];
  },
  recommendStub(event) {
    const last = event.eventId.slice(-1);
    return STUB_RECS[last] ?? STUB_RECS["1"];
  },
};
