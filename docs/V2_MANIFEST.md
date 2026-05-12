# V2 Fresh-Start Manifest

Consolidated from three knowledge-extraction captures done 2026-05-12 before wiping the V1 fleet. What V2 ships with that V1 didn't.

**Source captures:**
- [`V2_CAPTURE_A_skill_diff.md`](./V2_CAPTURE_A_skill_diff.md) — what the live C-Suite evolved that wasn't in templates
- [`V2_CAPTURE_B_patterns.md`](./V2_CAPTURE_B_patterns.md) — kernel protocols + KPI conventions + 8 anti-patterns from 1,000 live issues
- [`V2_CAPTURE_C_inference_server.md`](./V2_CAPTURE_C_inference_server.md) — Mac-as-server topology with concrete recommendations

**Status (as of 2026-05-12):**
- Sections A + B + C + D: **shipped to main** in commits `05765562` + `e3fd7778`
- Sections E1 + E2 decisions: **made** — formal C-Suite + collapse skill (E1), ship from Mac (E2)
- **Phase G.1 + G.2 + G.3:** scaffold of inference server + System Reliability agent + 15-min resource sweep — shipped to main
- Section F sequence (wipe + re-onboard): **pending operator authorization**
- Phase G.3.b (real Pool A wiring): pending
- Phase F.4 (Liaison agent) + F.5 (Pool C generation): pending

---

## A. New skills to add (3)

| ID | Skill | Scope | Source | Why |
|---|---|---|---|---|
| S1 | `SKILL_VERIFY_BEFORE_CLAIM.md` | All agents (universal) | Live in 7/9 C-Suite. 44-line probe contract + `tools/delivery-truth.mjs` auto-revert | Highest-leverage backport. Eliminates the "claimed done but actually broken" failure mode that wasted entire days of supervision |
| S2 | `SKILL_KERNEL_LESSONS.md` | CEO + CoS only | Extracted from CEO `CONTEXT_BUNDLE.md` | 5 hard-won lessons: Edge Function returns lie, Forecasted deltas inflated, Migrations are half the work, Promotion templates carry prompt-injection signature, L5 |
| S3 | `SKILL_RECOVERY_PROTOCOL.md` (enhance existing) | CoS + Recovery Engineer | Live patterns from B3 | 3-layer recovery: auto-gen "Recover stalled issue", CoS failure-cluster triage (same-agent same-category = adapter drift, cross-agent same-category = harness regression), Recovery Engineer human-escalation patrol with 24h-dedup |

## B. Update existing skill (1)

| ID | Skill | Change | Source |
|---|---|---|---|
| U1 | `SKILL_KPI_OWNERSHIP.md` | Append the **WAV-6388 v1.1 measurement contract** + "structural zero vs measured zero" distinction. Every issue needs `target_kpi + estimated_delta + measurement_plan + baseline_snapshot`. Missing any → auto-F grade. | A2 + B2 |

## C. Kernel protocols to encode (in CEO + CoS skill files)

| ID | Protocol | Source | Implementation |
|---|---|---|---|
| K1 | CEO **§A 24h routine** at `cron 7 9 * * *` (NY) — "Goal Keeper". Single daily file-then-delegate cycle, not heartbeat-driven | B1 | Cron entry + skill section pinning behavior |
| K2 | CoS **§B hourly grading** routine 09:00–21:00 NY — "Fleet Alignment Officer". Hourly review of completed issues against measurement contract | B1 | Cron entry + grade rubric in skill |
| K3 | **Anti-bottleneck rule** — no pre-flight gating; quality gates run post-delivery as graders, not blockers | B1 (WAV-6373) | Documented in CoS skill |
| K4 | **Critical escalation** — `priority='critical'` triggers 2h CoS window, no-response = approval | B1 | Skill rule + cron monitor |

## D. Operational guardrails (in standard-skills or runtime)

| ID | Guardrail | Source | Implementation |
|---|---|---|---|
| G1 | **Recovery doom-loop prevention** — auto-pause issues stuck `blocked` >48h. Today: 47/108 blocked issues are doom-loops | B5 | scheduled-routine in standard-skills |
| G2 | **Synthetic-data filter** — exclude `@<TEST_DOMAIN>` and other test domains from KPI reads | B5 | KPI query helper utility |
| G3 | **Board batch-flood limit** — max 3 `priority=critical` directives per 24h rolling window | B5 | wakeup route handler + skill rule |
| G4 | **Spinner pattern auto-pause** — ≥30 runs AND ≤1 done in 24h → auto-pause (already exists in Paperclip core, just needs to be enabled in the activate flow) | Existing | bridge/paperclip-handoff.ts |
| G5 | **Heartbeat rate cap** — 6/hr per agent on direct API path | Existing in Paperclip | confirmed already shipped |

## E. Decisions awaiting operator

### E1 — Org structure: formal C-Suite vs collapsed roster

**Live fleet pattern:** no CMO, no CTO. Runs **Marketing Ops + Full-Stack Engineer** instead. 9 distinct roles instead of formal C-7.

**Tradeoffs:**
- **Collapsed (live pattern):** closer to how a real <$5M company actually operates. Less role-confusion in practice. Faster decision-making (fewer hops). Harder to demo to enterprise customers expecting a recognizable org chart.
- **Formal C-Suite (vendored):** legible to outsiders. Each role has a clear domain. Easier story for marketing. More overhead per decision; some roles are honorific until the company actually has the surface area to need them.

**My read:** keep formal C-Suite in V2 templates (the wizard ships to many company stages, some of which DO need a CTO), but add `SKILL_ROLE_COLLAPSE.md` that explains when/how to merge roles for sub-PMF stages. The wizard's Pillar 3 stage answer already gates this.

### E2 — Inference topology: Mac-server-day-1 vs Hetzner-day-1

**Recommendation from capture C:** ship from your Mac. Reasons:
- Anthropic Max 20× OAuth already in your Keychain
- $0 incremental infra cost until customer ~15
- Pool C is bottlenecked on Anthropic quota, not compute — VPS doesn't help
- T1 deterministic onboarding fallback eliminates the hard-blocking dependency
- Migration to Hetzner is bounded at 1 day's work when you hit ~25–30 paying subs

**The one ambiguity:** Anthropic TOS on reselling Max-served inference. The doc recommends keeping `INFERENCE_BACKEND=oauth|apikey` as a one-env-var flip in case Anthropic objects. Read TOS section "Acceptable Use — Reselling" before customer #1.

## F. The wipe-and-re-onboard sequence

After E1 + E2 decisions:

1. **Apply A + B + C + D** to `wavex-os/packages/onboarding-ui/public/agent-templates/` and the relevant standard-skills (~3h of work, mostly mechanical).
2. **Commit + push.** This becomes the V2 template baseline.
3. **Build the inference-server scaffold** per capture C (Fastify + Cloudflare Tunnel + Redis + launchd plists). ~6h. Optional first pass: stub endpoints, no real inference yet, just prove the topology works.
4. **Snapshot the live fleet state** for forensics: dump goals, KPIs, key issues, agent runtime configs. Save to `~/.wavex-os/legacy-snapshot-2026-05-12/`. ~30min.
5. **Wipe** the legacy company `1dc1bc4b-…` from Paperclip + the wavex DB. Confirm zero residual agents heartbeating.
6. **Re-onboard fresh** via the wizard against the updated templates. Capture full Playwright walk for the new "V2 first boot" demo.
7. **Smoke-test the new fleet for 24h.** If KPIs move + agents stay coherent without supervision → V2 baseline locked.

## G. What this manifest does NOT include

- The Liaison agent (F.4) — needs E2 decided first, then ships as F.5
- The /pricing UX wiring to live Stripe (F.1.b deploy steps) — separate operator task, not blocking V2 templates
- F.3 quota slider — defers until V2 fleet has stable token-burn baselines we can throttle against
- Meta Mission Control deploy (the `admin/` package) — wait until F.1 has at least one real subscription row, otherwise the dashboard has nothing to show

## H. Files I'll touch when you approve

```
packages/onboarding-ui/public/agent-templates/_shared/SKILL_VERIFY_BEFORE_CLAIM.md  (NEW)
packages/onboarding-ui/public/agent-templates/ceo/SKILL_KERNEL_LESSONS.md          (NEW)
packages/onboarding-ui/public/agent-templates/chief-of-staff/SKILL_KERNEL_LESSONS.md (NEW)
packages/onboarding-ui/public/agent-templates/ceo/SKILL_KPI_OWNERSHIP.md           (UPDATE — append WAV-6388 contract)
packages/onboarding-ui/public/agent-templates/chief-of-staff/SKILL_RECOVERY_PROTOCOL.md (UPDATE — 3-layer)
packages/onboarding-ui/public/agent-templates/ceo/SKILL.md                          (UPDATE — §A 24h routine)
packages/onboarding-ui/public/agent-templates/chief-of-staff/SKILL.md               (UPDATE — §B hourly, critical 2h, anti-bottleneck)
packages/standard-skills/SKILL_RECOVERY_DOOM_LOOP_GUARD.md                          (NEW — G1)
packages/standard-skills/SKILL_KPI_SYNTHETIC_FILTER.md                              (NEW — G2)
packages/op-omega-server/src/routes/wakeup.ts                                       (UPDATE — G3 batch-flood limit)
```

Total: 6 new files, 4 updates. ~3h of careful editing.

---

**Status:** Ready to execute after E1 + E2 decided.
