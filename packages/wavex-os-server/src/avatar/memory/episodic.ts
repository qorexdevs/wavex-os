/** Avatar memory v1 — episodic event store (JSONL, append-only).
 *
 * Every operator decision on an avatar's approval (approve / reject /
 * edit) lands here. Lines are JSON objects, newest at the bottom. The
 * preferences distiller reads recent events and produces rules; the
 * dashboard renders the tail.
 *
 * Storage: ~/.wavex-os/instances/default/avatars/<id>/memory/episodic.jsonl
 *
 * Falls back gracefully when the file is missing (returns empty list).
 * The Drizzle schema in @wavex-os/db scaffolds the eventual DB shape; the
 * row written here matches that schema field-for-field so the cloud
 * migration is straight INSERTs from the JSONL.
 */

import { appendFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";

export type EpisodicKind = "decision" | "edit" | "skip";

export interface EpisodicEvent {
  id: string;
  avatarId: string;
  ts: string;
  kind: EpisodicKind;
  approvalId?: string;
  approvalType?: string;
  classification?: "now" | "soon" | "fyi";
  confidence?: number;
  decision?: "approve" | "reject";
  edited?: { before?: string; after?: string };
  note?: string;
  payloadSnapshot?: Record<string, unknown>;
}

function avatarDir(id: string): string {
  const root = process.env.WAVEX_OS_STATE_DIR ?? join(homedir(), ".wavex-os");
  return join(root, "instances", "default", "avatars", id);
}

function memoryPath(avatarId: string): string {
  return join(avatarDir(avatarId), "memory", "episodic.jsonl");
}

function newEventId(): string {
  return `ep_${randomBytes(8).toString("hex")}`;
}

async function append(avatarId: string, event: EpisodicEvent): Promise<void> {
  const path = memoryPath(avatarId);
  await mkdir(join(avatarDir(avatarId), "memory"), { recursive: true });
  await appendFile(path, JSON.stringify(event) + "\n", "utf8");
}

/** Record an approval decision (approve / reject) — called from the
 *  decide route after the approval status flips. */
export async function logDecision(
  avatarId: string,
  approval: {
    id: string; type: string;
    payload: Record<string, unknown> & {
      classification?: "now" | "soon" | "fyi";
      confidence?: number;
    };
  },
  decision: "approve" | "reject",
  note?: string,
): Promise<EpisodicEvent> {
  const event: EpisodicEvent = {
    id: newEventId(),
    avatarId,
    ts: new Date().toISOString(),
    kind: "decision",
    approvalId: approval.id,
    approvalType: approval.type,
    classification: approval.payload?.classification,
    confidence: approval.payload?.confidence,
    decision,
    note,
    payloadSnapshot: approval.payload,
  };
  await append(avatarId, event);
  return event;
}

/** Record an operator edit on a draft. `before` is the runner's draft;
 *  `after` is the operator's rewrite. The diff is the gold signal for
 *  learning ("I keep removing apologies → add as a guardrail"). */
export async function logEdit(
  avatarId: string,
  approvalId: string,
  before: string,
  after: string,
): Promise<EpisodicEvent> {
  const event: EpisodicEvent = {
    id: newEventId(),
    avatarId,
    ts: new Date().toISOString(),
    kind: "edit",
    approvalId,
    edited: { before, after },
  };
  await append(avatarId, event);
  return event;
}

/** Read the episodic stream, optionally filtered to events at or after
 *  `since`. Returns newest-last (file order). Empty array if missing. */
export async function readEpisodic(avatarId: string, since?: string): Promise<EpisodicEvent[]> {
  let raw: string;
  try {
    raw = await readFile(memoryPath(avatarId), "utf8");
  } catch {
    return [];
  }
  const lines = raw.split("\n").filter((l) => l.length > 0);
  const events: EpisodicEvent[] = [];
  for (const line of lines) {
    try {
      const e = JSON.parse(line) as EpisodicEvent;
      if (since && e.ts < since) continue;
      events.push(e);
    } catch { /* skip malformed lines */ }
  }
  return events;
}
