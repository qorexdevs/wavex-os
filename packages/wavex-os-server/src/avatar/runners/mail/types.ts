/** Provider-agnostic mail types. The mail-triage runner takes any
 *  implementation of MailProvider (Gmail, Outlook, future) and
 *  classifies / drafts uniformly. */

export interface MailThread {
  threadId: string;
  subject: string;
  from: { name: string; email: string };
  preview: string;
  receivedAt: string;
}

export interface MailClassification {
  classification: "now" | "soon" | "fyi";
  draft: string | null;
  confidence: number;
  reasoning: string;
  open_question?: string | null;
}

export interface MailProvider {
  /** Stable id ("gmail", "outlook"). Used in approval type strings,
   *  activity_log actions ("avatar.<id>.draft_created"), and the
   *  per-skill kill map key matching paperclip-handoff.json. */
  readonly id: string;
  /** Display label for UI / docs. */
  readonly label: string;
  /** Returns up to `limit` recent unseen threads, or the dryRun fixture
   *  set when dryRun=true. Returns [] if the provider has no live
   *  connection (e.g., COMPOSIO_API_KEY missing). */
  fetchUnseen(avatarId: string, opts: { dryRun: boolean; limit?: number }): Promise<MailThread[]>;
  /** Deterministic classification for dryRun + skipInference. Lets each
   *  provider ship its own fixture set with known answers so e2e smoke
   *  doesn't depend on T2. */
  classifyStub(thread: MailThread): MailClassification;
}
