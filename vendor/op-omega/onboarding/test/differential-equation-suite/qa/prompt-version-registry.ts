/**
 * OPΩ-ONB-TEST-001-rev2 · Step 14 · Prompt Version Registry
 *
 * Snapshots the inline T2 prompts used by the onboarding pipeline so QA
 * records can include which prompt version produced a given manifest, and
 * so we can detect silent drift between the committed snapshot and the
 * current source (the prompt.ts files under src/phases/).
 *
 * Pattern:
 *   - Each phase has `prompts/<phase>/v<semver>.md` snapshots. These are
 *     frozen references — bumping semver means authoring a new file.
 *   - `CURRENT_PROMPT_VERSIONS` names the version a fresh pipeline run is
 *     expected to be equivalent to.
 *   - `getPromptVersions()` returns those versions + their SHA-256 hashes
 *     for stamping onto QA records (`prompt_versions` field).
 *   - `verifyPromptDriftAgainstSource()` reads the current TS source and
 *     compares its prompt-body text to the snapshot — if someone edits
 *     `prompt.ts` without bumping semver, this flags it.
 *
 * Hash target is the **snapshot file bytes**, not the rendered prompt,
 * because we want a version id tied to the committed artifact.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export type PromptPhaseId = "phase-2" | "phase-3" | "phase-4" | "finalize-imprint";

/**
 * The version of each prompt that a fresh pipeline run is expected to
 * correspond to. Bump when you change the inline prompt in `src/phases/*`.
 */
export const CURRENT_PROMPT_VERSIONS: Record<PromptPhaseId, string> = {
  "phase-2": "0.4.0",
  "phase-3": "0.6.0",
  "phase-4": "0.4.0",
  "finalize-imprint": "0.1.0",
};

/** Source TS file for each phase (used by drift checker). */
const SOURCE_MAP: Record<PromptPhaseId, string> = {
  "phase-2": "src/phases/phase-2-connector/prompt.ts",
  "phase-3": "src/phases/phase-3-swarm/prompt.ts",
  "phase-4": "src/phases/phase-4-workflow/prompt.ts",
  "finalize-imprint": "src/phases/finalize/imprint-review.ts",
};

function suiteRoot(): string {
  // This file lives at .../differential-equation-suite/qa/prompt-version-registry.ts
  // We want the parent of qa/, i.e. the differential-equation-suite root.
  const here = fileURLToPath(import.meta.url);
  return join(here, "..", "..");
}

function packageRoot(): string {
  // packages/plugins/onboarding/
  return join(suiteRoot(), "..", "..");
}

export interface PromptVersionEntry {
  version: string;
  snapshot_path: string;
  snapshot_sha256: string;
}

export async function loadSnapshot(phase: PromptPhaseId, version: string): Promise<{ path: string; content: string; sha256: string }> {
  const path = join(suiteRoot(), "prompts", phase, `v${version}.md`);
  const content = await readFile(path, "utf8");
  const sha256 = createHash("sha256").update(content).digest("hex");
  return { path, content, sha256 };
}

export async function getPromptVersions(): Promise<Record<PromptPhaseId, PromptVersionEntry>> {
  const out = {} as Record<PromptPhaseId, PromptVersionEntry>;
  for (const phase of Object.keys(CURRENT_PROMPT_VERSIONS) as PromptPhaseId[]) {
    const version = CURRENT_PROMPT_VERSIONS[phase];
    const { path, sha256 } = await loadSnapshot(phase, version);
    out[phase] = { version, snapshot_path: path, snapshot_sha256: sha256 };
  }
  return out;
}

/** Flat { "phase-2": "0.1.0", ... } form for the QA record `prompt_versions` field. */
export async function stampPromptVersions(): Promise<Record<string, string>> {
  const entries = await getPromptVersions();
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) flat[k] = v.version;
  return flat;
}

export interface PromptDriftResult {
  phase: PromptPhaseId;
  version: string;
  drift: "none" | "body_diverged" | "snapshot_missing_markers" | "source_missing_markers";
  notes: string[];
}

/**
 * Extract the prompt body from the TS source — i.e. the text between the
 * first `return \`` and the matching closing backtick at the start of a
 * line. This is approximate: it strips TS interpolations so we can compare
 * the structural text against the snapshot's `{{var}}` placeholders.
 */
function extractPromptBodyFromSource(src: string): string | null {
  const startMarker = "return `";
  const start = src.indexOf(startMarker);
  if (start < 0) return null;
  const bodyStart = start + startMarker.length;
  // Find the closing backtick followed by `;` on a line.
  const endIdx = src.indexOf("`;", bodyStart);
  if (endIdx < 0) return null;
  return src.slice(bodyStart, endIdx);
}

/** Strip `${...}` expressions from a TS template-literal body, honoring
 *  brace balance (and nested backtick templates). Returns the fixed prose
 *  with each expression replaced by `{{VAR}}`. */
function stripInterpolations(src: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] === "$" && src[i + 1] === "{") {
      // Walk balanced braces, tracking nested template literals too.
      let depth = 1;
      let j = i + 2;
      let inString: '"' | "'" | "`" | null = null;
      while (j < src.length && depth > 0) {
        const ch = src[j];
        if (inString) {
          if (ch === "\\") { j += 2; continue; }
          if (ch === inString) inString = null;
          j++;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") { inString = ch; j++; continue; }
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
        j++;
      }
      out.push("{{VAR}}");
      i = j;
    } else {
      out.push(src[i]);
      i++;
    }
  }
  return out.join("");
}

function canonicalize(s: string): string {
  // Collapse runs of whitespace (incl. newlines) to a single space so
  // reformatting of the same prose doesn't trigger drift.
  return s.replace(/\s+/g, " ").trim();
}

function normalizeBody(s: string): string {
  return canonicalize(stripInterpolations(s));
}

function normalizeSnapshotBody(md: string): string {
  // Strip the leading title + `---` separator; normalize placeholders.
  const sepIdx = md.indexOf("\n---\n");
  const body = sepIdx >= 0 ? md.slice(sepIdx + 5) : md;
  return canonicalize(body.replace(/\{\{[^}]*\}\}/g, "{{VAR}}"));
}

/**
 * Compare the committed snapshot against the current TS source. Returns
 * `drift: "none"` if the structural prompt body matches modulo template
 * variable substitution; otherwise flags the discrepancy.
 */
export async function verifyPromptDriftAgainstSource(phase: PromptPhaseId): Promise<PromptDriftResult> {
  const version = CURRENT_PROMPT_VERSIONS[phase];
  const notes: string[] = [];

  const snap = await loadSnapshot(phase, version);
  const snapBody = normalizeSnapshotBody(snap.content);
  if (!snapBody) {
    return { phase, version, drift: "snapshot_missing_markers", notes: ["snapshot has no body after --- separator"] };
  }

  const srcPath = join(packageRoot(), SOURCE_MAP[phase]);
  const src = await readFile(srcPath, "utf8");
  const body = extractPromptBodyFromSource(src);
  if (!body) {
    return { phase, version, drift: "source_missing_markers", notes: [`could not find prompt body (return template literal) in ${SOURCE_MAP[phase]}`] };
  }
  const normSrc = normalizeBody(body);

  if (normSrc === snapBody) {
    return { phase, version, drift: "none", notes };
  }

  // Coarse diff: find the first differing character window.
  const max = Math.max(snapBody.length, normSrc.length);
  let firstDiff = -1;
  for (let i = 0; i < max; i++) {
    if (snapBody[i] !== normSrc[i]) { firstDiff = i; break; }
  }
  notes.push(`snapshot_len=${snapBody.length} source_len=${normSrc.length} first_diff_char=${firstDiff}`);
  if (firstDiff >= 0) {
    const ctx = (s: string) => s.slice(Math.max(0, firstDiff - 20), firstDiff + 80);
    notes.push(`snapshot: ${JSON.stringify(ctx(snapBody))}`);
    notes.push(`source:   ${JSON.stringify(ctx(normSrc))}`);
  }
  return { phase, version, drift: "body_diverged", notes };
}

export async function verifyAllPromptDrift(): Promise<PromptDriftResult[]> {
  const phases = Object.keys(CURRENT_PROMPT_VERSIONS) as PromptPhaseId[];
  return Promise.all(phases.map(verifyPromptDriftAgainstSource));
}

export function renderPromptVersionsMarkdown(entries: Record<PromptPhaseId, PromptVersionEntry>, drift?: PromptDriftResult[]): string {
  const lines: string[] = [];
  lines.push(`## Prompt versions`);
  lines.push("");
  lines.push(`| Phase | Version | Snapshot sha256 | Drift |`);
  lines.push(`|---|---|---|---|`);
  const driftByPhase = new Map<PromptPhaseId, PromptDriftResult>();
  for (const d of drift ?? []) driftByPhase.set(d.phase, d);
  for (const phase of Object.keys(entries) as PromptPhaseId[]) {
    const e = entries[phase];
    const d = driftByPhase.get(phase);
    const driftCell = d ? (d.drift === "none" ? "✓ none" : `⚠ ${d.drift}`) : "—";
    lines.push(`| \`${phase}\` | ${e.version} | \`${e.snapshot_sha256.slice(0, 12)}…\` | ${driftCell} |`);
  }
  lines.push("");
  const diverged = (drift ?? []).filter((d) => d.drift !== "none");
  if (diverged.length > 0) {
    lines.push(`### Drift details`);
    lines.push("");
    for (const d of diverged) {
      lines.push(`- **${d.phase} v${d.version}** (${d.drift})`);
      for (const n of d.notes) lines.push(`  - ${n}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
