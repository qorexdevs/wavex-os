import { describe, expect, it } from "vitest";
import {
  CURRENT_PROMPT_VERSIONS,
  getPromptVersions,
  stampPromptVersions,
  verifyAllPromptDrift,
  type PromptPhaseId,
} from "./prompt-version-registry.js";

describe("prompt-version-registry", () => {
  it("returns sha256 entries for every declared phase", async () => {
    const entries = await getPromptVersions();
    for (const phase of Object.keys(CURRENT_PROMPT_VERSIONS) as PromptPhaseId[]) {
      expect(entries[phase]).toBeDefined();
      expect(entries[phase].snapshot_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(entries[phase].version).toBe(CURRENT_PROMPT_VERSIONS[phase]);
    }
  });

  it("stampPromptVersions produces a flat string map suitable for QA records", async () => {
    const flat = await stampPromptVersions();
    expect(flat["phase-2"]).toBe(CURRENT_PROMPT_VERSIONS["phase-2"]);
    expect(flat["phase-3"]).toBe(CURRENT_PROMPT_VERSIONS["phase-3"]);
    expect(flat["phase-4"]).toBe(CURRENT_PROMPT_VERSIONS["phase-4"]);
    expect(flat["finalize-imprint"]).toBe(CURRENT_PROMPT_VERSIONS["finalize-imprint"]);
  });

  it("current source does not drift from the committed snapshot", async () => {
    const results = await verifyAllPromptDrift();
    const diverged = results.filter((r) => r.drift !== "none");
    if (diverged.length > 0) {
      const msg = diverged.map((r) => `${r.phase} v${r.version}: ${r.drift}\n  ${r.notes.join("\n  ")}`).join("\n\n");
      throw new Error(
        `Prompt drift detected — either revert the prompt.ts change or author prompts/<phase>/v<next-semver>.md and bump CURRENT_PROMPT_VERSIONS.\n\n${msg}`,
      );
    }
    expect(diverged.length).toBe(0);
  });
});
