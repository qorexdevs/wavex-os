# Chat-First Onboarding — Smoke Test

End-to-end happy path for the new `/onboarding-chat` shell. Run after pulling `feat/op-omega-chat-first`.

## Setup

```bash
# Boot the 4-service dev stack.
pnpm dev                                    # wavex UI on :5173, mock-core on :3101
node packages/core/dist/index.js            # Paperclip server on :3100 (in another terminal)
pnpm --filter @paperclipai/onboarding-ui dev # Paperclip UI on :5174 (in another terminal)

# Optional — wipe state for a clean run:
rm -rf ~/.wavex-os/instances/default/companies/ricoma
```

Both `/onboarding` (legacy wizard) and `/onboarding-chat` (new shell) are live. The smoke test below exercises only the new path.

## Happy path

| Step | Action | Verify |
|---|---|---|
| 1 | Open `http://localhost:5173/onboarding-chat` | Top bar shows progress (0%) + TokenCounter (0 tokens) + BudgetChip. Chat shows: *"Tell me about what you're building. Drop a URL, a GitHub repo, or just describe it — I'll take it from there."* with input focused. |
| 2 | Type `ricoma.com` → Enter | User bubble appears. Assistant follows with *"Got it. Reading your site…"* and an inline `T2ProgressIndicator` showing real elapsed time. URL changes to `?companyId=ricoma&phase=pillar-1`. TokenCounter ticks. |
| 3 | Wait 60–180s for Pillar 1 | Thinking bubble collapses; a new assistant bubble appears with **Pillar1ConfirmCard** — chip selectors for Industry, Business model, Product status, plus the inferred `company_context` paragraph. |
| 4 | Click "Looks right — keep going →" | Card hits `/pillar/1/edit` if anything was edited (no T2 cost), then collapses. Pillar 2 silently fires in the background. Chat shows *"Where are you in the product journey?"* with **Pillar3PromptCard** chips. |
| 5 | Tap *Live with paying customers* → revenue chips appear → tap *$10K – $100K MRR* → Continue | POST `/pillar/3` succeeds. Chat advances with *"How do leads come in?"* and **Pillar4PromptCard**. |
| 6 | Tap *Inbound ads* + *Referral* → tap `+ Other` → type `TikTok ads` → tap *Assisted (demo required)* → tap *Mostly phone/video* → Continue | POST `/pillar/4` succeeds with `lead_sources: ["inbound_ads_meta_google", "referral_word_of_mouth", "other"]`, `lead_source_other: "TikTok ads"`. Chat advances with **Pillar5PromptCard**. |
| 7 | Tap *Telegram* → fill bot token + chat ID → tap *Daily digest + urgent to phone* → Continue | POST `/pillar/5` succeeds. Chat shows *"Got it. Let me figure out what to plug in…"* then **ConnectorPickerCard** (required / suggested / deferred buckets). |
| 8 | Review buckets → click *These look right — plug them in →* | Assistant: *"Vault your credentials below…"*. **CredentialDrawer** slides up over the chat. |
| 9 | Vault 2-3 keys, skip 1 with reason "Will configure later from Mission Control", click *Done — continue to swarm →* | Drawer dismisses. Assistant: *"Connections vaulted. Assembling your AI team…"* with `phase-3` progress indicator. |
| 10 | Wait 30–90s for swarm | Full-screen **SwarmStudio** takes over the screen. 33+ nodes render via OrgGraph. Tap a node → AgentSwapPanel opens. Click `+ Add agent` → AgentAddPanel opens. Footer reads "33 agents". |
| 11 | Click *These look right — wire them up →* | `startWorkflowPrefetch(companyId)` fires in background. **ImprintTheater** takes full screen. Shows *"Preparing your launch"* with real `T2ProgressIndicator` for finalize phase. |
| 12 | Wait 60–240s for finalize | **Act 1** plays: 5-strategy MC race animates for ~8s, winner curve highlights. **Act 2** (~3s): large strategy name + 3 stat tiles (MRR growth, P(auto-catalytic), P(ruin)). **Act 3**: imprint prose streams char-by-char. "[Read the full signed manifest]" reveals sha256 + JSON. |
| 13 | Click *Let's launch →* | Pricing dialog appears over dimmed Theater. 4 tier cards; Founder highlighted "Most popular". |
| 14 | Click *Subscribe* on Founder (or *Skip*) | Dialog dismisses. **ActivateProgress** takes full screen. Slots animate green slot-by-slot via the 200ms cosmetic stagger. |
| 15 | Click *Open Mission Control →* | Paperclip dashboard opens in new tab at `http://localhost:5174/`. Current tab navigates to `/?companyId=ricoma`. FleetGraph renders the 33+ agents. KPI scoreboard loads. Chief of Staff is visible. |

## Dev flags

- **`?t0=1`**: every T2 call returns deterministic fallback. TokenCounter total stays at $0. Theater Act 3 reads *"(quick draft)"*. End-to-end runtime under 60s.
- **`?companyId=existing-slug`**: shell hydrates from `/op-omega/onboarding/status`. Pillars-1-5 already filled → chat would auto-advance past them (currently v1 just shows a welcome-back bubble; full resume hydration is v2 polish).

## Verifications

- **TokenCounter accumulates** during streaming T2 phases (Pillar 1, Connector, Swarm, Workflow, Imprint).
- **Workflow prefetch race**: with the SwarmStudio confirm and ImprintTheater, the workflow_manifest.json mtime should be within the last 10 minutes when finalize hits the route. Check by tailing the server logs — finalize should NOT call `generateWorkflowManifest` directly when prefetch succeeded; instead it reads from disk.
- **Real elapsed time** in `T2ProgressIndicator`, not fake stage labels. Confirm by setting a long process — the bar reflects actual seconds and ETA percentile.
- **No vendor modifications** — `vendor/op-omega/**` byte-identical to upstream.

## Known limitations (v1)

- Activate progress is single-batch (response arrives → slots flip green with 200ms stagger). Real progressive activation is v2.
- `?companyId=` resume hydrates the URL but not the conversational history. Operator sees a welcome-back bubble rather than collapsed prior pillars.
- Pillar 2 silent verify defaults to `claude_plan=max_20x`. Operators on `max_5x`/`api_only` plans must currently edit the request directly. v2: gate the assertion behind a chat clarifier when verify fails with `wrong_plan` hints.
- Model-per-phase env dial is not yet shipped (race condition + spawn-shim work needed). Tracked as a deferred backlog item.
