# C — Mac-as-Inference-Server for WaveX OS

**Status:** Architectural proposal, 2026-05-12
**Author context:** Phase F monetization, Pools A (onboarding T2) + C (Optimizer) served from operator's Mac; Pool B stays customer-local
**Target:** technical operator, not marketing

---

## 1. Topology

```
                          [Customer Mac (anywhere)]
                          wavex-os local fleet
                          Liaison agent + onboarding wizard
                                   |
                                   |  HTTPS
                                   v
                          api.wavex-os.com  (Cloudflare DNS)
                                   |
                                   |  Cloudflare Tunnel (cloudflared)
                                   v
                          [Your Mac, M-series, 16/32GB]
                          ┌────────────────────────────────┐
                          │ launchd: cloudflared           │
                          │ launchd: wavex-inference-api   │
                          │   Fastify 4.x on 127.0.0.1:8787│
                          │   - /v1/onboarding/t2 (Pool A) │
                          │   - /v1/optimizer/*   (Pool C) │
                          │   - /v1/health                  │
                          │ Anthropic SDK <- Keychain OAuth │
                          │ Redis (Homebrew) for rate limits│
                          └────────────────────────────────┘
                                   |
                                   |  HTTPS (REST)
                                   v
                          Supabase wavex-os-prod
                          - users, subscriptions
                          - api_keys (issued JWTs)
                          - usage_ledger (token accounting)
                          - injection_queue
```

**On the Mac:**
- `wavex-inference-api`: single Fastify process, TypeScript, lives in `packages/inference-server` (new). Binds `127.0.0.1:8787` only — nothing exposed on LAN.
- `cloudflared`: free Cloudflare Tunnel daemon, terminates TLS at Cloudflare edge, proxies to `127.0.0.1:8787`. No port forwarding, no public IP.
- Redis 7 via Homebrew: ephemeral rate-limit counters + idempotency keys.
- launchd plists for both (auto-restart, run-at-load, KeepAlive=true). Reuses the same launchd pattern wavex-os already uses (`templates/launchd/`).
- Anthropic OAuth token: stays in macOS Keychain, accessed by the Fastify process the same way the Claude Max wrapper does today.

**At api.wavex-os.com:**
- Cloudflare DNS record (CNAME → tunnel UUID, $0). Cloudflare Tunnel handles TLS cert (auto-renewed), DDoS scrubbing at edge, basic WAF.
- No origin server. The tunnel IS the public surface.

**Supabase's role:**
- Source of truth for subscription state + JWT issuance (already wired in Phase F.1).
- Token usage ledger (write-through from Fastify after each Anthropic call).
- The Mac queries Supabase on cold start to load the active subscription roster into an in-memory cache (refresh every 60s).
- Does **not** sit in the inference hot path — too much latency to round-trip Supabase per request.

---

## 2. Auth Flow

**Pool A (onboarding T2 — anonymous, rate-limited):**

The onboarding wizard runs before the customer pays. They have nothing to sign with. Flow:

1. Wizard requests an ephemeral token from `POST /v1/onboarding/session` with `{email, install_id}` (install_id = UUID generated at first run, persisted in `~/.wavex-os/install.json`).
2. Server issues a 30-minute HS256 JWT bound to `install_id`. Returned via Cloudflare Turnstile challenge — invisible captcha, free, blocks scripted abuse.
3. T2 calls (Monte Carlo enrichment, decision matrix) carry `Authorization: Bearer <ephemeral>`. Rate limit: **20 T2 calls per install_id, total, ever**. Hard cap. The full onboarding pipeline needs ~6–8 T2 calls, so 20 is 2.5× headroom for retries and resumes.

**Pool C (System Optimizer — JWT, subscription-gated):**

1. After Stripe Checkout completes, the `stripe-webhook` Supabase function mints a long-lived (90-day, rotating) RS256 JWT with claims `{sub_id, tier, exp, pools: ["C"]}`. Returned via the existing `subscription.json` flow.
2. Liaison agent on the customer Mac uses this JWT to poll `/v1/optimizer/queue/<sub_id>` and to request fresh injection generation via `/v1/optimizer/generate`.
3. Server validates: signature, exp, subscription `status='active'` in Supabase cache. If subscription lapsed → 402 Payment Required → Liaison idles (already specified in Phase F memory).

**Both pools log every request to Supabase `usage_ledger`** (request_id, pool, install_id/sub_id, tokens_in, tokens_out, $cost, ts). Async fire-and-forget write; failure is non-blocking but alerted.

---

## 3. Inference Transport — Anthropic API key vs Customer's OAuth (Pool B model)

This is the call.

**Option A: Mac uses your Anthropic API key (or your Claude Max OAuth) for Pools A + C.**
- Every token billed to you.
- Operator-side, single OAuth/key, simple.
- Subject to your Claude Max 5-hour rate window (480K–960K tokens for Max 5×, 1.92M–3.84M for Max 20×). One viral demo could saturate it.

**Option B: Customer's OAuth proxied through Mac, for Pool C only.**
- Customer's Liaison agent forwards their Claude Max OAuth token to the Mac, which calls Anthropic on their behalf for Optimizer generation.
- Zero token cost to you. Margin → ~95%.
- **Why this is wrong for Pool C:** the customer paid you $29–$299/mo *specifically* so you'd handle expert-layer inference outside their quota. Burning their Max quota on your product features defeats the value prop. Also: passing their OAuth bearer over the wire (even TLS) is an exfiltration surface that the customer will fail a security review on. Composability is bad too — you can't aggregate signal across customers if every call hits a different OAuth tier with different limits.
- **For Pool A (onboarding):** the customer doesn't have an OAuth yet — they're literally onboarding. So Option B can't even apply.

**Recommendation: Option A, with your Claude Max 20× OAuth** (already in Keychain) for both Pool A and Pool C. Reasons:
- **Cost:** Max 20× is $200/mo flat, ~3.84M tokens / 5h ≈ 18.4M tokens/day if you fully saturate. At Sonnet 4.6 rates ($3 in / $15 out), that's an effective $90–$150/day of inference for $6.50/day of OAuth subscription. Margin arbitrage is the entire business model.
- **Risk:** Anthropic's TOS on Max specifically allows agentic use on the subscriber's own machine. Serving inference to *other customers* as a paid backend is a grey area. Read the TOS section "Acceptable Use — Reselling" carefully. If it forbids reselling, fall back to a metered Anthropic API key with `ANTHROPIC_API_KEY` and accept the margin compression.
- **Mitigation:** keep both code paths. `INFERENCE_BACKEND=oauth|apikey` env var. Ship with `oauth` for the first 30 customers (you'll know fast if Anthropic complains via 429/account-suspended), flip to `apikey` if needed without code changes.

---

## 4. Rate Limiting + Abuse Prevention

**Pool A (anonymous, the big risk):**
1. **Cloudflare Turnstile** at wizard load — free, invisible-CAPTCHA, blocks 99% of bots before they reach the tunnel.
2. **Per-`install_id`:** 20 T2 calls lifetime, 5 per hour (sliding window in Redis).
3. **Per-IP /24:** 200 T2 calls / hour. Stops a single attacker rotating install_ids from one subnet.
4. **Per-email:** 3 install_ids per email per 30 days. Email collected at wizard step 1 (already part of onboarding).
5. **Daily global Pool A cap:** $10/day. Hard kill switch — if Anthropic ledger crosses $10, /v1/onboarding/* returns 503 until midnight UTC. Set via env, alert via Telegram (already the user's channel).
6. **Token cap per call:** Pool A capped at 8K output tokens. Onboarding T2 doesn't need more.

**Pool C (subscription-gated, the smaller risk):**
1. JWT bound to `sub_id` from Supabase; revoke = `status≠active` in DB → cache invalidates in ≤60s.
2. **Per-tier daily token caps** (see §6).
3. **Idempotency keys** required on /v1/optimizer/generate — same key within 5min returns cached response. Stops the Liaison agent from accidentally double-billing on retry.

**Anti-budget-burn kill switch:** a single `/admin/freeze` endpoint (gated by a static admin token in Keychain) that flips a Redis flag, instantly 503s all inference endpoints. Tied to a Telegram command: `/freeze-inference`.

---

## 5. Reliability — When Your Mac Goes Offline

**It will.** Reboots, sleep, ISP, Cloudflare incidents. SLA from a residential Mac is realistically 95–98%, not 99.9%.

**Graceful degradation:**

**Pool A unreachable during onboarding:**
- Wizard detects 503/timeout on /v1/onboarding/t2 → degrades to **deterministic T1 fallback** (rule-based decision matrix already implemented in `vendor/op-omega/onboarding`). Customer completes onboarding with a 70%-quality manifest instead of 95%. Wizard surfaces a non-blocking toast: "AI enrichment unavailable — using deterministic mode. Re-run from Mission Control later to improve."
- Onboarding NEVER hard-blocks on Pool A. This is non-negotiable.

**Pool C unreachable for paying subscribers:**
- Liaison agent: polling /v1/optimizer/queue returns network error → exponential backoff (30s, 60s, 5min, 30min, capped). Continues attempting forever.
- Inference itself still works (Pool B on customer's Max). The customer's agents keep operating. Only the **expert layer** (injections, course-corrections) is offline.
- Mission Control shows a status pill: `WaveX Optimizer: connecting…` with last-success timestamp. After 24h offline, an in-product banner: "Optimizer has been unreachable for 24h. Contact support if this persists."
- This is acceptable degradation because the customer's core fleet is unaffected.

**Mac-side resilience:**
- launchd `KeepAlive=true` restarts crashed process in <2s.
- `caffeinate -dimsu` wrapper in the plist prevents sleep while the service is bound.
- Cloudflare Tunnel auto-reconnects on network blip.
- Realistic uptime target: **97%** (~22h/month downtime).

**No queueing of failed Pool A requests** — they're synchronous onboarding calls. Customer waits ≤30s or fails over to T1.
**Pool C requests** are pull-based (Liaison polls), so a 30min outage just means the next poll catches up.

---

## 6. Cost Ceiling

Sonnet 4.6 (Optimizer's likely model): $3/M input, $15/M output. Assume 50/50 in/out mix → blended $9/M.

**Margin math at 55% gross margin target:**

| Tier | Price/mo | Allowable infra cost/mo | Inference budget/mo | Tokens/mo (blended) | Tokens/day |
|---|---|---|---|---|---|
| Founder $29 | $29 | $13 | $10 (after Stripe fees, Supabase) | 1.11M | 37K |
| Growth $99 | $99 | $45 | $36 | 4.0M | 133K |
| Custom $299 | $299 | $135 | $110 | 12.2M | 407K |

Hard daily caps per `sub_id` (enforced in Redis):
- Founder: **40K tokens/day**
- Growth: **140K tokens/day**
- Custom: **420K tokens/day**

When a cap hits → /v1/optimizer/generate returns 429 with `Retry-After: <seconds-til-midnight-UTC>`. Liaison parses and idles.

**Mac saturation analysis:**

| Bottleneck | Threshold | When you hit it |
|---|---|---|
| **CPU** | Negligible — Fastify + JSON pass-through is <5% on M-series. Anthropic does the compute. | Never. |
| **RAM** | ~200MB Node + 50MB Redis + ~300MB cloudflared = 550MB. | Never on 16GB. |
| **Network** | Residential ~500 Mbps. Anthropic streaming is ~50KB/s per active request. | ~10,000 concurrent streams. Never. |
| **Anthropic rate limit (your Max OAuth)** | 3.84M tokens / 5h on Max 20× | **~9–10 active Growth subs running optimizer constantly, OR ~30 Founder subs.** This is the real ceiling. |
| **File descriptors / sockets** | macOS default 256, raise to 65K via launchd plist `SoftResourceLimits` | Tens of thousands. Not the bottleneck. |

**Real saturation point: ~25–30 paying subs on Pool C** before you hit Max quota during peak hours. Pool A is bounded by the $10/day kill switch.

---

## 7. Migration Path

Trigger to migrate: any of (a) 30+ paying subs, (b) >2 unplanned outages in a 30-day window, (c) Anthropic asks you to stop reselling Max.

**Lift-and-shift, cheapest → most:**

| Target | $/mo | Lift effort | When to use |
|---|---|---|---|
| **Hetzner CCX13** (2 vCPU AMD, 8GB, dedicated) | $13 | 1 day — same Fastify, swap launchd→systemd, Keychain→sealed Anthropic key file | Default. Boring, durable, EU-fast. |
| **Fly.io** (2 shared-cpu, 1GB) | $5–15 | 1.5 days — Dockerize, .fly.toml, anycast routing. Better for global latency. | If you have customers >300ms RTT from EU. |
| **Railway** | $20+ | 1 day — Dockerfile + railway.json. Easiest UI, most expensive. | If you hate ops. |
| **Cloudflare Workers** | $5 base + per-req | 1 week — rewrite Fastify routes as Worker handlers, swap Redis→KV/DO, can't stream Anthropic SSE the same way. | Not yet — too much rewrite, streaming is awkward. |

**Should you start on a $20 VPS day 1?** See §9.

---

## 8. Top 3 Risks + Mitigations

**Risk 1: Anthropic suspends your Max OAuth for "reselling."**
The Acceptable Use section on Max is ambiguous about backend service use.
*Mitigation:* (a) read the TOS today before any customer is signed up; (b) keep `INFERENCE_BACKEND=apikey` code path ready and tested with $20 of pre-loaded API credit so the fallback is one env-var flip; (c) if you go OAuth, never advertise "powered by Anthropic" to customers — the value prop is the Optimizer, not the underlying model.

**Risk 2: Public endpoint URL leaks → bot army burns the $10/day Pool A cap repeatedly and you blow $300/month on aborted onboardings with zero revenue.**
*Mitigation:* Turnstile + per-email caps + the daily kill switch already handle the worst case at $10/day = $300/mo absolute floor. Add Telegram alert on `daily_cost > $5` so you intervene before it caps. After 2 weeks of real traffic, recalibrate the per-`install_id` lifetime cap from 20 → 10 if abuse pattern emerges.

**Risk 3: Mac goes offline for 12+ hours during a viral moment (you're at a conference, ISP outage, etc.) → 20 new signups fail onboarding, churn the funnel.**
*Mitigation:* (a) the T1 deterministic fallback in §5 means onboarding succeeds at reduced quality even when your Mac is dead — this is the single most important defensive design choice; (b) Telegram alert on health-check failure (poll /v1/health from a free cron — UptimeRobot or BetterStack); (c) keep a Hetzner box pre-imaged with the Fastify Docker image and DNS cutover documented as a 15min runbook.

---

## 9. Recommendation — Ship from the Mac, NOT a VPS

**Ship from the Mac.**

Reasons, in order:

1. **You already have the Mac running 24/7** with your Claude Max OAuth in Keychain. The marginal cost of adding a Fastify process and a cloudflared tunnel is one weekend of work and $0/month. A $20/mo VPS adds $240/year for capability you don't yet need.

2. **Pool C is fundamentally bottlenecked on your Anthropic Max quota, not on compute.** Moving Fastify to a VPS doesn't help — the rate limit is on the OAuth, not the machine. You'd still be capped at ~30 subs either way. The VPS only matters once you switch to `INFERENCE_BACKEND=apikey`, which is itself a migration trigger.

3. **97% uptime is acceptable for a $29/mo product whose core function (the customer's local fleet) is unaffected by your downtime.** Stripe charges $0 to your customer when your Mac is asleep. Their agents keep working. The "expert layer" being down is a degraded-mode, not an outage.

4. **The T1 deterministic fallback in onboarding eliminates the single hard-blocking dependency.** Customers can complete signup even if your Mac is unreachable. This is the design property that makes Mac-hosting safe.

5. **Migration cost is bounded at ~1 day of work** (§7). You don't get architectural lock-in. Start small, migrate when there's evidence (revenue, uptime complaints, Anthropic notice), not before.

**The wrong move** is to provision Hetzner + Anthropic API key + Stripe + Supabase before there are 5 paying customers. That's $50/mo of infra burning while you're still iterating product-market fit. The Mac path keeps your infra cost at $0 incremental until customer #10–15, when the operational pain (caffeinate, sleep, your home internet) starts mattering more than $13/mo.

**Concrete sequencing:**
- **Week 1:** ship the Fastify + cloudflared + Turnstile + Redis stack on the Mac. Pool A only.
- **Week 2:** wire Pool C, JWT issuance from Supabase webhook, Liaison polling.
- **Week 3–8:** sign up your first 10 customers. Monitor: daily cost, uptime, Anthropic 429 frequency.
- **At customer 15 or first Anthropic warning, whichever comes first:** start the Hetzner migration in §7. Have it pre-baked as a 1-day runbook so it's not a panic.

Ship from the Mac. Move when reality forces you to.
