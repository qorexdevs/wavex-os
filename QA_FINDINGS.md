# Chat-First Onboarding — QA Findings

**Branch:** `feat/op-omega-chat-first`
**Tested:** 2026-05-12 (post 6-feature batch: Refinement Panel, breadcrumb-redo, resume hydration, real-time activate, Pillar field previews, Pillar 1 retry, Telegram test-send)

---

## TL;DR

**All automated tests green. End-to-end pipeline is shipping-ready.**

| Test surface | Status | Coverage |
|---|---|---|
| Backend CLI smoke (26 endpoints) | ✅ 26/26 in ~29s | Every onboarding endpoint exercised including new refinement loop |
| Fast e2e walk (UI, no claude) | ✅ Passed in 1.1 min | Full pipeline + scope filter + refinement panel |
| Real-T2 e2e walk (UI, real T2) | ✅ Passed in 4.3 min | Full pipeline with real claude CLI, $1.34, Paperclip handoff |
| Resume hydration spec | ✅ 2/2 in ~13s | Breadcrumbs render + auto-route to next phase |
| Paperclip handoff verification | ✅ 35 agents mirrored, 0 errors | Real-time progress + idempotency |
| Sub-fleet scope filter | ✅ Asserted under real T2 | CMO/CRO active, CPO/CFO/CDO/COO parked |

---

## Test matrix

### 1. Backend smoke (`node scripts/chat-smoke.mjs`)

Walks every onboarding endpoint with fast paths (`manual_context` on Pillar 1, `skipInference` on phase generators, fast Telegram test, focused scope, refinement loop, activate with Paperclip handoff). **All 26 pass.**

```
[01] reset (idempotent)                     ✓  26ms
[02] POST /pillar/1 (manual_context)        ✓   4ms
[03] POST /pillar/1/edit                    ✓   1ms
[04] POST /pillar/2 (claude probe)          ✓ 6101ms  ← real claude probe
[05] POST /pillar/3                         ✓   5ms
[06] POST /pillar/4                         ✓   3ms
[07] POST /pillar/5                         ✓   3ms
[08] GET  /onboarding/status                ✓   2ms
[09] POST /scope (focused, marketing+rev)   ✓   2ms
[10] GET  /scope                            ✓   2ms
[11] POST /connector-manifest (T0 fast)     ✓   3ms
[12] GET  /credentials/:id                  ✓   4ms
[13] POST /swarm-manifest (T0 fast)         ✓   4ms
[14] POST /workflow-manifest (T0 fast)      ✓   3ms
[15] POST /finalize (T0 fast)               ✓  12ms
[16] GET  /mc-report                        ✓   1ms
[17] POST /analyze-refinement               ✓ 22296ms ← real T2 ~$0.45
[18] POST /apply-refinement (2 change(s))   ✓  14ms
[19] POST /revert-refinement                ✓   7ms
[20] GET  /api/tiers                        ✓   2ms
[21] POST /api/tier-subscriptions (skip)    ✓   2ms
[22] POST /api/instance/:id/activate        ✓ 261ms   ← Paperclip handoff
[23] GET  /api/companies                    ✓   1ms
[24] GET  /api/instance/:id/manifest        ✓   1ms
[25] GET  /api/instance/:id/kpis            ✓   1ms
[26] DELETE /api/instance/:id/reset         ✓  10ms
```

### 2. Fast e2e walk (`pnpm exec playwright test e2e/chat-first-fast.spec.ts`)

Headed-capable Playwright walk against `/onboarding-chat?t0=1` (no claude CLI required). Exercises:

- Hero empty state → input submit → slug derivation
- Pillar 1 confirm card (preview signals visible)
- Silent Pillar 2 verify with transition pill
- Scope picker — focused mode, marketing + revenue (keyword-detected pre-fill)
- Pillars 3-5 prompt cards
- Connector picker → credential drawer (skip-all)
- SwarmStudio → confirm
- ImprintTheater Acts 1-3 → **Refinement Panel** (Apply only path) → Launch
- Pricing dialog → Skip
- Activate → Mission Control redirect

**Runtime:** 1.1 min. **Passes.**

### 3. Real-T2 e2e walk (`WAVEX_E2E_T2=1 pnpm exec playwright test e2e/chat-first-walk.spec.ts`)

Same UI walk but against the real `claude` CLI. Focused-scope (marketing+revenue) + post-Studio swarm-manifest API assertion that scope filter actually parked non-scoped chiefs.

**Latest run:**
```
✓ chat-first walk passed (4.3m, $1.34 total)

Phase                Cost      Duration  Calls
─────────────────────────────────────────────────
pillar_1            $0.70      85s       3*
pillar_2            $0.08       1s       1
connector_manifest  $0.16      23s       1
swarm_manifest      $0.18      32s       1
workflow_manifest   $0.21      45s       1
─────────────────────────────────────────────────
                    $1.34     ~3.1 min  7 (* imprint
                                          mis-attributed
                                          to pillar_1
                                          via time-
                                          window quirk)

Paperclip handoff:
  paperclipCompanyId: 0c5c9555-2411-44a4-a34d-d612116cc39a
  agents mirrored:    35
  errors:             0

Scope assertion (focused on marketing + revenue):
  Active (9):   ceo.orchestrator, ceo.chief-of-staff (kernel),
                cmo, cmo.demand, cmo.content,
                cro, cro.demo, cro.close, cro.expansion
  Parked (26):  cmo.brand, cmo.advocacy, cro.outbound, every
                cpo/cfo/cdo/coo subtree
```

### 4. Resume hydration (`pnpm exec playwright test e2e/chat-first-resume.spec.ts`)

Two specs in 13s. Seeds Pillars 1-5 + Pillar 2 verify via API, opens `/onboarding-chat?companyId=<slug>`, asserts:

- "Welcome back to {companyId}" message renders
- Five ✓ breadcrumbs visible (`Pillar 1: dev_tools · subscription`, etc.)
- Scope picker mounts as the active card (since scope wasn't seeded)
- Full company / Focused mode buttons available

Both pass. **Refreshing mid-walk lands you in the right place with audit trail.**

---

## Feature-level verification matrix

| Feature | Spec coverage | Status |
|---|---|---|
| #1 Refinement Panel | Fast walk clicks "Refine before launch", types guidance, clicks "Analyze impact", uses "Apply only" path. Smoke verifies analyze + apply + revert endpoints. | ✅ Wired end-to-end. **Caveat:** Apply-with-regenerate-imprint always fires real T2 even with `?t0=1` — the route doesn't honor a fast-mode flag for imprint regen. Fast walk uses Apply-only to avoid this. |
| #2 Click-to-redo breadcrumbs | Resume spec lands on scope picker; the main walk implicitly tests collapse during submit. Visual verification of click-to-redo from a collapsed pillar prompt needs manual confirmation. | ✅ Reducer wired (`UNCOLLAPSE_MESSAGE`). **Caveat:** Re-expanded card opens with fresh state — operator re-enters values. Full pre-fill from prior response is a v2. |
| #3 Pillar field previews | Visible in fast walk video (Pillar 1 inferred signals, Pillar 3 baseline preview, Pillar 4 GTM profile). | ✅ Render conditionally on chip selection. Display-only — no submit gate change. |
| #5 Telegram test-send | Not exercised by smoke or walks (would require a real bot token + chat ID). | ⚠️ **Untested.** UI wiring + API client method present; would need a sandbox Telegram bot for live verification. The route already existed pre-batch — only the UI button is new. |
| #7 Pillar 1 retry | Only fires on halt (Pillar 1 returning 409). The walks always succeed Pillar 1 on first try → retry path uncovered. | ⚠️ **Path uncovered by automated tests.** The button is wired and the API call is identical to first-fire — low regression risk. |
| #11 Resume hydration | Dedicated `chat-first-resume.spec.ts` with 2 specs covering breadcrumb render + auto-route. | ✅ Both pass. |
| #14 Real-time activate progress | Verified end-to-end during real-T2 walk (Paperclip handoff completed, 35 agents). The `handoff-progress.json` file is written + cleared correctly. The slot-by-slot UI reveal during activate is rapid (~100ms total when Paperclip is local) so per-slot animation is brief. | ✅ Backend writes per-slot status. Frontend polls every 500ms. **Note:** Hire calls to local Paperclip complete in <50ms each so the visual "hiring → hired" transition is fast but visible. Slower Paperclip (production / remote) would show longer per-slot animation. |

---

## Manual QA checklist (visual confirmations recommended)

Run `open http://127.0.0.1:5173/onboarding-chat`, type `ricoma.com`, and verify:

- [ ] **Empty state:** Big centered "What do you want to build?" heading. No top bar. Cursor focused in the input.
- [ ] **Welcome → Pillar 1:** After submit, "Got it. Reading your site..." appears with a real `T2ProgressIndicator` (real elapsed time, ETA percentile, claude PID).
- [ ] **Pillar 1 confirm card:**
  - Industry / Business model / Product status chips render with inferred values pre-selected
  - **Inferred signals preview block** (ICP, Position, Tone, Primary acq.) visible below `company_context`
  - "Looks right — keep going" advances; "Update + continue" when chips edited
- [ ] **Transition pill:** "Verifying setup…" pill appears briefly before next card. Subtle, pulsing dots.
- [ ] **Pillar 2 silent verify:** No visible UI activity for 3-5s — verifies in background.
- [ ] **Scope picker:** Detected divisions chipped. Toggle Focused / Full company.
- [ ] **Pillar 3:** After selecting product_state + stage, **baseline KPIs preview card** appears in accent border.
- [ ] **Pillar 4:** After selecting lead_sources + sales_motion, **GTM profile preview card** appears.
- [ ] **Pillar 5 Telegram:** If you pick Telegram, "Send test message" button appears next to bot token / chat ID inputs. (Requires real bot token to test.)
- [ ] **Connector → Credentials:** Drawer slides up. "Skip all (N)" button visible if multiple pending.
- [ ] **Swarm Studio:** Full-screen org chart. Parked agents at 40% opacity. Click slot opens swap panel. "+" opens add panel.
- [ ] **Imprint Theater:**
  - Act 1: 5-strategy MC race plays for ≥8s
  - Act 2: Winner reveal with stat tiles
  - Act 3: Imprint streams character-by-character
  - **"Refine before launch"** button appears next to "Let's launch"
  - Click Refine → textarea + Analyze button → after analyze, list of proposed changes with checkboxes
  - Apply only / Apply + regenerate / Skip looks-good options
- [ ] **Pricing dialog** appears over dimmed Theater. 4 tier cards. Click Subscribe or Skip.
- [ ] **Activate:**
  - Slot grid renders with all base-roster slots
  - Pulsing dot on "hiring" slots, green ✓ on "hired" slots (real-time)
  - "Open Mission Control" button appears after all slots resolved
- [ ] **Paperclip tab:** New tab opens to `http://127.0.0.1:5174/` (Paperclip UI). Click through → see your `wavex-os/<companyId>` org with all agents listed.
- [ ] **Mission Control:** Current tab redirects to `/?companyId=<id>`. FleetGraph + KPI scoreboard render.

### Resume verification

- [ ] Open `http://127.0.0.1:5173/onboarding-chat?companyId=ricoma` (after completing the walk above)
- [ ] "Welcome back to ricoma" + 6+ ✓ breadcrumbs (Pillar 1-5, Scope, Connectors, Swarm)
- [ ] Auto-routes back into SwarmStudio (since Swarm exists)

### Breadcrumb edit (redo)

- [ ] Mid-walk, after Pillar 3 is confirmed, the collapsed breadcrumb shows "✓ Pillar 3: ... · redo"
- [ ] Hover lifts opacity from 55% → 85%
- [ ] Click re-expands the Pillar 3 card with fresh state
- [ ] Re-submit fires the API and re-routes through the rest of the flow

---

## Known limitations / pre-existing behaviors

These existed before this batch — flagged for awareness, not regressions:

1. **Token-accounting time-window attribution drift.** Costs for the imprint T2 call land in adjacent phase windows (typically `pillar_1`). Total cost is correct; per-phase breakdown is approximate. Noted in `packages/op-omega-server/src/lib/token-accounting.ts` as "deferred: AsyncLocalStorage fix."

2. **Connector phase pays for T2 then falls back internally.** The vendored generator runs a T2 call (~$0.16, 26s), then if the output is terse, the generator internally falls back to the deterministic decision matrix. The manifest's `generated_by` reads `T0 · decision-matrix-fallback` but `withTokenAccounting` correctly bills the T2 call. Worth probing the vendored prompt as a follow-up — this is wasted spend on every walk.

3. **Apply-refinement with regenerate-imprint always fires real T2** regardless of any `?t0=1` URL flag. The route doesn't accept `skipInference` for imprint regeneration. Fast e2e walk uses "Apply only" (no regen) to avoid this. Operators in real-T2 mode get the regen; operators in fast mode should use Apply-only or Skip.

4. **Click-to-redo breadcrumbs don't pre-fill prior values.** Clicking a collapsed Pillar 3 breadcrumb re-expands the card with empty chips. Operator re-enters values. Full pre-fill requires plumbing prior response into the slot data + each PromptCard accepting an `initial` prop. v2 task.

5. **Paperclip handoff per-slot animation is fast against local Paperclip.** Each `/agent-hires` POST returns in <50ms, so the slot-by-slot "hiring → hired" transition completes in ~2s for 35 agents. Visible but rapid. Production / remote Paperclip would naturally show longer per-slot dwell.

6. **Pillar 1 retry button path is not covered by automated tests.** It only renders on halt (HTTP 409 from `/pillar/1`). The walks always succeed Pillar 1 on first try. The button's HTTP call is identical to the welcome-submit Pillar 1 call (no manual_context), so regression risk is low.

7. **Telegram test-send button not covered by automated tests.** Would require a sandbox Telegram bot. UI + API client are wired; route already existed pre-batch.

---

## Regression status

All 6 features in `92340f3 + 195db5d + e210ba0 + 68f6b35 + 4740034` plus the pre-existing pipeline:

- ✅ No backend smoke regressions (was 23/23, now 26/26 with refinement endpoints added)
- ✅ No fast walk regressions (was passing in 43s, now 1.1 min with refinement step added)
- ✅ No real-T2 walk regressions (still 4-5 min, still ~$1.20-$1.40, scope filter still parks the right chiefs)
- ✅ No Paperclip handoff regressions (still 35 agents mirrored, 0 errors, paperclipCompanyId returned)
- ✅ Type-check passes across all three packages (`@wavex-os/onboarding-ui`, `@wavex-os/op-omega-server`, vendored plugin tests untouched)

---

## How to re-run any of this

```bash
# Backend smoke (30s, exercises 26 endpoints + real T2 for refinement analyze)
node scripts/chat-smoke.mjs

# Fast walk (1.1 min, no claude CLI required)
pnpm exec playwright test e2e/chat-first-fast.spec.ts --headed

# Resume hydration (13s)
pnpm exec playwright test e2e/chat-first-resume.spec.ts --headed

# Real-T2 walk (4-5 min, ~$1.20-$1.40 in claude budget)
WAVEX_E2E_T2=1 pnpm exec playwright test e2e/chat-first-walk.spec.ts --headed

# Full Playwright suite
pnpm exec playwright test e2e/ --headed
```

---

## Branch state

`feat/op-omega-chat-first` — 23 commits ahead of `feat/op-omega-fidelity`. Branch is shipping-ready end-to-end.

Open items for next session (none blocking):
- (#3 Step 3) Model-per-phase env dial (~30 min, requires spawn-shim modification)
- Pre-fill prior values on breadcrumb-redo
- Backport `skipInference` flag through `applyRefinement` for fast-mode regen
- Connector T2-then-fallback investigation (vendor prompt work)
- Token-accounting AsyncLocalStorage refactor
