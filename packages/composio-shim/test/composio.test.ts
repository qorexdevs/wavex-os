import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  composioUserId,
  getComposioMode,
  getFeaturedToolkits,
  initOAuth,
  listConnections,
  validateApiKey,
} from "../src/index.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.WAVEX_COMPOSIO_DISABLED;
  delete process.env.COMPOSIO_API_KEY;
  delete process.env.NODE_ENV;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("@wavex-os/composio-shim mode", () => {
  it("defaults to disabled in dev (NODE_ENV unset)", () => {
    expect(getComposioMode()).toBe("disabled");
  });

  it("defaults to live in production (NODE_ENV=production)", () => {
    process.env.NODE_ENV = "production";
    expect(getComposioMode()).toBe("live");
  });

  it("WAVEX_COMPOSIO_DISABLED=1 forces disabled", () => {
    process.env.NODE_ENV = "production";
    process.env.WAVEX_COMPOSIO_DISABLED = "1";
    expect(getComposioMode()).toBe("disabled");
  });

  it("WAVEX_COMPOSIO_DISABLED=0 forces live", () => {
    process.env.WAVEX_COMPOSIO_DISABLED = "0";
    expect(getComposioMode()).toBe("live");
  });
});

describe("disabled-mode behavior", () => {
  it("listConnections returns []", async () => {
    expect(await listConnections("any")).toEqual([]);
  });

  it("validateApiKey returns disabled marker", async () => {
    const r = await validateApiKey("anything");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("disabled");
  });

  it("initOAuth returns null url", async () => {
    const r = await initOAuth({ companyId: "c", toolkitSlug: "slack", callbackUrl: "http://x" });
    expect(r.url).toBeNull();
    expect(r.pendingConnectionId).toBeNull();
    expect(r.needsLiveWiring).toBe(true);
  });

  it("getFeaturedToolkits is non-empty even in disabled mode", () => {
    expect(getFeaturedToolkits().length).toBeGreaterThan(0);
  });
});

describe("live-mode stub behavior (returns empty + warns)", () => {
  beforeEach(() => {
    process.env.WAVEX_COMPOSIO_DISABLED = "0";
    process.env.COMPOSIO_API_KEY = "ck-test";
  });

  it("listConnections returns [] with a warn breadcrumb", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await listConnections("c1")).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("validateApiKey hits Composio with the supplied key", async () => {
    // Live wiring now: a fake key fails fast with a real 401 from Composio,
    // surfaced as composio_api_rejected. Disabled mode is covered above.
    const r = await validateApiKey("ck-test");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/composio_api_rejected|COMPOSIO_API_KEY/);
  });

  it("validateApiKey returns missing-key error when no key", async () => {
    delete process.env.COMPOSIO_API_KEY;
    const r = await validateApiKey(undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("COMPOSIO_API_KEY missing");
  });
});

describe("composioUserId", () => {
  it("namespaces by company + user", () => {
    expect(composioUserId("acme", "alice")).toBe("wavex/acme/alice");
  });
});
