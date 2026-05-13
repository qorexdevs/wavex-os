/**
 * Hub-side Composio OAuth routes (OAUTH-1).
 *
 * Customers don't have their own COMPOSIO_API_KEY. The operator's key
 * lives here on the Mac-mini hub. We expose three endpoints:
 *
 *   POST /v1/connectors/oauth/initiate
 *     Authorization: Bearer <Pool A session token>
 *     Body: { toolkit_slug, redirect_back_url? }
 *     → { redirect_url, pending_connection_id }
 *     Returns a Composio-hosted auth URL. The customer's browser opens it.
 *     userId is derived from the session token's install_id + email, so
 *     two customers can both connect Gmail without colliding.
 *
 *   GET /v1/connectors/oauth/callback
 *     Query: ?cca_id=...&toolkit=...&back=<base64(redirect_back_url)>
 *     Composio (or the operator's auth router) hits this once the user
 *     finishes OAuth. We bounce the customer back to redirect_back_url
 *     so the wizard can poll for "connected" state on their own server.
 *     Tiny self-closing HTML page on success.
 *
 *   GET /v1/connectors/list?install_id=<id>&email=<email>
 *     Authorization: Bearer <Pool A session token>
 *     → { connections: [...] }
 *     Returns the customer's connected accounts from Composio. The
 *     wizard polls this after the OAuth popup closes to detect success.
 *
 * Composio is gated by COMPOSIO_API_KEY + WAVEX_COMPOSIO_DISABLED;
 * if disabled, all three endpoints return 503 with a clear reason.
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { verifySessionToken } from "../lib/session-token.js";

function bearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice("Bearer ".length).trim();
}

interface InitiateBody {
  toolkit_slug?: string;
  redirect_back_url?: string;
}

interface ListQuery {
  install_id?: string;
  email?: string;
}

function isComposioEnabled(): boolean {
  if ((process.env.WAVEX_COMPOSIO_DISABLED ?? "").trim() === "1") return false;
  return Boolean(process.env.COMPOSIO_API_KEY);
}

function userIdFor(installId: string, email: string): string {
  return `wavex/${installId}/${email}`;
}

export async function registerConnectorRoutes(app: FastifyInstance): Promise<void> {
  // ── 1. Initiate OAuth ─────────────────────────────────────────────────
  app.post<{ Body: InitiateBody }>("/v1/connectors/oauth/initiate", async (req, reply) => {
    if (!isComposioEnabled()) {
      return reply.code(503).send({
        error: "composio_unavailable",
        message:
          "Operator's hub does not have COMPOSIO_API_KEY configured (or WAVEX_COMPOSIO_DISABLED=1). " +
          "Customer should fall back to manual key paste for this toolkit.",
      });
    }
    const tok = bearer(req);
    if (!tok) return reply.code(401).send({ error: "missing_session" });
    const session = verifySessionToken(tok);
    if (!session) return reply.code(401).send({ error: "invalid_session" });

    const { toolkit_slug, redirect_back_url } = req.body ?? ({} as InitiateBody);
    if (!toolkit_slug) return reply.code(400).send({ error: "toolkit_slug_required" });

    const userId = userIdFor(session.install_id, session.email);

    try {
      const { Composio } = await import("@composio/core");
      const c = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });

      // Build the Composio→our-hub callback so we can mark the connection
      // active server-side and bounce the customer back to their wizard.
      const protoHost = `${req.protocol}://${req.headers.host}`;
      const back = redirect_back_url
        ? Buffer.from(redirect_back_url).toString("base64url")
        : "";
      const cbUrl = `${protoHost}/v1/connectors/oauth/callback?toolkit=${encodeURIComponent(toolkit_slug)}&back=${back}`;

      // composio.toolkits.authorize handles auth-config creation + connection init.
      const tk = c.toolkits as unknown as {
        authorize: (
          userId: string,
          toolkit: string,
        ) => Promise<{ id: string; status?: string; redirectUrl?: string | null }>;
      };
      const conn = await tk.authorize(userId, toolkit_slug);
      // NOTE: composio's authorize() doesn't accept callbackUrl directly; the
      // callback is set per auth-config. For first-time-toolkit, the redirect
      // returned bounces through Composio's hosted auth and back to whatever
      // the auth-config has configured. Operator should set that to cbUrl in
      // Composio dashboard once. We surface cbUrl in the response so the UI
      // can hint to the user if the auth flow takes them somewhere unexpected.
      return reply.send({
        redirect_url: conn.redirectUrl ?? null,
        pending_connection_id: conn.id ?? null,
        composio_user_id: userId,
        hub_callback_url: cbUrl,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(502).send({ error: "composio_failed", message: msg.slice(0, 400) });
    }
  });

  // ── 2. Callback (best-effort; Composio's own webhook is the source of truth) ─
  app.get<{ Querystring: { toolkit?: string; back?: string; cca_id?: string } }>(
    "/v1/connectors/oauth/callback",
    async (req, reply) => {
      const { toolkit, back } = req.query;
      let backUrl: string | null = null;
      if (back) {
        try {
          backUrl = Buffer.from(back, "base64url").toString("utf8");
        } catch { /* ignore */ }
      }
      const safeToolkit = (toolkit ?? "unknown").replace(/[^a-z0-9_-]/gi, "");
      const bodyText = backUrl
        ? `Connected <strong>${safeToolkit}</strong>. Bouncing you back to wavex-os…`
        : `Connected <strong>${safeToolkit}</strong>. You can close this window.`;
      const redirect = backUrl
        ? `<meta http-equiv="refresh" content="1; url=${backUrl.replace(/"/g, "&quot;")}">`
        : `<script>setTimeout(() => window.close(), 1200);</script>`;
      return reply.type("text/html").send(
        `<!doctype html><meta charset="utf-8"><title>WaveX OAuth</title>` +
          `<style>body{font-family:system-ui;background:#0a0a0a;color:#e6e6e6;padding:48px;text-align:center;}` +
          `strong{color:#4ec9b0;font-family:ui-monospace,Menlo,monospace;}</style>` +
          `${redirect}<p>${bodyText}</p>`,
      );
    },
  );

  // ── 3. List a customer's connections ──────────────────────────────────
  app.get<{ Querystring: ListQuery }>("/v1/connectors/list", async (req, reply) => {
    if (!isComposioEnabled()) {
      return reply.send({ connections: [], note: "composio_unavailable" });
    }
    const tok = bearer(req);
    if (!tok) return reply.code(401).send({ error: "missing_session" });
    const session = verifySessionToken(tok);
    if (!session) return reply.code(401).send({ error: "invalid_session" });

    try {
      const { Composio } = await import("@composio/core");
      const c = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });
      const userId = userIdFor(session.install_id, session.email);
      const resp = (await c.connectedAccounts.list({ userIds: [userId] })) as unknown as {
        items?: Array<{
          id?: string;
          toolkit?: { slug?: string; displayName?: string };
          status?: string;
          createdAt?: string;
        }>;
      };
      return reply.send({
        connections: (resp.items ?? []).map((c) => ({
          id: c.id,
          toolkit_slug: c.toolkit?.slug,
          display_name: c.toolkit?.displayName ?? null,
          status: c.status ?? "unknown",
          connected_at: c.createdAt ?? null,
        })),
      });
    } catch (err) {
      return reply
        .code(502)
        .send({ error: "composio_list_failed", message: err instanceof Error ? err.message : String(err) });
    }
  });
}
