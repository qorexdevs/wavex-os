/** Connectors OAuth + health-check routes (post-PR#4 live wiring).
 *
 *  Two surfaces:
 *
 *    POST /op-omega/onboarding/connectors/oauth/initiate
 *      Body: { companyId, userId?, toolkitSlug, callbackUrl? }
 *      → Returns { url, pendingConnectionId, needsLiveWiring? }
 *      UI opens `url` in a popup; the user completes OAuth on Composio's
 *      hosted page; Composio redirects to callbackUrl on success.
 *
 *    GET /op-omega/onboarding/connectors/oauth/callback
 *      Query: ?pending_connection_id=...&company_id=...&toolkit_slug=...
 *      Composio (or the UI's popup callback) hits this after OAuth
 *      completes. Finalizes the tools.json entry from "pending" → "connected".
 *
 *    POST /op-omega/onboarding/connectors/health-check
 *      Body: { companyId, avatarId? }
 *      → Returns { results: [{ toolkit, ok, error? }] }
 *      Pings each connection via Composio. Called by the
 *      connector-health-check agent on heartbeat AND by the wizard at
 *      end of onboarding to validate every connector works.
 *
 *  All routes are no-ops in disabled mode (composio-shim returns
 *  needsLiveWiring=true and the UI falls back to manual key entry).
 */
import type { FastifyInstance } from "fastify";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  initOAuth,
  getConnectionStatus,
  pingConnection,
  listConnections,
} from "@wavex-os/composio-shim";

interface AvatarToolEntry {
  provider: string;
  ref: string;
  status: "stub" | "pending" | "connected" | "failed";
  connected_at: string;
  pending_connection_id?: string;
  last_health_check?: string;
  last_error?: string;
}
interface AvatarToolsFile {
  connected: AvatarToolEntry[];
  skipped: boolean;
  meta?: Record<string, unknown>;
}

function stateRoot(): string {
  return process.env.WAVEX_OS_STATE_DIR ?? join(homedir(), ".wavex-os");
}
function avatarDir(avatarId: string): string {
  return join(stateRoot(), "instances", "default", "avatars", avatarId);
}

async function readToolsFile(avatarId: string): Promise<AvatarToolsFile | null> {
  const path = join(avatarDir(avatarId), "tools.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8")) as AvatarToolsFile;
  } catch {
    return null;
  }
}
async function writeToolsFile(avatarId: string, file: AvatarToolsFile): Promise<void> {
  const path = join(avatarDir(avatarId), "tools.json");
  await writeFile(path, JSON.stringify(file, null, 2), "utf8");
}

interface InitiateBody {
  companyId: string;
  userId?: string;
  avatarId?: string;
  toolkitSlug: string;
  callbackUrl?: string;
}

interface CallbackQuery {
  pending_connection_id?: string;
  company_id?: string;
  avatar_id?: string;
  toolkit_slug?: string;
}

interface HealthCheckBody {
  companyId: string;
  avatarId?: string;
}

export function registerConnectorRoutes(app: FastifyInstance): void {
  // ── 1. Initiate OAuth ─────────────────────────────────────────────────
  app.post<{ Body: InitiateBody }>(
    "/op-omega/onboarding/connectors/oauth/initiate",
    async (req, reply) => {
      const { companyId, userId, avatarId, toolkitSlug, callbackUrl } = req.body ?? ({} as InitiateBody);
      if (!companyId || !toolkitSlug) {
        return reply.code(400).send({ error: "companyId + toolkitSlug required" });
      }
      const origin = `${req.protocol}://${req.headers.host}`;
      const cbUrl =
        callbackUrl ??
        `${origin}/op-omega/onboarding/connectors/oauth/callback` +
          `?company_id=${encodeURIComponent(companyId)}` +
          (avatarId ? `&avatar_id=${encodeURIComponent(avatarId)}` : "") +
          `&toolkit_slug=${encodeURIComponent(toolkitSlug)}`;
      const result = await initOAuth({
        companyId,
        userId,
        toolkitSlug,
        callbackUrl: cbUrl,
      });

      // Optimistically record pending in tools.json so the UI can poll
      // /op-omega/onboarding/avatar/:id (which already returns tools) to
      // detect when this entry transitions to "connected".
      if (avatarId && result.pendingConnectionId) {
        const cur = (await readToolsFile(avatarId)) ?? { connected: [], skipped: false };
        const without = cur.connected.filter((c) => c.provider !== toolkitSlug);
        cur.connected = [
          ...without,
          {
            provider: toolkitSlug,
            ref: result.pendingConnectionId,
            status: "pending",
            connected_at: new Date().toISOString(),
            pending_connection_id: result.pendingConnectionId,
          },
        ];
        await writeToolsFile(avatarId, cur);
      }

      return reply.send(result);
    },
  );

  // ── 2. OAuth callback (Composio hits this) ────────────────────────────
  app.get<{ Querystring: CallbackQuery }>(
    "/op-omega/onboarding/connectors/oauth/callback",
    async (req, reply) => {
      const { pending_connection_id, avatar_id, toolkit_slug } = req.query;
      if (!pending_connection_id || !toolkit_slug) {
        return reply
          .type("text/html")
          .send(htmlClose("Missing connection id or toolkit_slug in callback"));
      }
      const status = await getConnectionStatus(pending_connection_id);
      if (avatar_id) {
        const cur = (await readToolsFile(avatar_id)) ?? { connected: [], skipped: false };
        const idx = cur.connected.findIndex((c) => c.provider === toolkit_slug);
        const newEntry: AvatarToolEntry = {
          provider: toolkit_slug,
          ref: pending_connection_id,
          status: status.status === "active" ? "connected" : status.status === "pending" ? "pending" : "failed",
          connected_at: new Date().toISOString(),
          pending_connection_id,
          last_health_check: new Date().toISOString(),
          ...(status.error ? { last_error: status.error } : {}),
        };
        if (idx === -1) cur.connected.push(newEntry);
        else cur.connected[idx] = newEntry;
        await writeToolsFile(avatar_id, cur);
      }
      // Return a tiny HTML page that closes itself; the wizard polls
      // /api/avatar/:id to detect the connection completion.
      return reply.type("text/html").send(htmlClose(`Connected ${toolkit_slug}. You can close this window.`));
    },
  );

  // ── 3. Health-check ───────────────────────────────────────────────────
  app.post<{ Body: HealthCheckBody }>(
    "/op-omega/onboarding/connectors/health-check",
    async (req, reply) => {
      const { companyId, avatarId } = req.body ?? ({} as HealthCheckBody);
      if (!companyId) return reply.code(400).send({ error: "companyId required" });

      const tools = avatarId ? await readToolsFile(avatarId) : null;
      const fromAvatar = (tools?.connected ?? []).filter(
        (c) => c.status === "connected" || c.status === "pending",
      );

      // Belt + suspenders: also list Composio-side connections in case the
      // avatar tools.json is stale.
      const composioRows = await listConnections(companyId);

      const set = new Map<string, { ref: string; toolkit: string }>();
      for (const t of fromAvatar) {
        if (t.pending_connection_id || t.ref) {
          set.set(t.pending_connection_id ?? t.ref, { ref: t.pending_connection_id ?? t.ref, toolkit: t.provider });
        }
      }
      for (const c of composioRows) {
        if (c.composioConnectionId) {
          set.set(c.composioConnectionId, { ref: c.composioConnectionId, toolkit: c.toolkitSlug });
        }
      }

      const results: Array<{
        toolkit: string;
        connection_id: string;
        ok: boolean;
        error?: string;
      }> = [];
      for (const { ref, toolkit } of set.values()) {
        const r = await pingConnection({ connectionId: ref, toolkitSlug: toolkit });
        results.push({ toolkit, connection_id: ref, ok: r.ok, ...(r.error ? { error: r.error } : {}) });
      }

      // Update tools.json with latest health-check timestamps + errors.
      if (avatarId && tools) {
        for (const r of results) {
          const idx = tools.connected.findIndex(
            (c) => c.pending_connection_id === r.connection_id || c.ref === r.connection_id,
          );
          if (idx === -1) continue;
          tools.connected[idx] = {
            ...tools.connected[idx],
            last_health_check: new Date().toISOString(),
            status: r.ok ? "connected" : "failed",
            ...(r.error ? { last_error: r.error } : { last_error: undefined }),
          };
        }
        await writeToolsFile(avatarId, tools);
      }

      return reply.send({
        company_id: companyId,
        avatar_id: avatarId ?? null,
        checked_at: new Date().toISOString(),
        results,
        all_healthy: results.length > 0 && results.every((r) => r.ok),
      });
    },
  );
}

function htmlClose(message: string): string {
  return `<!doctype html><meta charset="utf-8"><title>WaveX OAuth</title>
<style>body{font-family:system-ui;padding:48px;text-align:center;}</style>
<p>${message}</p>
<script>setTimeout(() => window.close(), 1500);</script>`;
}
