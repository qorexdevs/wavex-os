/** Outlook implementation of MailProvider — Microsoft Graph.
 *
 *  Same shape as gmail-provider but with Outlook-flavoured fixtures.
 *  Live fetch via Composio's Microsoft Graph integration lands together
 *  with the Gmail live wiring (slice 3). Until then this returns the
 *  dryRun fixture set so e2e flows + Phase 6 multi-provider smoke
 *  exercise the full pipeline.
 */

import type { MailClassification, MailProvider, MailThread } from "./types.js";

function fixtureThreads(seed: string): MailThread[] {
  const now = new Date();
  const isoLater = (deltaMs: number) => new Date(now.getTime() - deltaMs).toISOString();
  const tag = seed.slice(-6);
  return [
    {
      threadId: `outk-${tag}-1`,
      subject: "FW: Board deck for Tuesday — partner asked for one slide on burn",
      from: { name: "Pat Allen", email: "pat@boardco.example" },
      preview: "Forwarding the board materials. Partner specifically asked you add one slide on burn-rate vs runway for the Tuesday meeting. Can you have it back by EOD Monday?",
      receivedAt: isoLater(45 * 60 * 1000),
    },
    {
      threadId: `outk-${tag}-2`,
      subject: "Re: 1:1 reschedule",
      from: { name: "Jordan Chen", email: "jordan@yourco.example" },
      preview: "Need to push our Thursday 1:1 to Friday — got pulled into a customer call. Same time on Friday OK? If not, send a few windows that work for you.",
      receivedAt: isoLater(3 * 60 * 60 * 1000),
    },
    {
      threadId: `outk-${tag}-3`,
      subject: "Microsoft 365 service notification: planned maintenance",
      from: { name: "Microsoft 365", email: "no-reply@notice.microsoft.example" },
      preview: "Planned maintenance scheduled for your tenant on Saturday 02:00-04:00 UTC. No action required. Service may be intermittently degraded during this window...",
      receivedAt: isoLater(8 * 60 * 60 * 1000),
    },
  ];
}

const STUB_CLASSIFICATIONS: Record<string, MailClassification> = {
  "1": {
    classification: "now",
    draft: "Pat — got it. Adding the burn / runway slide tonight; you'll have it back by EOD Monday. Anything else the partner flagged?",
    confidence: 0.84,
    reasoning: "Board ask with a hard Monday deadline, named partner request.",
  },
  "2": {
    classification: "soon",
    draft: "Friday same time works. Let's keep it.",
    confidence: 0.78,
    reasoning: "Internal 1:1 reschedule, simple confirm.",
  },
  "3": {
    classification: "fyi",
    draft: null,
    confidence: 0.95,
    reasoning: "Service notification, no reply needed.",
  },
};

export const outlookProvider: MailProvider = {
  id: "outlook",
  label: "Outlook",
  async fetchUnseen(avatarId, opts) {
    if (opts.dryRun) return fixtureThreads(avatarId);
    // Real Microsoft Graph fetch lands together with the Gmail live wiring
    // in slice 3. Without keys we return [] so the runner produces 0
    // approvals in live mode rather than throwing.
    return [];
  },
  classifyStub(thread) {
    const last = thread.threadId.slice(-1);
    return STUB_CLASSIFICATIONS[last] ?? STUB_CLASSIFICATIONS["1"];
  },
};
