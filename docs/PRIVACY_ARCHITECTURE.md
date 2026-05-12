# Privacy & Data-Flow Architecture

How data moves through WaveX OS, by tier. The headline rule:

> **Free tier: nothing leaves your localhost.
> Paid tier: data leaves only as far as the specific Expert Agent you hired.**

This is not a marketing claim. It is enforced by the topology below.

---

## Tier 1 — Free (the open-source default)

```
                          ┌─────────────────────────────┐
                          │  CUSTOMER'S MAC (localhost) │
                          │                             │
   Operator inputs ───▶   │  wavex-os wizard (5173)     │
   (pillars, comms)       │      │                      │
                          │      ▼                      │
                          │  mock-core (3101)           │
                          │      │ activate             │
                          │      ▼                      │
                          │  Paperclip (3100)           │
                          │      │ heartbeats           │
                          │      ▼                      │
                          │  claude CLI                 │
                          │      │ via OAuth wrapper    │
                          │      ▼                      │
                          │  macOS Keychain ─── token   │
                          │      (Claude Max OAuth)     │
                          └───────────│─────────────────┘
                                      │
                                      ▼  (only this single arrow leaves the box)
                              Anthropic API
                              (transient inference,
                               no training, customer's
                               existing Claude Max ToS)
```

**What leaves the customer's Mac in this tier:**
- Inference calls from the customer's OWN Claude Max OAuth → Anthropic. Same data path your agents already use today. Already covered by the customer's existing Claude Max ToS.

**What does NOT leave:**
- Fleet digests, KPI snapshots, issue bodies, agent state, error logs, prompts. NONE of it. The operator's localhost is the entire trust boundary.

**What we (WaveX) see:**
- Zero. There is no telemetry, no install pingback, no analytics. GitHub clone count + npm downloads is our only signal of usage.

**Landing-page claim that is 100% true at this tier:**
> *"Your data, your inference, your machine. WaveX OS runs entirely on your localhost; nothing is sent to WaveX."*

---

## Tier 2 — Paid (Hire a WaveX Expert Agent)

The moment the operator hires their first Expert Agent (Optimizer / Alignment / Error Handler / Concierge), a second data path activates. The hire flow makes this explicit: "Hiring this agent means it will read [scope] from your fleet. By proceeding, you agree to the Expert Agent Processing Agreement."

```
   ┌─ CUSTOMER'S MAC (localhost) ─────────────────────────────────┐
   │                                                              │
   │  Paperclip fleet (Pool B — still local, unchanged)           │
   │      │                                                       │
   │      │ heartbeats                                            │
   │      ▼                                                       │
   │  ─────────────────────────────────────────────────────       │
   │  WaveX Liaison agent (new, hired automatically when          │
   │  customer subscribes; runs in customer's Paperclip):         │
   │                                                              │
   │   every 5 min:                                               │
   │    1. Read local fleet state                                 │
   │    2. Build digest (kpi_snapshots + open_issues + ...)       │
   │    3. For each hired Expert Agent, encrypt ONLY              │
   │       the fields in that agent's scope_tags using            │
   │       the agent's public key (libsodium sealed-box)          │
   │    4. POST {field_envelopes} to api.wavex-os.com             │
   │  ─────────────────────────────────────────────────────       │
   │                            │                                 │
   └────────────────────────────│─────────────────────────────────┘
                                │   trust boundary #1
                                │   (customer → WaveX server)
                                ▼
   ┌─ api.wavex-os.com (operator's Mac via Cloudflare Tunnel) ────┐
   │                                                              │
   │   Fastify inference-server :8787                             │
   │      │                                                       │
   │      ▼                                                       │
   │   Supabase: wavex_os.fleet_digests                           │
   │     - field_envelopes stored encrypted-at-rest               │
   │     - 24h TTL (auto-delete)                                  │
   │     - RLS: customer reads own audit log only                 │
   │                                                              │
   │   Per-catalog Expert Agent worker (one per Expert Agent      │
   │   type — Optimizer, Alignment, Error Handler, Concierge):    │
   │                                                              │
   │      For each subscription that hired ME:                    │
   │       1. Fetch latest fleet_digest                           │
   │       2. Decrypt ONLY the field_envelopes addressed to MY    │
   │          public key (other agents' envelopes stay sealed)    │
   │       3. Write digest_access_log entry: "I, optimizer-v1,    │
   │          read fields [a,b,c] for subscription_id X at T"     │
   │       4. Construct prompt with decrypted snippet in a        │
   │          fenced UNTRUSTED-DATA block (prompt-injection       │
   │          defense)                                            │
   │       5. Call Anthropic API ─────────────────────┐           │
   │       6. Write usage_ledger row                  │           │
   │       7. Write injection to                      │           │
   │          wavex_os.injection_queue for customer   │           │
   └───────────────────────────────────────────────│──┴───────────┘
                                                   │
                                                   │   trust boundary #2
                                                   │   (WaveX → Anthropic)
                                                   ▼
                                          Anthropic API
                                          (transient inference,
                                           no model training,
                                           30d retention then deleted)

   ┌─ CUSTOMER'S MAC (localhost) ─────────────────────────────────┐
   │                                                              │
   │  Liaison agent (continued):                                  │
   │   every 5 min:                                               │
   │    5. GET api.wavex-os.com/optimizer/queue/<sub_id>          │
   │    6. Verify signed injection payload                        │
   │    7. POST to local Paperclip:                               │
   │       - new issue OR comment on existing issue OR            │
   │         workflow proposal                                    │
   │  ─────────────────────────────────────────────────────       │
   │                                                              │
   │  Operator sees Mission Control:                              │
   │   ┌────────────────────────────────────────────┐             │
   │   │ Privacy panel (always visible)             │             │
   │   │  Today, your data was accessed by:         │             │
   │   │  • optimizer-v1     12:00, 12:15, 12:30    │             │
   │   │    fields: kpi_snapshots, open_issue_titles│             │
   │   │  • error-handler-v1 12:07                  │             │
   │   │    fields: agent_status, failed_runs       │             │
   │   │  • concierge-v1     not hired              │             │
   │   │  [audit log → full history]                │             │
   │   └────────────────────────────────────────────┘             │
   └──────────────────────────────────────────────────────────────┘
```

---

## Trust boundaries (concise)

| Hop | Boundary | What crosses | Customer's protection |
|---|---|---|---|
| Customer Mac → Anthropic (Pool B) | Customer's own Claude Max ToS | Customer's local prompts | Already trusts Anthropic to use Claude Max |
| **Customer Mac → WaveX server** | **Expert Agent Processing Agreement** | **Only the field_envelopes for hired agents (sealed-box encrypted, scope-tag filtered)** | **Explicit opt-in per agent; field-level scope; 24h TTL; audit log** |
| WaveX server → Anthropic (Pool A/C) | Anthropic API Terms | Decrypted snippets that the specific Expert Agent reads | Transient inference, no training, 30d retention |
| WaveX server → Customer Mac | Signed injection envelope | Generated content (comments, new issues, proposals) | Liaison verifies signature before posting to local Paperclip |

The agent-scoped encryption is NOT about Anthropic. It's about:
1. **WaveX server breach** — a compromised Supabase service-role key still can't decrypt without the per-catalog worker's private key (which lives on the operator's Mac Keychain, not in Supabase secrets)
2. **WaveX insider threat** — engineers with prod DB access only see ciphertext; no rogue-engineer "let me peek at customer data" path
3. **Cross-agent leakage** — optimizer-v1 can't read fields scoped to concierge-v1, even though both serve the same customer
4. **Customer auditability** — `digest_access_log` is RLS'd to the customer; they can prove what we read

## Terms of Service implications

**Free tier — "WaveX OS Open Source License (MIT)":**
- One paragraph: "WaveX OS runs entirely on your machine. No data is sent to WaveX, Anthropic uses your existing Claude Max ToS, no telemetry is collected."

**Paid tier — "WaveX Expert Agent Processing Agreement" (new doc, presented at hire-time):**
- Names each Expert Agent the customer is hiring
- Lists the explicit scope_tags that agent has access to (e.g. Optimizer: `kpi_snapshots`, `open_issue_titles`; Concierge: all of the above plus `issue_bodies`)
- States 24h TTL on fleet_digests
- Promises agent-scoped field-level encryption
- Customer can revoke (un-hire) at any time; we delete pending digests within 1 hour
- Anthropic sub-processor disclosure (standard SOC2 language)
- No third-party data sharing; no advertising use; no model-training use

The customer cannot subscribe without checking the agreement. Each Expert Agent hired is a separate consent event.

## What this changes in the build plan

**Unchanged** from yesterday's Plan A:
- Schema migration (`expert_agent_catalog`, `hired_expert_agents`, `digest_access_log`, `field_envelopes`, `ttl_at`)
- 4 catalog seed entries (Optimizer, Alignment, Error Handler, Concierge)
- Pricing-page "Hire your first agent" flow after Checkout
- Mission Control Privacy Panel reading from `digest_access_log`

**New deliverables** justified by this doc:
- `docs/legal/EXPERT_AGENT_PROCESSING_AGREEMENT.md` — the actual agreement text
- `docs/legal/OPEN_SOURCE_NOTICE.md` — the free-tier privacy statement (the one paragraph)
- A renderer in the pricing page that shows the customer's chosen agent's scope_tags + agreement text BEFORE the Stripe Checkout button enables
- The libsodium sealed-box implementation in the Liaison agent (lands with F.4)
- The per-catalog Edge Function workers in Supabase (one per Expert Agent type)

## Open questions to lock down before F.4 ships

1. **Public key publication.** Each Expert Agent's public key needs to be checkable by the Liaison without trusting Supabase. Options:
   - Publish in `expert_agent_catalog.public_key` (Supabase row, trust-on-first-use)
   - Hardcode in the wavex-os binary at release time (worse for rotation, better for security)
   - Recommendation: catalog row + Liaison pins the key on first hire (warns on change)

2. **Key rotation.** If we need to rotate `optimizer-v1`'s private key, every active subscription's existing digests are unreadable. Need a `optimizer-v2` migration path. Lands in v0.4.

3. **Customer "I want to download everything you have on me" request (GDPR).** Easy answer with this design: `select * from wavex_os.fleet_digests + digest_access_log + injection_queue where subscription_id = ?`. We already have all the data scoped per-subscription.

4. **Customer "I want you to delete everything" request.** `delete from wavex_os.fleet_digests where subscription_id = ?` + cancel subscription. 1h max delay. Already supportable.

5. **Anthropic compelled disclosure.** If Anthropic gets a subpoena that includes our API key's recent inference, our customers' decrypted snippets are in scope. Mitigation: the snippets are minimal (only the scoped fields per cycle), Anthropic deletes after 30d. Document this in the agreement.

---

## Diagram TL;DR

```
   FREE TIER:           CUSTOMER MAC ───── localhost wall ─────  Anthropic
                        (everything on this side)              (customer's own Claude Max)


   PAID TIER:           CUSTOMER MAC ─── encrypted envelope ──▶  WaveX server  ─── snippet ──▶  Anthropic
                          ▲                                          │                          (WaveX's API key)
                          │                                          │
                          └──── signed injection ────────────────────┘

                        (Expert Agent decrypts ONLY its scope; audit row written for every read)
```

The same Anthropic data-flow concerns apply identically in both tiers; the difference is WHOSE relationship with Anthropic is involved. In free tier it's the customer's. In paid tier it's WaveX's, governed by the Processing Agreement.
