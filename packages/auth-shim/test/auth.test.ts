import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AuthError,
  assertAuthenticated,
  assertBoard,
  assertBoardOrgAccess,
  assertCompanyAccess,
  assertInstanceAdmin,
  getAuthMode,
  getDevActor,
} from "../src/index.js";
import type { AuthRequest } from "../src/index.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.WAVEX_AUTH_MODE;
  delete process.env.WAVEX_DEV_USER_ID;
  delete process.env.NODE_ENV;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("@wavex-os/auth-shim mode", () => {
  it("defaults to dev when NODE_ENV is unset", () => {
    expect(getAuthMode()).toBe("dev");
  });

  it("defaults to production when NODE_ENV=production", () => {
    process.env.NODE_ENV = "production";
    expect(getAuthMode()).toBe("production");
  });

  it("explicit WAVEX_AUTH_MODE always wins", () => {
    process.env.NODE_ENV = "production";
    process.env.WAVEX_AUTH_MODE = "dev";
    expect(getAuthMode()).toBe("dev");
  });
});

describe("dev mode bypass", () => {
  it("synthesizes a local-implicit board when actor is missing", () => {
    const req: AuthRequest = {};
    assertAuthenticated(req);
    expect(req.actor?.type).toBe("board");
    expect((req.actor as { source: string }).source).toBe("local_implicit");
  });

  it("WAVEX_DEV_USER_ID overrides synthetic userId", () => {
    process.env.WAVEX_DEV_USER_ID = "alice@local";
    expect(getDevActor().userId).toBe("alice@local");
  });

  it("assertCompanyAccess passes for any company in dev", () => {
    const req: AuthRequest = {};
    assertCompanyAccess(req, "any-company-id");
    assertCompanyAccess(req, "another-co");
  });

  it("assertInstanceAdmin passes for local_implicit", () => {
    const req: AuthRequest = {};
    assertInstanceAdmin(req);
  });
});

describe("production mode enforcement", () => {
  beforeEach(() => {
    process.env.WAVEX_AUTH_MODE = "production";
  });

  it("rejects unauthenticated requests", () => {
    const req: AuthRequest = {};
    expect(() => assertAuthenticated(req)).toThrow(AuthError);
    expect(() => assertAuthenticated(req)).toThrow(/Authentication required/);
  });

  it("assertBoard rejects agent actors", () => {
    const req: AuthRequest = {
      actor: { type: "agent", agentId: "ag_x", companyId: "c1" },
    };
    expect(() => assertBoard(req)).toThrow(/Board access required/);
  });

  it("assertCompanyAccess rejects cross-company agent keys", () => {
    const req: AuthRequest = {
      actor: { type: "agent", agentId: "ag_x", companyId: "c1" },
    };
    expect(() => assertCompanyAccess(req, "c2")).toThrow(/cannot access another company/);
    assertCompanyAccess(req, "c1");
  });

  it("assertCompanyAccess enforces companyIds for non-admin board users", () => {
    const req: AuthRequest = {
      actor: {
        type: "board",
        source: "session",
        userId: "u1",
        isInstanceAdmin: false,
        companyIds: ["c1"],
      },
    };
    assertCompanyAccess(req, "c1");
    expect(() => assertCompanyAccess(req, "c2")).toThrow(/does not have access/);
  });

  it("assertBoardOrgAccess succeeds for board with companyIds", () => {
    const req: AuthRequest = {
      actor: {
        type: "board",
        source: "session",
        userId: "u1",
        isInstanceAdmin: false,
        companyIds: ["c1"],
      },
    };
    assertBoardOrgAccess(req);
  });
});
