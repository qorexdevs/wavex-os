/** Integration smoke tests for /api/partner-signals/* (WAVAAAA-72, WAVAAAA-104).
 *
 *  Tests verify:
 *   - POST /api/partner-signals/emit returns {ok:true, event_type, fired_at}
 *   - persisted=true when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (live)
 *   - persisted=false gracefully when Supabase is not configured
 *   - 422 rejection when app_count < 2
 *   - GET /api/partner-signals/:partnerId returns emitted events when Supabase is live
 *
 *  Uses Fastify inject — no real HTTP port needed.
 *  WAVEX_AUTH_MODE=dev bypasses assertBoard. */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { registerPartnerEventsRoutes } from "../src/routes/partner-events.js";

const LIVE_SUPABASE = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const BASE_BODY = {
  companyId: "c293df60-5f75-48a3-8fdc-201464473094",
  partner_id: `smoke-test-wavaaaa-104-${Date.now()}`,
  partner_name: "WaveX Smoke Test Partner",
  app_count: 3,
  context_json: { smoke_run: true, issue: "WAVAAAA-104" },
};

let app: ReturnType<typeof Fastify>;
let tempDir: string;

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "partner-events-test-"));
  process.env.WAVEX_OS_STATE_DIR = tempDir;
  process.env.PAPERCLIP_DATA_DIR = tempDir;
  process.env.WAVEX_AUTH_MODE = "dev";
  process.env.WAVEX_COMPOSIO_DISABLED = "1";

  app = Fastify({ logger: false });
  registerPartnerEventsRoutes(app);
  await app.ready();
});

afterEach(async () => {
  await app.close();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.WAVEX_OS_STATE_DIR;
  delete process.env.PAPERCLIP_DATA_DIR;
  delete process.env.WAVEX_AUTH_MODE;
  delete process.env.WAVEX_COMPOSIO_DISABLED;
});

describe("POST /api/partner-signals/emit", () => {
  it("returns ok:true and event_type when app_count >= 2 (no Supabase → persisted=false)", async () => {
    const saved = process.env.SUPABASE_URL;
    delete process.env.SUPABASE_URL;

    const r = await app.inject({
      method: "POST",
      url: "/api/partner-signals/emit",
      payload: { ...BASE_BODY, partner_id: `no-supabase-${Date.now()}` },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.ok).toBe(true);
    expect(body.event_type).toBe("partner_activation_complete");
    expect(body.fired_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.persisted).toBe(false);
    expect(body.event_id).toBeNull();

    if (saved) process.env.SUPABASE_URL = saved;
  });

  it("rejects with 422 when app_count < 2", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/partner-signals/emit",
      payload: { ...BASE_BODY, app_count: 1 },
    });
    expect(r.statusCode).toBe(422);
    const body = r.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("app_count");
  });

  it("rejects with 400 on missing required fields", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/partner-signals/emit",
      payload: { partner_id: "x" },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().ok).toBe(false);
  });

  it.runIf(LIVE_SUPABASE)(
    "persists to wavex_os.partner_events and returns persisted:true (LIVE)",
    async () => {
      const smokePartnerId = `smoke-live-${Date.now()}`;
      const r = await app.inject({
        method: "POST",
        url: "/api/partner-signals/emit",
        payload: { ...BASE_BODY, partner_id: smokePartnerId },
      });
      expect(r.statusCode).toBe(200);
      const body = r.json();
      expect(body.ok).toBe(true);
      expect(body.event_type).toBe("partner_activation_complete");
      expect(body.persisted).toBe(true);
      expect(body.event_id).toBeTruthy();
    },
  );
});

describe("GET /api/partner-signals/:partnerId", () => {
  it.runIf(LIVE_SUPABASE)(
    "returns the emitted event row from the DB (LIVE)",
    async () => {
      const smokePartnerId = `smoke-get-${Date.now()}`;

      // Emit first
      await app.inject({
        method: "POST",
        url: "/api/partner-signals/emit",
        payload: { ...BASE_BODY, partner_id: smokePartnerId },
      });

      // Read back
      const r = await app.inject({
        method: "GET",
        url: `/api/partner-signals/${smokePartnerId}`,
      });
      expect(r.statusCode).toBe(200);
      const body = r.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.events)).toBe(true);
      expect(body.events.length).toBeGreaterThanOrEqual(1);
      const row = body.events[0];
      expect(row.partner_id).toBe(smokePartnerId);
      expect(row.event_type).toBe("partner_activation_complete");
    },
  );

  it.runIf(!LIVE_SUPABASE)(
    "returns 503 when Supabase not configured",
    async () => {
      const r = await app.inject({
        method: "GET",
        url: "/api/partner-signals/any-id",
      });
      expect(r.statusCode).toBe(503);
    },
  );
});
