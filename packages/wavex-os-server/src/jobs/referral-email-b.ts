/** Referral Email B — T+24h nudge cron job (WAVAAAA-106)
 *
 *  Runs hourly. Finds users who:
 *    - dismissed the referral modal ≥24h ago
 *    - have never received Email B
 *  Sends Email B (provider call stubbed — blocked on WAVAAAA-105 for template
 *  copy), then marks referral_email_b_sent_at to prevent re-sends.
 *
 *  The `sendReferralEmailB` stub logs but does NOT mark the row as sent,
 *  so all eligible users will be retried each hour until the real provider
 *  call is wired. Replace the stub body once WAVAAAA-105 is merged. */

import { and, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { getDb, runMigrations, users } from "@wavex-os/db";

// ─── email stub ────────────────────────────────────────────────────────────

interface EligibleUser {
  id: string;
  email: string | null;
  referralCode: string | null;
}

/**
 * Sends Email B to a single user.
 * BLOCKED on WAVAAAA-105 — replace this stub once the template copy and
 * provider integration land.
 */
async function sendReferralEmailB(user: EligibleUser): Promise<{ sent: boolean }> {
  // TODO(WAVAAAA-105): wire transactional email provider with Email B template
  console.warn(
    `[referral-email-b] stub — would send Email B to user=${user.id} email=${user.email ?? "(unknown)"}; ` +
    `blocked on WAVAAAA-105 for template copy`
  );
  return { sent: false };
}

// ─── migrations guard ──────────────────────────────────────────────────────

let migrationsRun = false;
async function ensureMigrations(): Promise<void> {
  if (migrationsRun) return;
  await runMigrations();
  migrationsRun = true;
}

// ─── job ───────────────────────────────────────────────────────────────────

const BATCH_LIMIT = 100;
const WINDOW_HOURS = 24;

export async function runReferralEmailBJob(): Promise<{
  checked: number;
  sent: number;
  skipped: number;
}> {
  await ensureMigrations();
  const db = await getDb();

  const cutoff = new Date(Date.now() - WINDOW_HOURS * 3_600_000);

  const eligible = await db
    .select({
      id: users.id,
      email: users.email,
      referralCode: users.referralCode,
    })
    .from(users)
    .where(
      and(
        isNotNull(users.referralModalDismissedAt),
        isNull(users.referralEmailBSentAt),
        lt(users.referralModalDismissedAt, cutoff),
      )
    )
    .limit(BATCH_LIMIT);

  let sent = 0;
  let skipped = 0;

  for (const user of eligible) {
    try {
      const result = await sendReferralEmailB(user);
      if (result.sent) {
        await db
          .update(users)
          .set({ referralEmailBSentAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, user.id));
        sent++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[referral-email-b] error sending to user=${user.id}:`, err);
      skipped++;
    }
  }

  console.log(
    `[referral-email-b] checked=${eligible.length} sent=${sent} skipped=${skipped}`
  );
  return { checked: eligible.length, sent, skipped };
}

// ─── scheduler ─────────────────────────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000;
let schedulerHandle: ReturnType<typeof setInterval> | null = null;

export function startReferralEmailBScheduler(): void {
  if (schedulerHandle) return;

  // Run once at startup (catches any backlog from the last hour window)
  void runReferralEmailBJob().catch((err) =>
    console.error("[referral-email-b] initial run failed:", err)
  );

  schedulerHandle = setInterval(() => {
    void runReferralEmailBJob().catch((err) =>
      console.error("[referral-email-b] scheduled run failed:", err)
    );
  }, HOUR_MS);

  // Don't hold the process open just for this timer
  schedulerHandle.unref?.();

  console.log("[referral-email-b] hourly scheduler started");
}

export function stopReferralEmailBScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}
