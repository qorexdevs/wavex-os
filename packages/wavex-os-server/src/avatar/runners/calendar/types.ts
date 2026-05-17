/** Provider-agnostic calendar types. The calendar-triage runner takes
 *  any CalendarProvider impl (Google, Microsoft, future) and triages
 *  incoming invites uniformly. */

export interface CalendarEvent {
  eventId: string;
  summary: string;
  organizer: { name: string; email: string };
  attendees: string[];
  start: string;                // ISO datetime
  end: string;                  // ISO datetime
  responseStatus: "needsAction" | "accepted" | "declined" | "tentative";
  body?: string;                // short description if available
  hasConflict?: boolean;        // populated by the runner, not the provider
}

export interface CalendarRecommendation {
  suggested: "accept" | "decline" | "propose-time";
  proposed_times?: string[] | null;   // ISO datetimes when suggested === "propose-time"
  draft_message: string | null;
  confidence: number;
  reasoning: string;
}

export interface CalendarProvider {
  readonly id: string;
  readonly label: string;
  /** Returns upcoming events (default: next 7 days) that still need a
   *  response. dryRun returns a fixture set spanning the decision tree. */
  fetchPendingInvites(avatarId: string, opts: { dryRun: boolean }): Promise<CalendarEvent[]>;
  /** Deterministic recommendation for dryRun + skipInference. */
  recommendStub(event: CalendarEvent): CalendarRecommendation;
}
