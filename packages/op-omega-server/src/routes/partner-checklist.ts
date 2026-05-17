/** Design-partner onboarding checklist state.
 *
 *  GET /api/partner-checklist/:companyId
 *    Returns the current check state for the 3-step onboarding progress.
 *
 *  PATCH /api/partner-checklist/:companyId
 *    Body: { smoke_test?: { result: "pass"|"fail" }, ci_webhook?: { connected: boolean }, app_count?: number }
 *    Called by agents when the corresponding events fire (e.g. first smoke
 *    test passes, CI webhook is configured, a second app is connected).
 *
 *  State is persisted at:
 *    ~/.wavex-os/instances/default/companies/<id>/partner-checklist.json
 *
 *  For smoke_test, the endpoint also infers "pass" from an activated company
 *  manifest (state=activated) when the checklist file has no explicit entry,
 *  so pre-existing activated companies get step 1 pre-checked automatically.
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { getOnboardingDir } from "../state-bridge.js";

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

function checklistPath(companyId: string): string {
  // Stored one level above the onboarding dir (i.e. companies/<id>/)
  return join(getOnboardingDir(companyId), "..", "partner-checklist.json");
}

interface ChecklistFile {
  smoke_test?: { result?: string };
  ci_webhook?: { connected?: boolean };
  app_count?: number;
}

async function readChecklist(companyId: string): Promise<ChecklistFile> {
  try {
    const raw = await fs.readFile(checklistPath(companyId), "utf8");
    return JSON.parse(raw) as ChecklistFile;
  } catch {
    return {};
  }
}

async function writeChecklist(companyId: string, data: ChecklistFile): Promise<void> {
  const path = checklistPath(companyId);
  await fs.mkdir(join(path, ".."), { recursive: true });
  await fs.writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

/** Fall back to the company manifest to infer smoke_test_passed when the
 *  checklist file has no explicit smoke_test entry.  An activated company
 *  (manifest.state = "activated" | "ignited") is treated as having passed
 *  the first smoke test. */
async function inferSmokePassed(companyId: string): Promise<boolean> {
  try {
    const manifestPath = join(getOnboardingDir(companyId), "company.manifest.json");
    const raw = await fs.readFile(manifestPath, "utf8");
    const m = JSON.parse(raw) as { state?: string };
    return m.state === "activated" || m.state === "ignited" || m.state === "live";
  } catch {
    return false;
  }
}

export function registerPartnerChecklistRoutes(app: FastifyInstance): void {
  app.get(
    "/api/partner-checklist/:companyId",
    async (req: FastifyRequest<{ Params: { companyId: string } }>, reply: FastifyReply) => {
      const ar = authReq(req);
      try { assertBoard(ar); } catch (e) {
        if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
        throw e;
      }
      const { companyId } = req.params;
      assertCompanyAccess(ar, companyId);

      const file = await readChecklist(companyId);

      const smoke_test_passed =
        file.smoke_test?.result === "pass" ||
        (file.smoke_test === undefined && (await inferSmokePassed(companyId)));

      const ci_webhook_connected = Boolean(file.ci_webhook?.connected);
      const app_count = typeof file.app_count === "number" ? file.app_count : 0;

      const all_complete = smoke_test_passed && ci_webhook_connected && app_count >= 2;

      return {
        ok: true,
        companyId,
        steps: { smoke_test_passed, ci_webhook_connected, app_count },
        all_complete,
      };
    },
  );

  app.patch(
    "/api/partner-checklist/:companyId",
    async (req: FastifyRequest<{ Params: { companyId: string } }>, reply: FastifyReply) => {
      const ar = authReq(req);
      try { assertBoard(ar); } catch (e) {
        if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
        throw e;
      }
      const { companyId } = req.params;
      assertCompanyAccess(ar, companyId);

      const body = req.body as Partial<ChecklistFile>;
      const current = await readChecklist(companyId);

      const updated: ChecklistFile = {
        ...current,
        ...(body.smoke_test !== undefined ? { smoke_test: { ...current.smoke_test, ...body.smoke_test } } : {}),
        ...(body.ci_webhook !== undefined ? { ci_webhook: { ...current.ci_webhook, ...body.ci_webhook } } : {}),
        ...(body.app_count !== undefined ? { app_count: body.app_count } : {}),
      };

      await writeChecklist(companyId, updated);

      return { ok: true, updated };
    },
  );
}
