/**
 * Per-company onboarding session persisted as JSON under
 *   ~/.paperclip/instances/default/companies/{companyId}/onboarding/pillar_responses.json
 *
 * Same directory will later hold connector_manifest.yaml, swarm_manifest.yaml,
 * workflow_manifest.yaml, and the final company.manifest.yaml.
 */

import { mkdir, readFile, writeFile, rename, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { emptyPillarResponses, type PillarResponses } from "../schema/pillar-responses.js";

export interface SessionPaths {
  root: string;
  onboardingDir: string;
  pillarResponsesFile: string;
}

export function sessionPaths(companyId: string, overrideRoot?: string): SessionPaths {
  const root = overrideRoot ?? process.env.PAPERCLIP_DATA_DIR ?? join(homedir(), ".paperclip");
  const onboardingDir = join(root, "instances", "default", "companies", companyId, "onboarding");
  return {
    root,
    onboardingDir,
    pillarResponsesFile: join(onboardingDir, "pillar_responses.json"),
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function loadPillarResponses(companyId: string, overrideRoot?: string): Promise<PillarResponses> {
  const paths = sessionPaths(companyId, overrideRoot);
  if (!(await fileExists(paths.pillarResponsesFile))) {
    return emptyPillarResponses();
  }
  const raw = await readFile(paths.pillarResponsesFile, "utf8");
  try {
    const parsed = JSON.parse(raw) as PillarResponses;
    if (!parsed.schema_version || !parsed.started_at) {
      return emptyPillarResponses();
    }
    return parsed;
  } catch {
    // Corrupt file — start fresh. Caller should back up the file before this path.
    return emptyPillarResponses();
  }
}

export async function savePillarResponses(
  companyId: string,
  responses: PillarResponses,
  overrideRoot?: string,
): Promise<void> {
  const paths = sessionPaths(companyId, overrideRoot);
  await mkdir(paths.onboardingDir, { recursive: true });

  // Atomic write: tmp + rename.
  const tmp = join(paths.onboardingDir, `.pillar_responses.${randomBytes(4).toString("hex")}.tmp`);
  await writeFile(tmp, JSON.stringify(responses, null, 2), { encoding: "utf8", mode: 0o600 });
  await rename(tmp, paths.pillarResponsesFile);
}

/**
 * Per-company mutex for pillar-response writes. updatePillar performs a
 * read-modify-write against pillar_responses.json, so two concurrent calls
 * for the same company (e.g. two browser tabs hammering /pillar/N) can read
 * the same baseline and clobber each other on save.
 *
 * The save itself is atomic (tmp + rename) so the file is never partially
 * written, but without this serialization the *most recent* writer always
 * wins regardless of which value the operator typed last. The mutex keeps
 * concurrent writes within a single process serialized so each one sees the
 * preceding write's result.
 *
 * Cross-process races (multiple Node processes touching the same file) need
 * a file lock or a DB; this is a local_trusted (single-process) fix only.
 */
const pillarWriteLocks = new Map<string, Promise<unknown>>();

/**
 * Replace just one pillar slot + persist. Concurrency-safe against other
 * `updatePillar` calls for the same companyId.
 */
export async function updatePillar<K extends keyof PillarResponses>(
  companyId: string,
  key: K,
  value: PillarResponses[K],
  overrideRoot?: string,
): Promise<PillarResponses> {
  const lockKey = `${companyId}:${overrideRoot ?? ""}`;
  const prior = pillarWriteLocks.get(lockKey) ?? Promise.resolve();
  const next = prior.then(async () => {
    const current = await loadPillarResponses(companyId, overrideRoot);
    const merged = { ...current, [key]: value } as PillarResponses;
    if (merged.pillar_1 && merged.pillar_2 && merged.pillar_3 && merged.pillar_4 && merged.pillar_5 && merged.completed_at === null) {
      merged.completed_at = new Date().toISOString();
    }
    await savePillarResponses(companyId, merged, overrideRoot);
    return merged;
  });
  // Track the new tail. Drop the entry when this op settles so the map
  // doesn't grow unbounded across long-lived processes.
  pillarWriteLocks.set(lockKey, next);
  next.finally(() => {
    if (pillarWriteLocks.get(lockKey) === next) {
      pillarWriteLocks.delete(lockKey);
    }
  });
  return next;
}

export async function ensureOnboardingDir(companyId: string, overrideRoot?: string): Promise<string> {
  const paths = sessionPaths(companyId, overrideRoot);
  await mkdir(paths.onboardingDir, { recursive: true });
  return paths.onboardingDir;
}

export async function writeArtifact(
  companyId: string,
  filename: string,
  contents: string,
  overrideRoot?: string,
): Promise<string> {
  const paths = sessionPaths(companyId, overrideRoot);
  await mkdir(paths.onboardingDir, { recursive: true });
  const target = join(paths.onboardingDir, filename);
  const tmp = join(paths.onboardingDir, `.${filename}.${randomBytes(4).toString("hex")}.tmp`);
  await writeFile(tmp, contents, { encoding: "utf8", mode: 0o600 });
  await rename(tmp, target);
  return target;
}
