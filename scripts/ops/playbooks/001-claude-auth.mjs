/**
 * Playbook #1 — Claude auth poison (CLAUDE_CONFIG_DIR).
 *
 * Born from the 2026-05-14 live-demo outage where every incepted Paperclip
 * agent reported "Not logged in". Root cause + the permanent fix:
 * docs/PAPERCLIP_AUTH_FIX.md.
 *
 * Signature: agent runs failing within ~1s with a "Not logged in" /
 * "Please run /login" error in the fleet's recent_errors.
 */

const SIGNATURES = [
  "not logged in",
  "please run /login",
  "please run `/login`",
  "invalid api key",
  "/login",
];

/** @param {any} healthRow a row from wavex_os_ops_fleet_health() */
function match(healthRow) {
  const errs = Array.isArray(healthRow?.recent_errors) ? healthRow.recent_errors : [];
  return errs.some((e) => {
    const hay = `${e?.signature ?? ""} ${e?.sample ?? ""}`.toLowerCase();
    return SIGNATURES.some((s) => hay.includes(s));
  });
}

export default {
  id: "001-claude-auth",
  name: "Claude auth poison (CLAUDE_CONFIG_DIR)",
  origin: "2026-05-14 live-demo outage",
  match,
  remediation: {
    summary:
      "Agent runs are failing auth — claude can't reach the macOS keychain. " +
      "Almost always CLAUDE_CONFIG_DIR poisoning: an explicitly-set config dir " +
      "makes claude v2.1.x read <dir>/.credentials.json and skip the keychain.",
    // Phase 2 ships detection + escalation. The signed `wavex:remediation`
    // injection channel (Phase 8) flips auto_remediable -> true and lets the
    // watchdog push this fix to the customer's Liaison without a human.
    auto_remediable: false,
    channel: "escalate",
    steps: [
      "Re-point every affected agent's adapterConfig.command at " +
        "scripts/ops/claude-keychain-wrapper.sh (PATCH /api/agents/:id).",
      "Strip CLAUDE_CONFIG_DIR from each agent's adapterConfig.env — keep only " +
        "HOME / USER / LOGNAME.",
      "Fleets incepted after commit 68c793d7 are already fixed at the source " +
        "(paperclip-handoff.ts + paperclip-liaison-spawn.ts). This playbook is " +
        "for agents hired before that commit.",
      "If `claude` itself is logged out (not just the config-dir poison), only " +
        "a human can re-auth: run `claude` then `/login` on that box.",
    ],
    docs: "docs/PAPERCLIP_AUTH_FIX.md",
  },
};
