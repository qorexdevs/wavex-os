/** Smoke test: Fastify boots, wavex-os routes register, status endpoint
 *  returns expected shape with auto-bypass auth in dev mode. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { registerWavexOsRoutes } from "../src/index.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "wavex-os-server-test-"));
  process.env.WAVEX_OS_STATE_DIR = tempDir;
  process.env.PAPERCLIP_DATA_DIR = tempDir;
  process.env.WAVEX_AUTH_MODE = "dev";
  process.env.WAVEX_COMPOSIO_DISABLED = "1";
});

afterEach(() => {
  delete process.env.WAVEX_OS_STATE_DIR;
  delete process.env.PAPERCLIP_DATA_DIR;
  delete process.env.WAVEX_AUTH_MODE;
  delete process.env.WAVEX_COMPOSIO_DISABLED;
  rmSync(tempDir, { recursive: true, force: true });
});

describe("@wavex-os/wavex-os-server", () => {
  it("registers routes against a fresh Fastify instance", async () => {
    const app = Fastify({ logger: false });
    registerWavexOsRoutes(app);
    await app.ready();
    const routes = app.printRoutes();
    expect(routes).toContain("wavex-os");
    await app.close();
  });

  it("status endpoint returns initialized pillar shape with dev-mode auth bypass", async () => {
    const app = Fastify({ logger: false });
    registerWavexOsRoutes(app);
    await app.ready();
    const r = await app.inject({
      method: "GET",
      url: "/wavex-os/onboarding/status?companyId=test-co",
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.ok).toBe(true);
    expect(body.companyId).toBe("test-co");
    expect(body.responses).toBeTruthy();
    expect(body.complete).toBe(false);
    expect(body.next_pillar).toBe(1);
    await app.close();
  });

  it("status endpoint without companyId returns 400", async () => {
    const app = Fastify({ logger: false });
    registerWavexOsRoutes(app);
    await app.ready();
    const r = await app.inject({ method: "GET", url: "/wavex-os/onboarding/status" });
    expect(r.statusCode).toBe(400);
    await app.close();
  });

  it("connector-recommendations returns a manifest even with empty pillars", async () => {
    // loadPillarResponses synthesizes empty pillars on first read; the plugin's
    // decision-matrix runs against whatever responses are present.
    const app = Fastify({ logger: false });
    registerWavexOsRoutes(app);
    await app.ready();
    const r = await app.inject({
      method: "GET",
      url: "/wavex-os/onboarding/connector-recommendations?companyId=fresh-co",
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.ok).toBe(true);
    expect(body.manifest).toBeTruthy();
    await app.close();
  });

  it("loop-status returns idle by default", async () => {
    const app = Fastify({ logger: false });
    registerWavexOsRoutes(app);
    await app.ready();
    const r = await app.inject({ method: "GET", url: "/wavex-os/onboarding/loop-status" });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.ok).toBe(true);
    expect(body.loop.status).toBe("idle");
    await app.close();
  });
});
