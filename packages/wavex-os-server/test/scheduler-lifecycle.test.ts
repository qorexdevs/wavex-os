import { afterEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

const { stopBookingCleanup, stopReengagement, stopReferral } = vi.hoisted(() => ({
  stopBookingCleanup: vi.fn(),
  stopReengagement: vi.fn(),
  stopReferral: vi.fn(),
}));

vi.mock("../src/jobs/professional-reengagement.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/jobs/professional-reengagement.js")>()),
  stopProfessionalReengagementScheduler: stopReengagement,
}));

vi.mock("../src/jobs/referral-email-b.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/jobs/referral-email-b.js")>()),
  stopReferralEmailBScheduler: stopReferral,
}));

vi.mock("../src/jobs/booking-intent-cleanup.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/jobs/booking-intent-cleanup.js")>()),
  stopBookingIntentCleanupScheduler: stopBookingCleanup,
}));

import { registerWavexOsRoutes } from "../src/index.js";

afterEach(() => {
  vi.clearAllMocks();
});

describe("registerWavexOsRoutes", () => {
  it("stops startup schedulers when the server closes", async () => {
    const app = Fastify({ logger: false });
    registerWavexOsRoutes(app);

    await app.close();

    expect(stopBookingCleanup).toHaveBeenCalledOnce();
    expect(stopReengagement).toHaveBeenCalledOnce();
    expect(stopReferral).toHaveBeenCalledOnce();
  });
});
