/**
 * WaveX Ops — remediation playbook library.
 *
 * Each playbook recognises a known failure signature in a fleet's health row
 * and carries a concrete remediation. Phase 2 ships detection + escalation:
 * a matched playbook's `remediation.steps` ride along on the watchdog's
 * Telegram + Paperclip escalation. Phase 8's signed `wavex:remediation`
 * injection channel will let `auto_remediable` playbooks apply without a human.
 *
 * Playbook shape:
 *   {
 *     id, name, origin,
 *     match(healthRow) -> boolean,
 *     remediation: { summary, auto_remediable, channel, steps[], docs }
 *   }
 *
 * To add a playbook: drop NNN-name.mjs in this dir and register it below.
 */

import claudeAuth from "./001-claude-auth.mjs";

export const PLAYBOOKS = [claudeAuth];

/** Every playbook whose match() fires for this fleet-health row. */
export function matchPlaybooks(healthRow) {
  return PLAYBOOKS.filter((p) => {
    try {
      return p.match(healthRow);
    } catch {
      return false;
    }
  });
}
