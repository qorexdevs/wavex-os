# Ignition phase — design

The bridge between "agents exist as DB rows" (post-activate) and "agents are producing visible output". Activate is declarative — it writes 34+ rows to `agents`, mirrors them to Paperclip, and stops. The fleet then sits idle because `runtimeConfig.heartbeat.enabled = false` is hard-coded in the handoff (`packages/wavex-os-server/src/bridge/paperclip-handoff.ts:219`) and the `workflow_manifest.on_fire` task list is never converted into actual Paperclip issues. Ignition closes that gap: it seeds first-tasks from the workflow manifest, creates a company-level Goal anchored to Pillar 1, runs a CEO + CoS kickoff cycle, and turns heartbeats on with a staggered cron offset.

**Success criterion:** within 5 minutes of a successful activate, every L·IV agent has at least one assigned issue, the CEO has filed an initial directive, and the operator sees a Mission Control banner reading "Fleet ignited — N agents working, M workflows queued".

## Trigger surface

Ignition runs in **wavex-os-server**, in a new module `packages/wavex-os-server/src/bridge/ignition.ts`, invoked at the **tail of the activate route** (`packages/wavex-os-server/src/routes/activate.ts`) immediately after `handoffToPaperclip`. The activate route returns `{ ok, inserted, paperclipHandoff, ignition }` — Ignition's report becomes a peer to handoff's. This keeps a single HTTP transaction so the operator gets one signal. A separate `POST /api/instance/:companyId/ignite` endpoint provides a re-run path for partial failures and for instances where activate predates this feature. **No launchd job** for Ignition itself — Ignition only *schedules* downstream launchd/heartbeat work; it is not periodic.

## Steps

Sequenced; each step is idempotent against a per-company `ignition-state.json` written next to `paperclip-handoff.json` in `~/.wavex-os/instances/default/companies/<id>/`.

1. **Load workflow manifest.** Read `workflow_manifest.json` from the onboarding dir. Validate against `WorkflowManifest` (`vendor/wavex-os/onboarding/src/schema/workflow-manifest.ts`). Index `agent_workflows[<slot>].on_fire[]` by slot. If missing, surface `ignition.errors[]` and abort with `ok: false` — Ignition refuses to invent work.

2. **Create the Goal.** `GET /api/companies/:id/goals` on Paperclip. If empty, `POST /api/companies/:id/goals` with title from Pillar 1 (`pillar_1.org_name` + `pillar_1.ideal_customer_profile`), body composing `company_context`, `primary_friction_hypothesis`, `differentiator_hypothesis`, and the meta-KPI from `pillar_3.kpi_snapshot_initial`. Persist `goalId` into `ignition-state.json`. Idempotent: existing goals are reused.

3. **Seed first-task issues from the workflow manifest.** For each non-muted slot in `swarm_manifest.agents`, take the **first** `on_fire` task whose `dry_run_gate` is `false` (skip dry-run-gated tasks during the 14-day window — those are validated by gates, not seeded). Create one Paperclip issue per agent via `POST /api/companies/:id/issues` with `assigneeAgentId = slotToPaperclipId[slot]`, `goalId`, `title = "<expected_output> — initial cycle"`, body = task description + linked artifact names. Tag `wavex:ignition-seed:v1` so subsequent ignitions don't double-seed. Tasks where `flow_type=ASN` with a `target` slot are seeded as approval-gated issues with the target's agent as approver.

4. **CEO + CoS kickoff cycle.** Send a wake payload to the CEO agent (`POST /api/agents/:id/wake` on Paperclip) with kickoff context: the Goal id, the seeded issue ids per direct report, and the explicit instruction "Triage initial issues. For each direct report, post one comment on their seeded issue clarifying the success criterion. Do not modify code or external systems on this cycle." Wait for completion (poll `runs` endpoint, 60s timeout). Then wake the CoS with payload "Read the seeded roster. File one approval per drift you detect from `swarm_manifest`. Do not ratify." This is the closed-loop probe — if CEO and CoS both complete, the kernel is alive.

5. **Validate L·IV coverage.** Query the wavex DB for agents at `level='L·IV'` not assigned to any issue. Any slot returned is a coverage gap. If gaps > 0, attempt one retry of step 3 for those slots only. Persistent gaps go to `ignition.warnings[]` but **do not block** completion — partial ignition is still ignition.

6. **Stagger heartbeats and switch them on.** For each slot, compute an offset `(hash(slot) % 60)` minutes within the slot's declared `heartbeat` period from `workflow_manifest.agent_workflows[slot].heartbeat`. `PATCH /api/agents/:id` on Paperclip flipping `runtimeConfig.heartbeat.enabled = true` and setting `cronOffset`. 35 agents cannot all fire at minute 0; offsetting distributes the load. Persist offsets in `ignition-state.json` so re-runs are stable.

7. **Emit completion event.** Write `ignition.completed_at` to `ignition-state.json` and include `{ status: "ignited", agentsWorking, workflowsQueued, goalId }` in the activate response.

## Failure modes & recovery

Ignition is *partial-tolerant by design*. Each step records its own success/failure into `ignition-state.json`, and the re-entrant `POST /api/instance/:id/ignite` endpoint picks up at the first incomplete step.

| Failure | Detection | Recovery |
|---|---|---|
| Paperclip unreachable mid-step | fetch throws | activate returns `ok: true, ignition.status: "deferred"`. Operator hits "Ignite Fleet" button in Mission Control to retry. |
| Goal creation 4xx | non-2xx response | log to `ignition.errors`, continue to step 3 with `goalId=null`. Issues seed without goal linkage — recoverable later via PATCH. |
| Some agents missing in Paperclip mapping | `slotToPaperclipId[slot]` undefined | record in `ignition.skipped[]`; do not block. The handoff retry path (re-run activate) will fill in. |
| CEO/CoS wake never completes | 60s poll timeout | mark kernel `degraded`, raise warning. Do not retry automatically — surface to operator. |
| L·IV coverage gap persists | step 5 returns gaps after retry | log warning; banner shows yellow ("Fleet ignited (partial) — N working, K gaps"). |
| Heartbeat enable PATCH 4xx | response not 2xx | record per-slot; agents stay wake-on-demand. Operator can flip manually. |

Re-entry: `POST /api/instance/:id/ignite` reads `ignition-state.json`, skips completed steps, and resumes. Hard reset path: `DELETE ignition-state.json`.

## Visible signal

Mission Control gains a top-of-page status row driven by a new `GET /api/instance/:id/ignition-status` endpoint that reads `ignition-state.json` plus a live agent count.

- **Green:** "Fleet ignited — 35 agents working, 14 workflows queued. Last heartbeat: 22s ago."
- **Yellow:** "Fleet ignited (partial) — 33 working, 2 gaps. Click to retry." (button calls `POST /api/instance/:id/ignite`)
- **Red:** "Fleet not ignited. Run kickoff." (same button)
- **Grey** (pre-activate): hidden.

The banner lives in `packages/onboarding-ui/src/pages/MissionControl.tsx`. It also drops a Telegram event via the existing Pillar 5 channel.

## Tests

In `e2e/ignition.spec.ts` and `packages/wavex-os-server/src/bridge/ignition.test.ts`:

1. **Happy path.** Finalize wizard → activate → assert `ignition.status === "ignited"`, every non-muted L·IV agent has ≥1 issue in Paperclip, exactly one Goal exists, MissionControl banner shows green within 30s of activate response.
2. **Idempotent re-ignition.** Run ignite twice. Second run produces zero new issues, zero new goals, and returns `status: "already-ignited"`.
3. **Paperclip-down partial.** Stub Paperclip 503 on `/issues`. Activate succeeds, ignition reports `status: "deferred"`, banner is yellow. Bring Paperclip back, hit `/ignite`, banner goes green and seed count matches non-muted-LIV count.
4. **Muted slot honored.** Mute one slot via the redundancy review. Activate + ignite. Assert that slot has no issue, no heartbeat patch, no warning.
5. **Stagger correctness.** With 35 agents on a 2h heartbeat, assert the resulting offsets cover ≥30 distinct minute buckets in the 0–119 range.

## Out of scope

- **Pool C optimizer injection** — that's F.5, runs against an already-ignited fleet.
- T2 patch application beyond what's already baked into the manifest at finalize time.
- New launchd templates beyond the existing six in `templates/launchd/`.
- KPI seeding (currently `owned_kpi_ids` defaults to `[]` per the bridge warning at `finalize-bridge.ts:157`).
- Cross-company ignition / multi-tenant fan-out.

## Critical files

- `packages/wavex-os-server/src/routes/activate.ts` — tail-call insertion site for Ignition + response shape extension.
- `packages/wavex-os-server/src/bridge/paperclip-handoff.ts` — provides `slotToPaperclipId` mapping; also where `heartbeat.enabled=false` default is set (line 219) and must be reconciled.
- `vendor/wavex-os/onboarding/src/schema/workflow-manifest.ts` — schema for `agent_workflows.on_fire`.
- `vendor/wavex-os/onboarding/src/schema/pillar-responses.ts` — Pillar 1 fields composing the Goal body.
- `packages/onboarding-ui/src/pages/MissionControl.tsx` — host for the ignition status banner.
