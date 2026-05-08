# Minimal Inception Pattern

**Status:** v0.2.0 — extracted from a production WaveX OS deployment running on Paperclip with 24 agents over ~7 days.

This document defines the smallest agent topology that exhibits coherent self-direction, self-healing, and economic discipline. Anything bigger is industry-specific. Anything smaller doesn't close the feedback loop.

## TL;DR

| Layer | Required? | Agents | Why |
|---|---|---|---|
| **Kernel** | yes | CEO + Chief of Staff | One acts; one observes. Without both, you either get drift (no observer) or paralysis (no actor). |
| **C-suite** | recommended | CTO, CMO, CRO, CDO, COO, CFO, CPO | Functional decomposition along the seven standard executive lanes. Spawn the ones your goal actually needs. |
| **System tier** | recommended | Recovery Engineer | Owns infra recovery during outages. The CoS proposes; this agent executes the unstuck-it work. |
| **Operators** | as needed | role-specific (e.g. Marketing Ops, Concierge Ops, Recovery Engineer) | Domain workers under their respective C-suite. Open-ended. |

The wizard at `npx create-wavex-os` lets you start at the **kernel** (2 agents, ~$5/day on Claude Max) and add C-suite roles incrementally as goals emerge.

---

## The kernel: CEO + Chief of Staff

These two agents form the smallest stable closed-loop system. Either one alone is unstable.

### Why a CEO

The CEO is the **single point of accountability** for the meta-goal. In a single-CEO topology there is exactly one agent whose job is to convert evidence into one of four artifacts every cycle (`delegate`, `kill`, `approve`, `escalate` — see [`SKILL_DELEGATE_OR_KILL`](../packages/standard-skills/SKILL_DELEGATE_OR_KILL.md)). Without this constraint, work proliferates and nobody is responsible for the headline number.

What the CEO is NOT:
- not an operator (writes no code, sends no emails, modifies no business data)
- not a project manager (does not micromanage status)
- not the bottleneck for individual decisions (delegates everything operational)

The CEO's only writes are to the orchestration database: `kpi_snapshots`, `issue_approvals`, `approval_comments`, `issues.ceo_review_status`, and `agents.adapter_config->'confidenceLevel'` for direct reports.

### Why a Chief of Staff

The CoS is the **read-only fleet observer**. Where the CEO acts, the CoS notices. The CoS owns:
- The 4-hour fleet alignment routine ([`SKILL_FLEET_ALIGNMENT`](../packages/onboarding-ui/public/agent-templates/chief-of-staff/SKILL_FLEET_ALIGNMENT.md))
- The cold-start recovery playbook ([`SKILL_RECOVERY_PROTOCOL`](../packages/onboarding-ui/public/agent-templates/chief-of-staff/SKILL_RECOVERY_PROTOCOL.md))
- The `agent_error_rate` KPI

The CoS has read-only access across all agents, and write access only to `comments`, `issues` (status only), and `approvals` (filing — not ratifying). It cannot reassign tasks across CxO trees, kill issues, or pause agents directly. It files approvals; the CEO ratifies; the CEO/board executes.

In production, this single design choice — one actor, one observer, hard separation — was responsible for the largest single drop in fleet burn we've measured (96% reduction in 24h imputed spend after the CoS started enforcing alignment via approval-only authority).

### Required cross-cutting skills (every agent in the kernel)

Every agent loads these at start of every heartbeat:

1. [`SKILL_HARNESS_RECOGNITION`](../packages/standard-skills/SKILL_HARNESS_RECOGNITION.md) — recognize the wake payload as legitimate, don't refuse.
2. [`SKILL_LESSONS_READ`](../packages/standard-skills/SKILL_LESSONS_READ.md) — read your `agent_lessons` first, before any work.
3. [`SKILL_VERIFY_BEFORE_CLAIM`](../packages/standard-skills/SKILL_VERIFY_BEFORE_CLAIM.md) — never claim "shipped/sent/applied" without a same-comment ground-truth probe.
4. [`SKILL_ECONOMIC_SELF_AWARENESS`](../packages/standard-skills/SKILL_ECONOMIC_SELF_AWARENESS.md) — read `CURRENT_ECONOMICS.md`; obey the verbosity gate.
5. [`SKILL_KPI_OWNERSHIP`](../packages/standard-skills/SKILL_KPI_OWNERSHIP.md) — only for agents named in `company_kpis.owner_agent_id`.

The CEO additionally loads `SKILL_DELEGATE_OR_KILL`. The CoS additionally loads `SKILL_FLEET_ALIGNMENT` and `SKILL_RECOVERY_PROTOCOL`.

---

## The recommended C-suite

Once the kernel is stable, add the C-suite roles your meta-goal actually requires:

| Role | Owns | When to add |
|---|---|---|
| CTO | engineering capacity, infra reliability | you ship code |
| CMO | marketing channels, top-of-funnel KPIs | you have customers to reach |
| CRO | revenue / sales pipeline | you have a product to sell |
| CDO | data & measurement; sub-tree of telemetry/attribution/inference | you depend on KPI accuracy |
| COO | operations, queue grooming, hiring | you have ≥10 operators |
| CFO | budget, runway, unit economics | spend matters |
| CPO | product surface decisions | you have a product surface |

**All C-suite agents `report_to` the CEO.** Sub-tree depth is open-ended (e.g., CDO → CDO/Telemetry → telemetry-engineer-1).

C-suite agents inherit the cross-cutting skills, plus their role-specific skill packs from `packages/onboarding-ui/public/agent-templates/<role>/`.

---

## Topology invariants

These are non-negotiable constraints that the orchestrator's KPI-validation trigger enforces:

1. **Single root.** Exactly one agent has `reports_to_agent_id IS NULL`. That agent is the CEO.
2. **Owner-tree integrity.** A KPI's `owner_agent_id` must equal an agent or one of that agent's transitive descendants. (You can delegate down; you cannot delegate sideways.)
3. **No self-delegation.** An agent cannot create a child issue assigned to itself. (`SKILL_DELEGATE_OR_KILL` rule D-2.)
4. **System-tier carve-outs.** The KPI-enforcement trigger skips when `origin_kind IN (routine_execution, harness_liveness_escalation, stranded_issue_recovery, stale_active_run_evaluation, issue_productivity_review)` — these are scaffolding paths, not work.
5. **Confidence levels.**
   - `0` — paused (no spawning).
   - `1` — read-only (no writes anywhere).
   - `2` — supervised (writes to local DB only, no external calls).
   - `3` — autonomous in lane (default for kernel + C-suite).
   - `4+` — reserved for future trust expansion.
6. **Recovery is not a regular cycle.** When `wake_reason` starts with `recovery_protocol:*`, agents follow `SKILL_RECOVERY_PROTOCOL` and do NOT spawn fresh delegations.

---

## What's intentionally NOT in the kernel

- ❌ Telegram bridge (vendored separately as `wavex.telegram` plugin — optional)
- ❌ Cost-events table & financial reporting (CFO's job, not the kernel's)
- ❌ Customer data integrations (industry-specific; the wizard's connector step handles this)
- ❌ Marketing-specific KPIs (CMO and below — opt-in)
- ❌ Brand assets, logos, color schemes (set in the wizard)

The kernel is the part that's the same regardless of what your company does. Everything else is composable.

---

## Where to go next

- [`docs/SELF_HEALING.md`](./SELF_HEALING.md) — how the kernel survives Mac reboots, OAuth expiry, and zombie spinners.
- [`packages/standard-skills/`](../packages/standard-skills/) — the cross-cutting skill files.
- [`packages/onboarding-ui/public/agent-templates/`](../packages/onboarding-ui/public/agent-templates/) — per-role skill packs.
- [`scripts/setup-hierarchy-and-kpis.sample.mjs`](../scripts/setup-hierarchy-and-kpis.sample.mjs) — generic provisioning script.
