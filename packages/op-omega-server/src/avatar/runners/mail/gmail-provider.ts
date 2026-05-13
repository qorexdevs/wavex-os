/** Gmail implementation of MailProvider.
 *
 *  - dryRun branch: deterministic 3-thread fixture set spanning the
 *    classifier domain (VIP urgent / personal-net ping / newsletter).
 *  - live branch: real Composio call lands in slice 3 (Real OAuth wiring).
 *    Until then this branch returns [] when COMPOSIO_API_KEY is unset, so
 *    the runner falls through cleanly with no approvals created.
 */

import type { MailClassification, MailProvider, MailThread } from "./types.js";

function fixtureThreads(seed: string): MailThread[] {
  const now = new Date();
  const isoLater = (deltaMs: number) => new Date(now.getTime() - deltaMs).toISOString();
  const tag = seed.slice(-6);
  return [
    {
      threadId: `dry-${tag}-1`,
      subject: "Re: Series A close — need final cap table by Friday",
      from: { name: "Sarah Lin", email: "sarah@accelpartners.example" },
      preview: "Quick one — can you have the final cap table to my associate by EOD Friday? We need it for the closing docs and the lawyers are pushing for...",
      receivedAt: isoLater(30 * 60 * 1000),
    },
    {
      threadId: `dry-${tag}-2`,
      subject: "Coffee next week?",
      from: { name: "Alex Park", email: "alex@friendlyco.example" },
      preview: "Hey — wanted to see if you have time for coffee next week. Open to grabbing 30 min Wed or Thu afternoon if either works. No agenda, just catching up.",
      receivedAt: isoLater(4 * 60 * 60 * 1000),
    },
    {
      threadId: `dry-${tag}-3`,
      subject: "Your weekly Stripe digest",
      from: { name: "Stripe", email: "no-reply@stripe.example" },
      preview: "Here's what happened on your account this week: $12,408 in payments, 2 disputes opened, 1 closed in your favor...",
      receivedAt: isoLater(10 * 60 * 60 * 1000),
    },
  ];
}

const STUB_CLASSIFICATIONS: Record<string, MailClassification> = {
  "1": {
    classification: "now",
    draft: "Sarah — final cap table coming your way EOD Friday. Looping in our CFO to make sure the closing-docs columns are formatted the way the lawyers want. Anything else from us by then?",
    confidence: 0.86,
    reasoning: "VIP investor, hard deadline, action requested.",
  },
  "2": {
    classification: "soon",
    draft: "Yes — Wed afternoon works. Pick a slot on my calendar that's open and I'll grab it.",
    confidence: 0.71,
    reasoning: "Personal-network ping, no deadline, simple ask.",
  },
  "3": {
    classification: "fyi",
    draft: null,
    confidence: 0.94,
    reasoning: "Transactional / no-reply digest.",
  },
};

export const gmailProvider: MailProvider = {
  id: "gmail",
  label: "Gmail",
  async fetchUnseen(avatarId, opts) {
    if (opts.dryRun) return fixtureThreads(avatarId);
    // Real Composio Gmail pull lands in slice 3 (real OAuth wiring).
    // Until then, return [] so the runner produces 0 approvals in live
    // mode rather than throwing.
    return [];
  },
  classifyStub(thread) {
    const last = thread.threadId.slice(-1);
    return STUB_CLASSIFICATIONS[last] ?? STUB_CLASSIFICATIONS["1"];
  },
};
