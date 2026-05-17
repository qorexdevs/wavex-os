# What WaveX OS sells

Operator-vision spec, 2026-05-17. The five paid features that justify a WaveX OS
subscription on top of the customer's BYOC Claude bill.

## TL;DR

After the BYOC pivot, the customer pays Anthropic directly for every prompt their
local Claude executes. WaveX OS doesn't sell inference — it sells the
*infrastructure around* inference. Five features:

| # | Feature | Status | Where it lives |
|---|---|---|---|
| 1 | Pool C — Expert Agent injection | ✅ live | `wavex_os.injection_queue_v2` + the four Expert Agent workers under `scripts/` |
| 2 | Mission Control fleet visibility | ✅ live | `wavex_os.instance_health` + admin Paperclip agents under `scripts/ops/admin-instance/` |
| 3 | Manifest persistence + cross-machine sync | ✅ live (commit `818f3163`) | `wavex_os.company_manifests` + `stagePullManifest` in `scripts/wavex-bootstrap.mjs` |
| 4 | Connector marketplace | ✅ live (commit `543243e2`) | `packages/wavex-os-server/src/routes/connectors-marketplace.ts` + `ConnectorsMarketplaceWidget` in the Paperclip plugin |
| 5 | Pool A free-tier fallback | ✅ live | `tier-router` → hub Pool A (operator's Claude Max, capped) |

All five are buildable + verifiable without touching the customer's inference path.

---

## 1. Pool C — Expert Agent injection

**What it is.** Customers' agent fleets emit redacted *digests* of their activity
(token spend, KPI movement, blocked issues) to Supabase. Operator-side Expert
Agent workers process those digests with the operator's Claude Max, then push
back **structured fixes** as code changes / db migrations / role tweaks. The
fixes get queued in `injection_queue_v2` and the customer's Liaison agent picks
them up on its next heartbeat.

**Why customers pay.** Cross-fleet pattern detection — every customer's fleet
learns from every other customer's recovered failures. The operator's inference
cost is amortized across all subscribers.

**Pieces that already ship:**

- `wavex_os.injection_queue_v2` — sealed-box-encrypted injection records.
- Four Expert Agent worker scripts: optimizer, alignment, error-handler,
  concierge (in `scripts/`).
- `wavex_os.fleet_digests` + the Liaison agent template that emits them.
- `wavex_os.injection_outcomes` to close the loop: did the customer act on the
  injection, and did the targeted KPI move?

**Customer touchpoint.** The `Expert Agents Status` dashboard widget in the
Paperclip wavex-os plugin shows the catalog + the customer's active hires.

---

## 2. Mission Control fleet visibility

**What it is.** Every paying customer's local daemon (`wavex-local-ops-cycle.mjs`)
posts a state row to `wavex_os.instance_health` every 5 minutes. The operator
side has a dedicated Paperclip "Mission Control" instance with three admin
agents (Customer Success Engineer, Platform Reliability Engineer, Build
Engineer) that read those rows + act on degraded fleets.

**Why customers pay.** Their fleet is *watched* — when something breaks, an
operator agent files an issue, sometimes auto-fixes via injection, and (when it
can't) Telegrams the operator who can escalate to a human fix.

**Pieces that already ship:**

- `wavex_os.instance_health` table (commit `c465e2bd`).
- The `os-instance-health` edge function that the customer daemon POSTs to.
- The three Mission Control agents under `scripts/ops/admin-instance/agents/`.
- The `wavex_os_admin_customer_overview` RPC the agents read from.

**Customer touchpoint.** The customer never sees Mission Control directly —
they see its effects: doctor invocations on their machine, Telegram
escalations, and the "fleet status" chip on `~/.wavex-os/local-ops-state.json`.

---

## 3. Manifest persistence + cross-machine sync

**What it is.** When the customer finishes onboarding, their signed company
manifest gets upserted to `wavex_os.company_manifests`. When they re-bootstrap
on a new machine, `stagePullManifest` in the bootstrap pulls every manifest
they own (via auth.uid()-scoped RPC) and writes it to local disk. Paperclip
boots with the existing fleet — no re-onboarding.

**Why customers pay.** Their data isn't trapped on the laptop they happened to
install on first. Same fleet on every device.

**Pieces that ship as of commit `818f3163`:**

- `wavex_os.company_manifests` table + RLS policies (existing).
- Write path: `wavex_os_record_company_manifest` SECURITY DEFINER RPC, called
  by `/activate` (existing).
- READ path (new): `wavex_os_get_my_company_manifests` SECURITY DEFINER RPC,
  filters by `auth.uid()`, GRANT execute to `authenticated`.
- Bootstrap stage `stagePullManifest` — reads device-token, calls RPC,
  writes any missing/divergent manifests to disk. Idempotent. Never destroys
  in-progress work.

**Customer touchpoint.** Bootstrap line:
`[wavex-os] cloud manifest sync         ✓ restored 1 company manifest`

---

## 4. Connector marketplace

**What it is.** A Paperclip wavex-os plugin dashboard widget that lists every
FEATURED_TOOLKIT from `@wavex-os/composio-shim` annotated with:
- Best-available path: MCP / OAuth / API key
- Current state for the active company: connected / pending / available /
  needs key / skipped
- One-click "Connect" button → deep-link to the connector's setup docs (v1)
  or OAuth popup (v2).

**Why customers pay.** Discovery: customers don't need to know which OAuth
flow each connector wants. The marketplace hands them the cleanest path
already-known to work.

**Pieces that ship as of commit `543243e2`:**

- NEW route: `GET /api/connectors/marketplace?companyId=auto` in
  `packages/wavex-os-server/src/routes/connectors-marketplace.ts`. Merges
  FEATURED_TOOLKITS with live vault state via `listConnectorStates`.
- NEW plugin worker handler `connectors-marketplace` — proxies the marketplace
  route from the Paperclip plugin sandbox.
- NEW dashboard widget `ConnectorsMarketplaceWidget` registered on slot
  `wavex-connectors-marketplace`. Renders a category-grouped table with status
  badges + Connect buttons.

**Customer touchpoint.** Paperclip dashboard, "WaveX Connectors Marketplace"
widget. Surfaces the catalog without ever leaving the running agent dashboard.

---

## 5. Pool A free-tier fallback

**What it is.** When the customer hasn't BYOC'd Claude yet (no `claude auth
login`, no `ANTHROPIC_API_KEY`), the wizard's "Suggest" buttons fall through
from Pool B (local claude) to Pool A — operator-side, rate-limited, capped
Claude Max calls via the hub. Each anonymous install gets a handful of free
suggestions before the wizard nudges them to BYOC.

**Why customers pay.** Lower-friction first-touch. They can poke around the
wizard without setting up Anthropic auth first.

**Pieces that already ship:**

- `tier-router` from the vendored wavex-os plugin — routes T2 calls through
  the hub when `WAVEX_INFERENCE_MODE=hosted`.
- Hub Pool A inference endpoint backed by operator's Claude Max OAuth.
- `daily_cap_cents` in the inference-server's admin config gates total spend.
- Onboarding-ui `api.ts` already has the fallback chain:
  `suggest-pool-b` (BYOC) → on 502 → `suggest` (Pool A through tier-router).

**Customer touchpoint.** Invisible to authenticated customers — they always
get Pool B. Free-tier visitors get suggestions until the cap; then the wizard
shows a "Sign in or install Claude to keep going" gate.

---

## Pricing implication

The five features map cleanly to tiers:

- **Founder** ($X/mo) — Mission Control + Manifest sync + Marketplace.
  Customer brings their own Claude (BYOC). They pay Anthropic, we provide
  infra.
- **Growth** ($Y/mo) — adds Expert Agent injection. The cross-fleet pattern
  detection is the differentiator — we burn operator Claude on every paying
  customer's digests.
- **Free** — Pool A wizard suggestions (rate-limited) + marketplace browsing.
  No daemon, no manifest cloud-sync, no Expert Agents. Designed to convert.

Suggested next discussion: pin the actual $ amounts + cap counts.
