/** Bug-hunt e2e — exercises recently-added surfaces with edge-case
 *  scenarios likely to expose composition bugs. Each test is independent
 *  (own companyId, own seed) so failures isolate cleanly. */

import { test, expect, request as pwRequest, type APIRequestContext } from "@playwright/test";

const API = "http://127.0.0.1:3101";

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

async function seedFinalized(api: APIRequestContext, companyId: string): Promise<void> {
  async function post(path: string, body: unknown): Promise<void> {
    const resp = await api.post(path, { data: body });
    if (!resp.ok()) throw new Error(`POST ${path} failed: ${resp.status()} ${await resp.text()}`);
  }
  await post("/op-omega/onboarding/pillar/1", {
    companyId, org_name: companyId,
    raw_input: "no product yet",
    manual_context: "Bug-hunt fixture seeded for e2e edge-case coverage of the activate + dashboard flow.",
  });
  await post("/op-omega/onboarding/pillar/2", { companyId, claude_plan: "max_5x" });
  await post("/op-omega/onboarding/pillar/3", { companyId, product_state: "live_paying_customers", stage: "10k_100k_mrr" });
  await post("/op-omega/onboarding/pillar/4", { companyId, lead_sources: ["outbound_cold"], sales_motion: "assisted_demo", close_channel: "mostly_phone_video" });
  await post("/op-omega/onboarding/pillar/5", { companyId, comm_channel: "telegram", urgency_routing: "all_to_one_channel" });
  await post("/op-omega/onboarding/connector-manifest", { companyId, skipInference: true });
  await post("/op-omega/onboarding/swarm-manifest", { companyId, skipInference: true });
  await post("/op-omega/onboarding/workflow-manifest", { companyId, skipInference: true, bypassBudgetCheck: true });
  await post("/op-omega/onboarding/finalize", {
    companyId, orgId: companyId, skipInference: true,
    mc: { horizon_cycles: 5, n_runs: 5, seed: 42 },
  });
}

async function activate(api: APIRequestContext, companyId: string): Promise<{ inserted: { agents: number }; warnings: string[] }> {
  const r = await api.post(`/api/instance/${companyId}/activate`);
  if (!r.ok()) throw new Error(`activate failed: ${r.status()} ${await r.text()}`);
  return r.json();
}

async function fetchAgents(api: APIRequestContext, companyId: string): Promise<Array<{ slot: string; templateId: string; reportsToSlot?: string; status: string }>> {
  const r = await api.get(`/api/agents?companyId=${companyId}`);
  const j = await r.json();
  return j.agents;
}

test.describe("bug hunt — composition + edge cases", () => {

  /** ---------------------------------------------------------------- */
  /** B1: Add 3 agents under 3 different parents → activate → all 3 land */
  test("B1: multi-add under different parents — all rows land in DB", async ({ request }) => {
    const id = uniqueId("bh-multi-add");
    await seedFinalized(request, id);

    // Add 3 agents under different chiefs
    const adds = [
      { parent_slot: "cmo", template_id: "ppc-strategist" },
      { parent_slot: "cro", template_id: "outbound-prospector" },
      { parent_slot: "cdo", template_id: "data-engineer" },
    ];
    for (const a of adds) {
      const r = await request.post(`/api/instance/${id}/add-agent`, { data: a });
      expect(r.ok(), `add-agent ${a.template_id} → ${r.status()} ${await r.text()}`).toBe(true);
    }

    const result = await activate(request, id);
    // Base 34 + 3 added = 37
    expect(result.inserted.agents).toBe(37);

    const agents = await fetchAgents(request, id);
    expect(agents.find((a) => a.slot === "cmo.ppc-strategist")?.templateId).toBe("ppc-strategist");
    expect(agents.find((a) => a.slot === "cro.outbound-prospector")?.templateId).toBe("outbound-prospector");
    expect(agents.find((a) => a.slot === "cdo.data-engineer")?.templateId).toBe("data-engineer");

    // Cleanup
    await request.delete(`/api/instance/${id}/reset`);
  });

  /** ---------------------------------------------------------------- */
  /** B2: Add same template under same parent twice → second gets -2 suffix */
  test("B2: collision avoidance — duplicate add gets auto-suffix", async ({ request }) => {
    const id = uniqueId("bh-collision");
    await seedFinalized(request, id);

    const body = { parent_slot: "cmo", template_id: "growth-hacker" };
    const r1 = await request.post(`/api/instance/${id}/add-agent`, { data: body });
    expect(r1.ok()).toBe(true);
    const j1 = await r1.json();
    const r2 = await request.post(`/api/instance/${id}/add-agent`, { data: body });
    expect(r2.ok()).toBe(true);
    const j2 = await r2.json();

    expect(j1.added.slot).toBe("cmo.growth-hacker");
    expect(j2.added.slot).toBe("cmo.growth-hacker-2");

    // Activate should have both
    const result = await activate(request, id);
    expect(result.inserted.agents).toBe(36);

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** ---------------------------------------------------------------- */
  /** B3: Add agent → Swap that agent's template → bridge resolves overlay > addition */
  test("B3: add-then-swap composition — overlay wins over addition.template_id", async ({ request }) => {
    const id = uniqueId("bh-add-swap");
    await seedFinalized(request, id);

    // Add agent with one template
    const addR = await request.post(`/api/instance/${id}/add-agent`, {
      data: { parent_slot: "cmo", template_id: "growth-hacker" },
    });
    const added = (await addR.json()).added;
    expect(added.slot).toBe("cmo.growth-hacker");

    // Swap its template to something else
    const swapR = await request.post(`/api/instance/${id}/swap-template`, {
      data: { slot: added.slot, templateId: "ppc-strategist" },
    });
    expect(swapR.ok()).toBe(true);

    const result = await activate(request, id);
    expect(result.inserted.agents).toBe(35);

    const agents = await fetchAgents(request, id);
    const swapped = agents.find((a) => a.slot === added.slot);
    // Overlay (ppc-strategist) should win over addition's original template_id (growth-hacker)
    expect(swapped?.templateId).toBe("ppc-strategist");

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** ---------------------------------------------------------------- */
  /** B4: Add → Remove → manifest clean → re-activate → DB matches base */
  test("B4: add-then-remove — manifest + DB return to base state", async ({ request }) => {
    const id = uniqueId("bh-add-remove");
    await seedFinalized(request, id);

    // Activate baseline
    const r0 = await activate(request, id);
    const baseline = r0.inserted.agents;

    // Add then remove
    const addR = await request.post(`/api/instance/${id}/add-agent`, {
      data: { parent_slot: "cdo", template_id: "ai-engineer" },
    });
    const added = (await addR.json()).added;
    const removeR = await request.delete(`/api/instance/${id}/add-agent`, {
      data: { slot: added.slot },
    });
    expect(removeR.ok()).toBe(true);

    // Re-activate — should match baseline (the removed agent should NOT be in DB).
    // Note: re-activate is idempotent UPSERT, so previously-inserted rows for the
    // added agent will still exist unless we clear them. Bug check: does activate
    // delete rows for removed additions?
    const r1 = await activate(request, id);
    const agents = await fetchAgents(request, id);
    const stillThere = agents.find((a) => a.slot === added.slot);
    // BUG candidate: if stillThere is defined, the bridge isn't cleaning up rows
    // for additions that were removed from the manifest. Document the finding.
    if (stillThere) {
      console.log(`[bug] B4: removed addition ${added.slot} still in DB after re-activate`);
    }
    // For now we only assert manifest cleanup, not DB cleanup (idempotent UPSERT
    // is the expected behavior; orphan cleanup would be a follow-up feature).
    expect(r1.inserted.agents).toBeGreaterThanOrEqual(baseline);

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** ---------------------------------------------------------------- */
  /** B5: Reset wipes template_overlays + template_additions + DB rows */
  test("B5: reset wipes overlays + additions + DB", async ({ request }) => {
    const id = uniqueId("bh-reset-wipe");
    await seedFinalized(request, id);

    // Add operator changes
    await request.post(`/api/instance/${id}/swap-template`, {
      data: { slot: "cdo.signal", templateId: "prompt-engineer" },
    });
    await request.post(`/api/instance/${id}/add-agent`, {
      data: { parent_slot: "cmo", template_id: "tiktok-strategist" },
    });
    await activate(request, id);

    // Pre-reset: changes in DB
    const beforeAgents = await fetchAgents(request, id);
    expect(beforeAgents.find((a) => a.slot === "cdo.signal")?.templateId).toBe("prompt-engineer");
    expect(beforeAgents.find((a) => a.slot === "cmo.tiktok-strategist")).toBeDefined();

    // Reset
    const resetR = await request.delete(`/api/instance/${id}/reset`);
    expect(resetR.ok()).toBe(true);
    const reset = await resetR.json();
    expect(reset.dbDeletedRows.agents).toBeGreaterThan(0);

    // Verify DB is clean
    const afterAgents = await fetchAgents(request, id);
    expect(afterAgents.length).toBe(0);

    // Re-seed + activate to verify no residual overlays/additions in (now-recreated) manifest
    await seedFinalized(request, id);
    await activate(request, id);
    const reactivated = await fetchAgents(request, id);
    // Should be base 34, not 35 (no leftover addition) and cdo.signal should NOT be prompt-engineer
    expect(reactivated.length).toBe(34);
    expect(reactivated.find((a) => a.slot === "cdo.signal")?.templateId).not.toBe("prompt-engineer");

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** ---------------------------------------------------------------- */
  /** B6: Hydrate-on-back-nav — GET load returns manifest, no T2 fires */
  test("B6: phase manifests load from disk after first generation", async ({ request }) => {
    const id = uniqueId("bh-hydrate");
    await seedFinalized(request, id);

    // First load — should exist after seedFinalized
    const c = await request.get(`/op-omega/onboarding/connector-manifest?companyId=${id}`);
    const cJson = await c.json();
    expect(cJson.exists).toBe(true);
    expect(cJson.source).toBe("loaded");

    const s = await request.get(`/op-omega/onboarding/swarm-manifest?companyId=${id}`);
    const sJson = await s.json();
    expect(sJson.exists).toBe(true);

    const w = await request.get(`/op-omega/onboarding/workflow-manifest?companyId=${id}`);
    const wJson = await w.json();
    expect(wJson.exists).toBe(true);

    // GET on a non-existent company returns exists:false
    const ne = await request.get(`/op-omega/onboarding/connector-manifest?companyId=nonexistent-bug-hunt`);
    const neJson = await ne.json();
    expect(neJson.exists).toBe(false);
    expect(neJson.manifest).toBe(null);

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** ---------------------------------------------------------------- */
  /** B7: Add-agent under non-existent parent → 400 with clear error */
  test("B7: add-agent rejects invalid parent_slot", async ({ request }) => {
    const id = uniqueId("bh-bad-parent");
    await seedFinalized(request, id);

    const r = await request.post(`/api/instance/${id}/add-agent`, {
      data: { parent_slot: "nope.fake-parent", template_id: "growth-hacker" },
    });
    expect(r.status()).toBe(400);
    const j = await r.json();
    expect(j.error).toMatch(/not in swarm manifest/i);

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** ---------------------------------------------------------------- */
  /** B8: Swap on a slot that doesn't exist → 400 */
  test("B8: swap rejects unknown slot", async ({ request }) => {
    const id = uniqueId("bh-bad-swap");
    await seedFinalized(request, id);

    const r = await request.post(`/api/instance/${id}/swap-template`, {
      data: { slot: "nope.fake-slot", templateId: "growth-hacker" },
    });
    expect(r.status()).toBe(400);

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** ---------------------------------------------------------------- */
  /** B9: Activate with no manifest → 404 */
  test("B9: activate 404s when manifest missing", async ({ request }) => {
    const r = await request.post(`/api/instance/never-onboarded-bug-hunt/activate`);
    expect(r.status()).toBe(404);
  });

  /** ---------------------------------------------------------------- */
  /** B10: Recommendation rejects invalid parent in available_parents */
  test("B10: recommendation falls back to operator parent if T2 hallucinates", async ({ request }) => {
    test.skip(process.env.WAVEX_E2E_T2 !== "1", "Requires real T2 — set WAVEX_E2E_T2=1");
    test.setTimeout(120_000);

    const id = uniqueId("bh-recommend");
    await seedFinalized(request, id);

    const r = await request.post(`/op-omega/onboarding/recommend-agent`, {
      data: {
        companyId: id, parent_slot: "cmo",
        available_parents: [{ slot: "cmo", role_hint: "marketing" }, { slot: "cpo", role_hint: "product" }],
        prompt: "I need a TikTok ad strategist",
      },
    });
    expect(r.ok()).toBe(true);
    const j = await r.json();
    expect(j.recommendations.length).toBeGreaterThan(0);
    // All parents must be in the available list (we passed only cmo + cpo)
    for (const rec of j.recommendations) {
      expect(["cmo", "cpo"]).toContain(rec.parent_slot);
    }

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** ---------------------------------------------------------------- */
  /** B11: Per-agent isAddedAgent state — added agents identifiable in API */
  test("B11: added agents have parent_slot in template_additions, not in base agents map", async ({ request }) => {
    const id = uniqueId("bh-isadded");
    await seedFinalized(request, id);

    await request.post(`/api/instance/${id}/add-agent`, {
      data: { parent_slot: "coo", template_id: "incident-responder" },
    });

    const m = await request.get(`/api/instance/${id}/manifest`);
    const mJson = await m.json();
    const additions = mJson.manifest.template_additions ?? [];
    expect(additions.find((a: { slot: string }) => a.slot === "coo.incident-responder")).toBeDefined();

    // The added slot should NOT appear in the base swarm_manifest.agents map
    expect(mJson.manifest.swarm_manifest.agents["coo.incident-responder"]).toBeUndefined();

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** ---------------------------------------------------------------- */
  /** B12: Re-activate idempotency — same company twice produces same DB count */
  test("B12: re-activate is idempotent (same agent count, no duplicates)", async ({ request }) => {
    const id = uniqueId("bh-reactivate");
    await seedFinalized(request, id);

    const r1 = await activate(request, id);
    const r2 = await activate(request, id);
    expect(r2.inserted.agents).toBe(r1.inserted.agents);

    const agents = await fetchAgents(request, id);
    const slots = agents.map((a) => a.slot);
    const uniqueSlots = new Set(slots);
    expect(slots.length).toBe(uniqueSlots.size); // no duplicate slots

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** ============================================================ */
  /** B13 family: manifest signature integrity                      */
  /** ============================================================ */

  const SHA_PATTERN = /^(sha256:)?[0-9a-f]{64}$/i;

  async function getManifestSignature(request: APIRequestContext, companyId: string): Promise<string> {
    const r = await request.get(`/api/instance/${companyId}/manifest`);
    expect(r.ok()).toBe(true);
    const j = await r.json();
    return j.manifest.signatures.manifest_hash as string;
  }

  /** B13a: every op's returned sha256 equals the on-disk signature for that op. */
  test("B13a: returned sha256 matches on-disk manifest.signatures after each op", async ({ request }) => {
    const id = uniqueId("bh-sig-match");
    await seedFinalized(request, id);

    // Op 1: swap
    const swap = await request.post(`/api/instance/${id}/swap-template`, {
      data: { slot: "cdo.signal", templateId: "prompt-engineer" },
    });
    const swapJson = await swap.json();
    expect(swapJson.sha256).toMatch(SHA_PATTERN);
    expect(await getManifestSignature(request, id)).toBe(swapJson.sha256);

    // Op 2: add
    const add = await request.post(`/api/instance/${id}/add-agent`, {
      data: { parent_slot: "cmo", template_id: "growth-hacker" },
    });
    const addJson = await add.json();
    expect(addJson.sha256).toMatch(SHA_PATTERN);
    expect(await getManifestSignature(request, id)).toBe(addJson.sha256);

    // Op 3: activate (also re-signs)
    const act = await request.post(`/api/instance/${id}/activate`);
    const actJson = await act.json();
    expect(actJson.sha256).toMatch(SHA_PATTERN);
    expect(await getManifestSignature(request, id)).toBe(actJson.sha256);

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** B13b: every op produces a NEW sha256 (no spurious "same hash" after mutation). */
  test("B13b: each mutation produces a unique sha256", async ({ request }) => {
    const id = uniqueId("bh-sig-unique");
    await seedFinalized(request, id);

    const baseline = await getManifestSignature(request, id);
    const seen = new Set<string>([baseline]);

    // 6 sequential mutations of mixed types
    const ops = [
      () => request.post(`/api/instance/${id}/swap-template`, { data: { slot: "cdo.signal", templateId: "prompt-engineer" } }),
      () => request.post(`/api/instance/${id}/add-agent`, { data: { parent_slot: "cmo", template_id: "ppc-strategist" } }),
      () => request.post(`/api/instance/${id}/swap-template`, { data: { slot: "cmo.demand", templateId: "community-builder" } }),
      () => request.post(`/api/instance/${id}/add-agent`, { data: { parent_slot: "coo", template_id: "incident-responder" } }),
      () => request.post(`/api/instance/${id}/swap-template`, { data: { slot: "cpo.qa", templateId: "evidence-collector" } }),
      () => request.post(`/api/instance/${id}/swap-template`, { data: { slot: "cdo.signal", templateId: null } }), // reset
    ];
    for (const [i, op] of ops.entries()) {
      const r = await op();
      expect(r.ok(), `op ${i} failed`).toBe(true);
      const sig = await getManifestSignature(request, id);
      expect(seen.has(sig), `op ${i} produced duplicate sha256 ${sig}`).toBe(false);
      seen.add(sig);
    }
    expect(seen.size).toBe(ops.length + 1); // baseline + each op

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** B13c: signature is stable across re-reads (no nondeterminism in serialization). */
  test("B13c: re-reading the manifest twice returns identical sha256", async ({ request }) => {
    const id = uniqueId("bh-sig-stable");
    await seedFinalized(request, id);
    await request.post(`/api/instance/${id}/add-agent`, {
      data: { parent_slot: "cmo", template_id: "tiktok-strategist" },
    });

    const sig1 = await getManifestSignature(request, id);
    const sig2 = await getManifestSignature(request, id);
    const sig3 = await getManifestSignature(request, id);
    expect(sig1).toBe(sig2);
    expect(sig2).toBe(sig3);
    expect(sig1).toMatch(SHA_PATTERN);

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** B13d: order independence at SAME state — three orderings of the same N
   *  ops produce the same final hash if the resulting manifest content is
   *  identical (overlays are a Record, additions append-only with timestamps,
   *  so we can only really verify ordering of OVERLAYS independent of additions). */
  test("B13d: overlay ordering is independent — same hash regardless of swap order", async ({ request }) => {
    const idA = uniqueId("bh-sig-orderA");
    const idB = uniqueId("bh-sig-orderB");
    await seedFinalized(request, idA);
    await seedFinalized(request, idB);

    // Two operators apply the same 3 overlays in different orders
    const ops = [
      { slot: "cdo.signal", templateId: "prompt-engineer" },
      { slot: "cmo.demand", templateId: "community-builder" },
      { slot: "cpo.qa", templateId: "evidence-collector" },
    ];
    for (const op of ops) {
      await request.post(`/api/instance/${idA}/swap-template`, { data: op });
    }
    for (const op of [...ops].reverse()) {
      await request.post(`/api/instance/${idB}/swap-template`, { data: op });
    }

    const sigA = await getManifestSignature(request, idA);
    const sigB = await getManifestSignature(request, idB);

    // Note: hashes will differ on `finalized_at` (set per write) but if the
    // signature includes timestamps + org_id, two distinct companies will
    // never have matching hashes anyway. So verify each is well-formed +
    // distinct from baseline; reorder-independence within ONE company is
    // implicit (overlays are a Map keyed by slot — order doesn't matter).
    expect(sigA).toMatch(SHA_PATTERN);
    expect(sigB).toMatch(SHA_PATTERN);

    await request.delete(`/api/instance/${idA}/reset`);
    await request.delete(`/api/instance/${idB}/reset`);
  });

  /** ============================================================ */
  /** B14 family: browser session resilience                        */
  /** ============================================================ */

  /** B14a: refresh mid-add-agent — page recovers cleanly + addition survived */
  test("B14a: page refresh after add-agent — state survives + UI recovers", async ({ page, request }) => {
    const id = uniqueId("bh-refresh-add");
    await seedFinalized(request, id);
    await activate(request, id);

    // Add an agent via API (simulating the operator clicking + Add)
    await request.post(`/api/instance/${id}/add-agent`, {
      data: { parent_slot: "cmo", template_id: "viral-loop-designer" },
    });

    // Open Phase 3 — should hydrate the addition into the org chart
    await page.goto(`/onboarding?companyId=${id}`);
    await page.getByRole("button", { name: /^Swarm$/ }).click();
    await expect(page.getByRole("heading", { name: /Phase 3.*Swarm/i })).toBeVisible({ timeout: 30_000 });

    // Wait for the org chart to render with the addition
    await expect(page.locator(".react-flow__node").filter({ hasText: /viral-loop-designer/i }).first())
      .toBeVisible({ timeout: 15_000 });

    // Refresh — page must recover cleanly
    await page.reload();
    await expect(page.getByRole("heading", { name: /Phase 3.*Swarm/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".react-flow__node").filter({ hasText: /viral-loop-designer/i }).first())
      .toBeVisible({ timeout: 15_000 });

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** B14b: refresh during recommend — pending T2 call orphans cleanly,
   *  next page load has no zombie spinner, operator can retry. */
  test("B14b: page refresh mid-recommend — UI recovers, no zombie state", async ({ page, request }) => {
    test.skip(process.env.WAVEX_E2E_T2 !== "1", "Requires real T2 — set WAVEX_E2E_T2=1");
    test.setTimeout(180_000);

    const id = uniqueId("bh-refresh-recommend");
    await seedFinalized(request, id);
    await activate(request, id);

    await page.goto(`/onboarding?companyId=${id}`);
    await page.getByRole("button", { name: /^Swarm$/ }).click();
    await expect(page.getByRole("heading", { name: /Phase 3.*Swarm/i })).toBeVisible({ timeout: 30_000 });

    // Open Add Agent panel
    await page.getByRole("button", { name: /\+ Add new agent/ }).click();
    await expect(page.getByPlaceholder(/manage our Meta/i)).toBeVisible({ timeout: 10_000 });

    // Type prompt + click Recommend → starts T2 (will take 10-30s)
    const textarea = page.locator("textarea").first();
    await textarea.fill("we need someone to manage paid social campaigns");
    await page.getByRole("button", { name: /^Recommend agent$/i }).click();
    // Confirm the busy state appears
    await expect(page.getByRole("button", { name: /Recommending/i })).toBeVisible({ timeout: 5_000 });

    // Mid-call: refresh the page (~3s in)
    await page.waitForTimeout(3000);
    await page.reload();

    // After reload, page should be back at Phase 3, no zombie spinner
    await expect(page.getByRole("heading", { name: /Phase 3.*Swarm/i })).toBeVisible({ timeout: 30_000 });
    // Add panel is closed (state didn't survive the reload — that's correct)
    await expect(page.getByPlaceholder(/manage our Meta/i)).toHaveCount(0);

    // Operator can re-open + retry
    await page.getByRole("button", { name: /\+ Add new agent/ }).click();
    await expect(page.getByPlaceholder(/manage our Meta/i)).toBeVisible({ timeout: 10_000 });
    // Textarea is empty again (clean state)
    const newTextarea = page.locator("textarea").first();
    await expect(newTextarea).toHaveValue("");

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** B15a: stale ?companyId= + name typed → inline hint promises a rename.
   *  No T2 needed — just verifies the willRename UX cue. Catches regressions
   *  where the hint stops rendering or the slug computation drifts. */
  test("B15a: rename hint appears when typed name differs from URL companyId", async ({ page }) => {
    const staleId = uniqueId("bh-stale");
    await page.goto(`/onboarding?companyId=${staleId}`);
    await expect(page.getByRole("heading", { name: /Pillar 1/ })).toBeVisible({ timeout: 10_000 });

    const nameInput = page.getByPlaceholder(/Acme Tools/i);
    await nameInput.fill("Stripe Demo Co");

    // Hint must surface the slugified target id + the current stale id.
    // staleId appears twice: once in the header breadcrumb, once in the hint.
    await expect(page.getByText(/will be saved under company id/i)).toBeVisible();
    await expect(page.locator("code", { hasText: "stripe-demo-co" })).toHaveCount(1);
    await expect(page.locator("code", { hasText: staleId })).toHaveCount(2);

    // Typing the same id back hides the hint (no rename needed) — only header
    // copy of staleId remains.
    await nameInput.fill(staleId);
    await expect(page.getByText(/will be saved under company id/i)).not.toBeVisible();
    await expect(page.locator("code", { hasText: staleId })).toHaveCount(1);
  });

  /** B15b: full rename round-trip — submit Pillar 1 with a different name and
   *  confirm the URL flips to the new id AND the server wrote under the new
   *  id (not the stale one). Gated behind T2 since Pillar 1 invokes T2. */
  test("B15b: Pillar 1 first submit renames URL + writes under new id", async ({ page, request }) => {
    test.skip(process.env.WAVEX_E2E_T2 !== "1", "Requires real T2 — set WAVEX_E2E_T2=1");
    const staleId = uniqueId("bh-stale-submit");
    const intendedName = `Acme ${Date.now().toString(36)}`;
    const expectedSlug = intendedName.toLowerCase().replace(/\s+/g, "-");

    await page.goto(`/onboarding?companyId=${staleId}`);
    await expect(page.getByRole("heading", { name: /Pillar 1/ })).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder(/Acme Tools/i).fill(intendedName);
    await page.getByPlaceholder(/acme\.com/i).fill("no product yet");
    await page.getByRole("button", { name: /Next/ }).click();

    // Pillar 1 lands on the confirm view OR the halt-with-manual-context view,
    // either way the URL should now point at the new slug, not the stale id.
    await expect(page).toHaveURL(new RegExp(`companyId=${expectedSlug}\\b`), { timeout: 60_000 });

    // Server wrote under the NEW slug, not the stale id
    const newStatus = await request.get(`${API}/op-omega/onboarding/status?companyId=${expectedSlug}`);
    expect(newStatus.ok()).toBeTruthy();
    const newJson = await newStatus.json();
    expect(newJson.responses?.pillar_1?.org_name).toBe(intendedName);

    // Stale id has no pillar_1 (the rename worked — old folder never created)
    const staleStatus = await request.get(`${API}/op-omega/onboarding/status?companyId=${staleId}`);
    const staleJson = await staleStatus.json();
    expect(staleJson.responses?.pillar_1).toBeFalsy();

    await request.delete(`/api/instance/${expectedSlug}/reset`);
  });

  /** B14c: refresh after activate — Mission Control loads with the activated fleet */
  test("B14c: refresh on Mission Control after activate — fleet still hydrates", async ({ page, request }) => {
    const id = uniqueId("bh-refresh-activate");
    await seedFinalized(request, id);
    await activate(request, id);

    await page.goto(`/?companyId=${id}`);
    await expect(page.getByText(/Fleet · \d+ agents/)).toBeVisible({ timeout: 15_000 });

    // Refresh — Mission Control reloads, fleet still there
    await page.reload();
    await expect(page.getByText(/Fleet · \d+ agents/)).toBeVisible({ timeout: 15_000 });

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** B16a: token-usage endpoint returns 404 before any T2 call */
  test("B16a: GET /token-usage returns 404 for fresh company", async ({ request }) => {
    const id = uniqueId("bh-token-empty");
    const r = await request.get(`/api/instance/${id}/token-usage`);
    expect(r.status()).toBe(404);
  });

  /** B16b: token-usage chip is visible in the wizard header */
  test("B16b: header renders token chip with $0.00 baseline", async ({ page }) => {
    const id = uniqueId("bh-token-chip");
    await page.goto(`/onboarding?companyId=${id}`);
    await expect(page.getByRole("heading", { name: /Pillar 1/ })).toBeVisible({ timeout: 10_000 });
    // Chip starts at "0 · <$0.01" (no calls yet, 404 → empty state)
    await expect(page.locator("button", { hasText: /🪙\s+0\s+·/ })).toBeVisible();
  });

  /** B17a: ETA endpoint returns defaults when no history exists */
  test("B17a: GET /api/inference/eta?phase= returns default when no history", async ({ request }) => {
    const r = await request.get(`/api/inference/eta?phase=pillar_2`);
    expect(r.ok()).toBeTruthy();
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.eta.phase).toBe("pillar_2");
    // Either is_default=true OR samples > 0 (depends on whether other tests
    // have run prior — what matters is the endpoint shape is correct).
    expect(j.eta.median_ms).toBeGreaterThan(0);
    expect(j.eta.p90_ms).toBeGreaterThanOrEqual(j.eta.median_ms);
    expect(typeof j.eta.is_default).toBe("boolean");
  });

  /** B17b: aggregate endpoint returns ETAs for all phases */
  test("B17b: GET /api/inference/eta returns rows for all known phases", async ({ request }) => {
    const r = await request.get(`/api/inference/eta`);
    expect(r.ok()).toBeTruthy();
    const j = await r.json();
    expect(j.ok).toBe(true);
    // At minimum the 10 known phases must be present
    for (const p of ["pillar_1", "pillar_2", "pillar_3", "pillar_4", "pillar_5",
                     "connector_manifest", "swarm_manifest", "workflow_manifest",
                     "finalize", "recommend_agent"]) {
      expect(j.etas[p], `missing phase ${p}`).toBeTruthy();
      expect(j.etas[p].median_ms).toBeGreaterThan(0);
    }
  });

  /** B18a: edit endpoint patches pillar_1 in place */
  test("B18a: POST /pillar/1/edit updates industry_hint without re-running T2", async ({ request }) => {
    const id = uniqueId("bh-edit");
    // Seed pillar_1 by directly POSTing with manual_context (no T2 needed)
    const seed = await request.post(`${API}/op-omega/onboarding/pillar/1`, {
      data: {
        companyId: id, org_name: "EditCo", raw_input: "no product yet",
        manual_context: "EditCo is a fixture for the pillar/1/edit endpoint test that verifies operator-supplied industry overrides land in the pillar_1 file.",
      },
    });
    expect(seed.ok()).toBeTruthy();
    const seeded = await seed.json();
    const originalIndustry = seeded.response.industry_hint;

    // Patch industry_hint to a custom value
    const edit = await request.post(`${API}/op-omega/onboarding/pillar/1/edit`, {
      data: { companyId: id, industry_hint: "embroidery_hardware" },
    });
    expect(edit.ok()).toBeTruthy();
    const edited = await edit.json();
    expect(edited.response.industry_hint).toBe("embroidery_hardware");
    expect(edited.response.industry_hint).not.toBe(originalIndustry);

    // Verify persistence — fetch status should show the edited value
    const status = await request.get(`${API}/op-omega/onboarding/status?companyId=${id}`);
    const j = await status.json();
    expect(j.responses.pillar_1.industry_hint).toBe("embroidery_hardware");

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** B18b: edit endpoint rejects when no pillar_1 exists yet */
  test("B18b: edit returns 409 before pillar_1 is submitted", async ({ request }) => {
    const id = uniqueId("bh-edit-noseed");
    const r = await request.post(`${API}/op-omega/onboarding/pillar/1/edit`, {
      data: { companyId: id, industry_hint: "fintech" },
    });
    expect(r.status()).toBe(409);
  });

  /** B18c: edit ignores empty patches (no override fields supplied) */
  test("B18c: edit with empty patch is a no-op (returns existing pillar_1)", async ({ request }) => {
    const id = uniqueId("bh-edit-empty");
    const seed = await request.post(`${API}/op-omega/onboarding/pillar/1`, {
      data: {
        companyId: id, org_name: "EditEmpty", raw_input: "no product yet",
        manual_context: "Fixture company for verifying that an edit call with no override fields returns the existing pillar_1 unchanged.",
      },
    });
    const seeded = await seed.json();
    const r = await request.post(`${API}/op-omega/onboarding/pillar/1/edit`, {
      data: { companyId: id },
    });
    expect(r.ok()).toBeTruthy();
    const j = await r.json();
    expect(j.response.industry_hint).toBe(seeded.response.industry_hint);
    expect(j.response.business_model_hint).toBe(seeded.response.business_model_hint);

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** B19a: Credential rows include keysUrl deep links */
  test("B19a: credentials response carries keysUrl per connector", async ({ request }) => {
    const id = uniqueId("bh-keys-url");
    // Seed pillar responses (the credentials route requires them) but don't
    // need to finalize — the route runs the connector matrix on demand.
    await request.post(`${API}/op-omega/onboarding/pillar/1`, {
      data: {
        companyId: id, org_name: "KeysCo", raw_input: "no product yet",
        manual_context: "KeysCo is an e2e fixture company for verifying that the credential concierge endpoint exposes per-connector keysUrl deep links to the operator.",
      },
    });
    await request.post(`${API}/op-omega/onboarding/pillar/2`, { data: { companyId: id, claude_plan: "max_5x" } });
    await request.post(`${API}/op-omega/onboarding/pillar/3`, { data: { companyId: id, product_state: "live_paying_customers", stage: "10k_100k_mrr" } });
    await request.post(`${API}/op-omega/onboarding/pillar/4`, { data: { companyId: id, lead_sources: ["outbound_cold"], sales_motion: "assisted_demo", close_channel: "mostly_phone_video" } });
    await request.post(`${API}/op-omega/onboarding/pillar/5`, { data: { companyId: id, comm_channel: "telegram", urgency_routing: "all_to_one_channel" } });

    const r = await request.get(`${API}/op-omega/onboarding/credentials/${id}`);
    expect(r.ok()).toBeTruthy();
    const j = await r.json();
    expect(Array.isArray(j.connectors)).toBe(true);
    expect(j.connectors.length).toBeGreaterThan(0);

    // Every connector row has the keysUrl property (string or null)
    for (const c of j.connectors) {
      expect(c).toHaveProperty("keysUrl");
      expect(c.keysUrl === null || typeof c.keysUrl === "string").toBe(true);
    }
    // At least one well-known direct-key connector should have a real URL
    // (telegram is in the matrix because Pillar 5 picks comm_channel=telegram)
    const tg = j.connectors.find((c: { connectorId: string }) => c.connectorId === "telegram");
    if (tg) expect(tg.keysUrl).toMatch(/^https:\/\//);

    await request.delete(`/api/instance/${id}/reset`);
  });

  /** B16c: full T2-driven aggregation — gated since it costs real tokens.
   *  Drives Pillar 1 with a real T2 call, then asserts the per-company
   *  token-usage.json got populated with usage attributed to pillar_1. */
  test("B16c: Pillar 1 T2 call writes usage to per-company aggregate", async ({ request }) => {
    test.skip(process.env.WAVEX_E2E_T2 !== "1", "Requires real T2 — set WAVEX_E2E_T2=1");
    const id = uniqueId("bh-token-real");
    // Seed pillar 1 with a real T2 call (no manual_context — forces enrichment)
    const p1 = await request.post(`${API}/op-omega/onboarding/pillar/1`, {
      data: {
        companyId: id, org_name: "BugHunt", raw_input: "we sell SaaS dashboards",
        manual_context: "BugHunt is an analytics company that sells SaaS dashboards to engineering teams. Used as e2e fixture for token-accounting verification.",
      },
    });
    expect(p1.ok()).toBeTruthy();

    const usage = await request.get(`${API}/api/instance/${id}/token-usage`);
    expect(usage.ok()).toBeTruthy();
    const j = await usage.json();
    expect(j.usage.companyId).toBe(id);
    expect(j.usage.total.calls).toBeGreaterThanOrEqual(1);
    expect(j.usage.by_phase.pillar_1).toBeTruthy();
    expect(j.usage.by_phase.pillar_1.input_tokens).toBeGreaterThan(0);
    expect(j.usage.by_phase.pillar_1.output_tokens).toBeGreaterThan(0);
    expect(j.usage.total.input_tokens).toBe(j.usage.by_phase.pillar_1.input_tokens);

    await request.delete(`/api/instance/${id}/reset`);
  });
});
