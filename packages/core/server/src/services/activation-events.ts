import { eq, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  productActivationEvents,
  type UserSignedUpPayload,
  type RepoConnectedPayload,
  type TestRunStartedPayload,
  type TestRunCompletedPayload,
  type UserActivatedPayload,
} from "@paperclipai/db";

export function activationEventsService(db: Db) {
  async function emit(
    companyId: string,
    userId: string,
    eventType: (typeof productActivationEvents)["eventType"]["_"]["data"],
    payload: Record<string, unknown>,
    occurredAt?: Date,
  ) {
    await db.insert(productActivationEvents).values({
      companyId,
      userId,
      eventType,
      payload: payload as never,
      occurredAt: occurredAt ?? new Date(),
    });
  }

  return {
    async userSignedUp(
      companyId: string,
      userId: string,
      dims: UserSignedUpPayload & { createdAt?: Date },
    ) {
      await emit(companyId, userId, "user_signed_up", { source: dims.source }, dims.createdAt);
    },

    async repoConnected(
      companyId: string,
      userId: string,
      dims: RepoConnectedPayload,
    ) {
      await emit(companyId, userId, "repo_connected", {
        repo: dims.repo,
        connector_version: dims.connector_version,
      });
    },

    async testRunStarted(
      companyId: string,
      userId: string,
      dims: TestRunStartedPayload,
      occurredAt?: Date,
    ) {
      await emit(companyId, userId, "test_run_started", {
        run_id: dims.run_id,
        repo: dims.repo,
        platform: dims.platform,
      }, occurredAt);
    },

    async testRunCompleted(
      companyId: string,
      userId: string,
      dims: TestRunCompletedPayload & { completedAt?: Date; userCreatedAt?: Date },
    ) {
      await emit(companyId, userId, "test_run_completed", {
        run_id: dims.run_id,
        status: dims.status,
        duration_s: dims.duration_s,
        ...(dims.platform ? { platform: dims.platform } : {}),
      }, dims.completedAt);

      if (dims.status === "success" && dims.userCreatedAt) {
        await maybeEmitUserActivated(companyId, userId, {
          runId: dims.run_id,
          completedAt: dims.completedAt ?? new Date(),
          userCreatedAt: dims.userCreatedAt,
        });
      }
    },
  };

  async function maybeEmitUserActivated(
    companyId: string,
    userId: string,
    ctx: { runId: string; completedAt: Date; userCreatedAt: Date },
  ) {
    const hoursSinceSignup =
      (ctx.completedAt.getTime() - ctx.userCreatedAt.getTime()) / 3_600_000;

    if (hoursSinceSignup > 48) return;

    // Guard: only emit once per user (the DB unique index enforces this too).
    const existing = await db
      .select({ id: productActivationEvents.id })
      .from(productActivationEvents)
      .where(
        and(
          eq(productActivationEvents.companyId, companyId),
          eq(productActivationEvents.userId, userId),
          eq(productActivationEvents.eventType, "user_activated"),
        ),
      )
      .limit(1);

    if (existing.length > 0) return;

    const payload: UserActivatedPayload = {
      hours_since_signup: Math.round(hoursSinceSignup * 10) / 10,
      trigger_run_id: ctx.runId,
    };

    await db.insert(productActivationEvents).values({
      companyId,
      userId,
      eventType: "user_activated",
      payload,
      occurredAt: ctx.completedAt,
    });
  }
}
