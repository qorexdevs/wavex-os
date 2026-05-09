/**
 * Static scheduled-routines registration per OPΩ-SPEC §5.4.
 *
 * Deliberately NOT operator-tunable at Phase 4 — the runtime later owns
 * adjustments via the rate-limit-budget plugin's throttling. These are the
 * target cron specs at t=0.
 */

// @tunable phase4.scheduled_routines
export const SCHEDULED_ROUTINES: Record<string, string> = {
  "flywheel.couple": "0 * * * *", // hourly
  "flywheel.bifurcate": "0 */4 * * *", // every 4h
  "flywheel.criticality": "0 * * * *", // hourly
  "flywheel.reallocate": "0 0 * * 1", // weekly Mon 00:00 local
  "flywheel.monte-carlo": "0 3 * * *", // daily 03:00 local (off-peak)
};
