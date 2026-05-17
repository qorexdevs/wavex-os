/** Auth gate functions matching wavex-os's authz contract. In dev mode, the
 *  request's actor is auto-populated with a synthetic local-implicit board
 *  before any assertion runs, so all gates pass for the local operator. In
 *  production mode, the actor must already be populated by the auth
 *  middleware (Better-Auth integration); these functions only enforce. */

import { forbidden, unauthorized, type AuthRequest, type Actor } from "./types.js";
import { getAuthMode } from "./mode.js";
import { getDevActor } from "./dev-actor.js";

function ensureActor(req: AuthRequest): Actor {
  if (req.actor) return req.actor;
  if (getAuthMode() === "dev") {
    req.actor = getDevActor();
    return req.actor;
  }
  throw unauthorized("Authentication required");
}

export function assertAuthenticated(req: AuthRequest): void {
  ensureActor(req);
}

export function assertBoard(req: AuthRequest): void {
  const actor = ensureActor(req);
  if (actor.type !== "board") {
    throw forbidden("Board access required");
  }
}

export function hasBoardOrgAccess(req: AuthRequest): boolean {
  const actor = ensureActor(req);
  if (actor.type !== "board") return false;
  if (actor.source === "local_implicit" || actor.isInstanceAdmin) return true;
  return Array.isArray(actor.companyIds) && actor.companyIds.length > 0;
}

export function assertBoardOrgAccess(req: AuthRequest): void {
  assertBoard(req);
  if (hasBoardOrgAccess(req)) return;
  throw forbidden("Company membership or instance admin access required");
}

export function assertInstanceAdmin(req: AuthRequest): void {
  assertBoard(req);
  const actor = req.actor as Extract<Actor, { type: "board" }>;
  if (actor.source === "local_implicit" || actor.isInstanceAdmin) return;
  throw forbidden("Instance admin access required");
}

export function assertCompanyAccess(req: AuthRequest, companyId: string): void {
  const actor = ensureActor(req);
  if (actor.type === "agent") {
    if (actor.companyId !== companyId) {
      throw forbidden("Agent key cannot access another company");
    }
    return;
  }
  if (actor.source === "local_implicit") return;
  if (actor.isInstanceAdmin) return;
  const allowed = actor.companyIds ?? [];
  if (!allowed.includes(companyId)) {
    throw forbidden("User does not have access to this company");
  }
  const method = (req.method ?? "GET").toUpperCase();
  const isSafe = ["GET", "HEAD", "OPTIONS"].includes(method);
  if (!isSafe && Array.isArray(actor.memberships)) {
    const m = actor.memberships.find((it) => it.companyId === companyId);
    if (!m || m.status !== "active") {
      throw forbidden("Active membership required for write operations");
    }
  }
}
