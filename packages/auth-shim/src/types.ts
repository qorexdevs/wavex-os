/** Actor shape — mirrors op-omega's req.actor contract. wavex-os dev mode
 *  synthesizes a single-user board actor with source=local_implicit. */

export type BoardActor = {
  type: "board";
  source: "local_implicit" | "session" | "api_key";
  userId: string;
  isInstanceAdmin: boolean;
  companyIds?: string[];
  memberships?: Array<{ companyId: string; status: "active" | "invited" | "removed" }>;
};

export type AgentActor = {
  type: "agent";
  agentId: string;
  companyId: string;
};

export type Actor = BoardActor | AgentActor;

export type AuthRequest = {
  actor?: Actor;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

export class AuthError extends Error {
  constructor(message: string, public readonly statusCode: number = 403) {
    super(message);
    this.name = "AuthError";
  }
}

export const forbidden = (msg: string): AuthError => new AuthError(msg, 403);
export const unauthorized = (msg: string): AuthError => new AuthError(msg, 401);
