# Phase H — Inception, Paid Tier, WaveX Customization, Ops Layer

Composite plan covering the 7 operator-requested workstreams. Date: 2026-05-13.

This doc is a roadmap. Each track has its own scope, dependencies, and rough size estimate so you can pick what to ship next without re-deriving context.

---

## Status Snapshot (as of this commit)

### What WORKS today

| Surface | Status |
|---|---|
| Chat-first onboarding (Avatar / Solo Founder / Hybrid) | ✓ live at `/onboarding-chat` |
| URL-grounded Pillar 1 enrichment | ✓ no hallucination |
| Inline-card ✨ suggestions on Pillar 3/4/5 | ✓ |
| Inference-driven narrator on phase transitions | ✓ |
| Credential concierge with MCP→OAuth→paste hierarchy | ✓ supabase/github/stripe/slack all OAuth-able |
| AvatarToolsCard with real Composio OAuth (9 of 10 toolkits) | ✓ no mocks |
| Activate → 35-agent fleet on disk | ✓ manifest hash set, `finalized_at` set |
| Mission Control InceptionCTA with paperclip-reachability probe | ✓ |
| Pool A inference (free, rate-limited) | ✓ 40/hr/install, 100/lifetime |
| Stripe webhook **edge function** | ✓ deployed to `ngvtgraldybxdbgkihfj` 2026-05-13 |

### What's BROKEN or MISSING

| Issue | Severity | Track |
|---|---|---|
| Stripe webhook endpoint not registered in Stripe Dashboard | 🔴 P0 — blocks subscriptions | T1 |
| Manifest `goal.kpiId` + `signed_at` null after finalize | 🟡 cosmetic — KPI scoreboard says "no baseline" | T2 |
| Mock-core has no `/api/companies/:id/agents` endpoint | 🟡 — fleet count probe returns 0 | T2 |
| Pool B (BYO Claude OAuth) — customer's own Anthropic plan | 🟢 NEW FEATURE | T3 |
| WaveX-customized Paperclip (plugin not fork) | 🟢 NEW FEATURE | T4 |
| WaveX operator agent (system-alignment monitor) | 🟢 NEW FEATURE | T5 |
| DB analysis + Expert Agent marketplace planning | 🟢 NEW FEATURE | T6 |

---

## T1 — Stripe Webhook Activation (BLOCKER, ~30 min)

### What this turn shipped

- Discovered the edge function was **never deployed**. Function name is `wavex-os-subscription-webhook` (not the older `stripe-webhook` which belongs to wavexcard).
- Deployed via `supabase functions deploy wavex-os-subscription-webhook --no-verify-jwt --project-ref ngvtgraldybxdbgkihfj`.
- Verified env secrets `STRIPE_SECRET_KEY_TEST_ENV` + `WAVEX_OS_STRIPE_WEBHOOK_SECRET` are set.
- Smoke-tested: webhook returns proper 400 on invalid signatures.

### What's left

1. In Stripe Dashboard → Developers → Webhooks:
   - **Add endpoint**: `https://ngvtgraldybxdbgkihfj.supabase.co/functions/v1/wavex-os-subscription-webhook`
   - **Events**: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`
   - Copy the new signing secret → run `supabase secrets set WAVEX_OS_STRIPE_WEBHOOK_SECRET=whsec_... --project-ref ngvtgraldybxdbgkihfj`
2. Run a real test checkout against `wss_test_*` price ID — confirm a row lands in `wavex_os.subscriptions` and `wavex_os.stripe_webhook_events`.

**ETA**: 15 min for steps 1-2. This unblocks all paid-tier work.

---

## T2 — Inception Polish (~3-4 hours)

The manifest is finalized but missing the operator-visible signals:

1. **`goal.kpiId` is null** — the upstream finalize doesn't pick a primary KPI. Need to:
   - Add a server step that selects `goal.kpiId` from the KPI registry based on Pillar 3 stage (e.g., MRR for live-paying, activation_rate for prototype).
   - Write the result to `company.manifest.json` AND surface it on Mission Control's "Headline Goal" card.

2. **`signed_at` is null** — the manifest has a hash but no signature timestamp. Two options:
   - Pure cosmetic: set `signed_at` to `finalized_at` since they're effectively the same moment.
   - Real signature: sign the manifest with operator's Ed25519 key (we already have one for Expert Agents — reuse here).

3. **Mock-core needs `/api/companies/:id/agents`** — the InceptionCTA's agent-status probe currently 404s on this endpoint, so the count comes from elsewhere (`FleetGraph` reads agents via a different shape). Add the route for consistency.

4. **"Force first cycle now" needs a real handler** — currently the button POSTs `/api/companies/:id/trigger-heartbeats` which doesn't exist. Add a mock-core handler that fires one synthetic heartbeat per agent.

---

## T3 — Pool B (BYO Claude Max OAuth) (~2-3 days)

Customer signs in with their **own** Claude account so onboarding T2 + their fleet's inference is billed to THEIR Anthropic plan, not your operator hub. Big CAC win + privacy story.

### Pieces

1. **`WAVEX_INFERENCE_MODE=byo_oauth`** — new third option alongside `oauth` (operator's keychain) and `hosted` (operator's hub).
2. **"Sign in with Claude"** button in the wizard (probably during Pillar 2 or Account-Type gateway).
3. **Anthropic device-code OAuth flow** — opens browser, returns to wavex-os with refresh token.
4. **macOS Keychain storage** — `security add-generic-password -s wavex-byo-claude -a <customer-email>`.
5. **claude-hosted-shim.mjs branch** that uses the customer's token instead of Pool A session.
6. **tier-router config** that picks the customer's token first, falls back to Pool A.

### Pricing implications

- Free tier becomes truly free for the operator: customer pays Anthropic directly.
- Paid tier (Pool C Expert Agents) still uses the operator's keychain.
- Customer can sign in/out — fallback is Pool A's rate-limited free.

---

## T4 — WaveX-Customized Paperclip (Plugin approach, ~1-2 days for scaffold)

You want to customize Paperclip without forking. **Use Paperclip's plugin API.**

### Approach

1. New package: `packages/paperclip-plugin-wavex/`.
2. Registers via `@paperclipai/plugin-sdk` (already vendored at `vendor/wavex-os/plugin-sdk/`).
3. Hooks to override:
   - **Dashboard branding** — replace Paperclip logo + colors with WaveX.
   - **Custom routes** — add `/wavex/expert-agents`, `/wavex/inception-status`, `/wavex/cost-ledger` panels.
   - **Issue templates** — pre-fill WaveX-specific issue types (Liaison digest, alignment check).
   - **CommandComposer** — surface WaveX commands ("kickoff inception", "trigger heartbeat all").

Paperclip core stays at `packages/core/` unmodified. Subtree updates keep working.

---

## T5 — WaveX Operator Agent (~1 day)

You asked for "kickoff wavex agent (making sure the system is aligned and delivering, capable model for error fixing)". This is an operator-side oversight agent — different from the customer-facing fleet agents.

### Scope

- Runs on a launchd job every 15 min (already have `resource-sweep` precedent).
- Reads: `~/.wavex-os/state/*.jsonl` (Pool A ledger, error log, inference-status), `~/.wavex-os/instances/default/companies/*/onboarding/*.json` (manifest health).
- Detects: dead-letter T2 errors, stuck inception phases, manifests with goal=null, Stripe webhooks not arriving for >24h, Composio toolkits with no connections in N days.
- Fixes: routes critical errors to the operator's Telegram + creates Paperclip issues on a dedicated `WaveX Ops` company.
- Capable model: `claude-opus-4-7` for fix-routing, falls back to Sonnet for fast triage.

This is the "system reliability" agent we scaffolded earlier (`Phase G.1`) — productionizing it.

---

## T6 — DB Analysis + Expert Agent Marketplace Planning (~1 day discovery)

Pull and analyze what's actually in Supabase + decide which Expert Agents to offer next.

### Steps

1. **Snapshot every `wavex_os.*` table** (subscriptions, hired_expert_agents, fleet_digests, injection_queue_v2, digest_access_log, usage_ledger, optimizer_runs).
2. **Cross-reference with mock-core companies** to identify which fictional fleets are most consistent with real customer profiles we saw via the wizard.
3. **Map agent demand**: what specific KPIs are operators trying to move? What workflows do they already run manually (Pillar 4 lead sources, Pillar 5 comm channels)?
4. **Propose 6-10 new Expert Agents for the marketplace**, prioritized by:
   - How often the workflow surfaces in pillar responses
   - How much T2 cost the agent saves (high-frequency + high-token tasks first)
   - How well-bounded the agent's authority is (Liaison-mediated, scope-tagged, revocable)

Candidates from PR review:
- **Demand-Gen Agent** — content cadence for content-seo lead sources
- **Outbound Cadence Agent** — for outbound-cold lead sources
- **Concierge Handoff Agent** — for assisted_demo motions
- **Founder Coach Agent** — for prototype-stage operators (post-Pillar 1 nudges)
- **Investor Update Agent** — for live-paying-customers stages
- **Compliance Sweep Agent** — for fintech/healthtech industries
- **CRM Hygiene Agent** — for HubSpot/Salesforce-connected fleets

---

## Track Priority + Sequencing

| Order | Track | Why first |
|---|---|---|
| 1 | T1 (Stripe Dashboard config) | 15 min, unblocks revenue |
| 2 | T2.1 + T2.2 (goal.kpiId + signed_at) | <2h, fixes visible KPI scoreboard |
| 3 | T2.4 (Force first cycle handler) | <1h, makes InceptionCTA's secondary action real |
| 4 | T6 (DB snapshot + agent demand map) | research output informs T3 + T5 |
| 5 | T5 (WaveX Ops agent) | ops layer for the existing fleet — high leverage |
| 6 | T4 (Paperclip plugin scaffold) | unblocks WaveX-branded dashboard |
| 7 | T3 (Pool B BYO OAuth) | architecturally biggest; do last |

Each track is independently shippable.

---

## Session log — 2026-05-13 (autonomous QA + fix loop)

### What shipped this session (chronological)

| Commit | Track | Summary |
|---|---|---|
| `997a019b` | T2.1 | finalize populates `goal.kpiId` (from stage-baselines) + `signed_at` (= `finalized_at`) |
| `a1685229` | T2.3 + T2.4 | mock-core `GET /api/companies/:id/agents` + `POST /trigger-heartbeats` |
| `f5f8ef68` | T1 + T6 | Stripe webhook RPC COALESCE + trial fallback + Stripe re-fetch; marketplace v2 doc with 8 candidate agents |
| `30215f11` | T5 | WaveX Ops operator-side reliability cycle + launchd plist + 4 public RPCs |
| `4a768697` | T4 | `@wavex-os/paperclip-plugin-wavex` scaffold (3 UI slots + 3 worker handlers) |
| `2e85d7a7` | inception | `pnpm dev` default boots Paperclip; InceptionCTA polls + auto-activates dashboard CTA |
| `9cd83921` | inception | server-side `/api/paperclip-reachable` probe (kills DevTools spam) |
| `8f940ebf` | QA loop-1 | 6 fixes from comprehensive E2E QA findings: BUG.PROXY_REWRITE (BLOCKER), BUG.T2_LEDGER (HIGH), BUG.NO_INFERENCE_HEALTH (MED), BUG.WAVEX_PLUGIN_NOT_BUILT (MED), driver-gap (LOW), Avatar clarification (LOW) |

### Final QA verdict
- **Happy path: PASS** end-to-end on Solo Founder profile (linear.app). Goal KPI `monthly_recurring_revenue` populated, 35-agent fleet created, Mission Control + InceptionCTA + Paperclip dashboard all reachable.
- **Loop-1 verifications**: 3 of 5 fixes verified live; 2 deferred to next inference-server launchd restart (running binary pre-dates the dist rebuild — expected lifecycle, not a regression).

### Known follow-ups (NOT in scope for this session)
1. **Paperclip plugin install** — `paperclip-plugin-wavex/dist/` builds clean but Paperclip's plugin loader uses a DB-backed registry (`registry.listInstalled()`), not workspace auto-discovery. Plugin needs a registration call via Paperclip's plugin-install API before its slots appear in `/api/plugins`. This is a dedicated wiring task — the scaffold + capabilities are in place.
2. **launchd inference-server restart** — picks up `/health` + `/api/health` aliases and the t2-events.jsonl mirror. Operator runs `launchctl kickstart -k gui/$(id -u)/com.wavex-os.inference-server` when ready.
3. **API-1 (Task #89)** — 4× 404 console errors after Reset (longstanding low-severity).
4. **T3 — Pool B (BYO Claude Max OAuth)** — still deferred; 2-3d architectural work; biggest remaining Phase H track.

