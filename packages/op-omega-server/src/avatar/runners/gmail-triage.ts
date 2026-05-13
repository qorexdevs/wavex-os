/** Phase 2 entry point preserved as a thin compatibility shim. The
 *  implementation moved to the provider-agnostic `mail-triage.ts` in
 *  Phase 6 — this file just delegates so existing routes / smoke
 *  scripts keep working unchanged while we migrate callers. */

import { runMailTriage } from "./mail-triage.js";

export async function runGmailTriage(avatarId: string, opts: { dryRun?: boolean; skipInference?: boolean } = {}) {
  const r = await runMailTriage(avatarId, "gmail", opts);
  // Re-shape to the Phase 2 result type (gmailAgentId field) so existing
  // consumers don't break. New callers should hit /run/mail-triage/:provider.
  return {
    avatarId: r.avatarId,
    paperclipCompanyId: r.paperclipCompanyId,
    gmailAgentId: r.agentId,
    processed: r.processed,
    drafted: r.drafted,
    approvalsCreated: r.approvalsCreated,
    errors: r.errors,
  };
}

export type { AvatarApproval } from "./mail-triage.js";
