# WaveX C-Suite Skill Diff — Live Fleet vs. Vendored Templates

**Captured:** 2026-05-12
**Live fleet:** `<HOME>/.paperclip/instances/default/companies/<LIVE_COMPANY_ID>/agents/`
**Vendored:** `<HOME>/wavex-os/packages/onboarding-ui/public/agent-templates/`

## TL;DR (read this first)

The live fleet has **one structural improvement** worth backporting universally and **one CEO-specific improvement** worth backporting to the CEO template. Everything else is template-variable substitution (`$INSTANCE_DIR`, `<ISSUE-N>`, `<SUPABASE_PROJECT_ID>` → live values) and should be ignored.

| Backport item | Source | Target |
|---|---|---|
| **`SKILL_VERIFY_BEFORE_CLAIM.md`** (new kernel skill, 44 lines, identical across all 7 live C-Suite agents) | live CEO/CoS/CRO/CDO/CFO/CPO/COO | **all** vendored C-Suite roles (and arguably kernel/quickstart) |
| **`SKILL_KPI_OWNERSHIP.md` §Cadence-container measurement contract** + §Redefined 2026-05-10 KPI block | live CEO | vendored CEO |

No other meaningful drift exists. CMO and CTO have **no live counterpart agents** at all — vendored templates ship those, but the running fleet doesn't instantiate them.

---

## Per-role breakdown

### CEO (live: `df8e265c…` ↔ vendored: `ceo`)

**Live files:** SKILL.md, SKILL_BOARD_DIRECTIVE.md, SKILL_BOARD_ESCALATION.md, SKILL_BOARD_MESSAGES.md, SKILL_CEO_HEARTBEAT_DISCIPLINE.md, SKILL_COLLABORATION.md, SKILL_DELEGATE_OR_KILL.md, SKILL_ECONOMIC_SELF_AWARENESS.md, SKILL_KPI_OWNERSHIP.md, SKILL_LESSONS_LOG.md, SKILL_OPERATOR_MANAGEMENT.md, SKILL_POST_DELIVERY_REVIEW.md, SKILL_QUEUE_ECONOMICS.md, SKILL_RECOVERY_PROTOCOL.md, **SKILL_VERIFY_BEFORE_CLAIM.md**

**Vendored files:** Same set minus `SKILL_VERIFY_BEFORE_CLAIM.md`.

**Live-only files:**
- `SKILL_VERIFY_BEFORE_CLAIM.md` — Forces every "sent/deployed/live/applied" claim to be paired with an inline ground-truth probe output; auto-revert via `delivery-truth.mjs` if probe is missing.

**Section-level diffs in shared files:**
- `SKILL_KPI_OWNERSHIP.md` (live 181 / vend 159):
  - **LIVE-only section:** `## Cadence-container measurement contract (FIRST action every heartbeat)` — first line: *"The routine 'CEO v2: 6-Hour KPI Snapshot & Review' spawns a fresh execution issue per cycle with `target_kpi`, `measurement_plan`, `baseline_snapshot`, and `estimated_delta` all NULL. CoS grades any such issue **F**…"*
  - **LIVE-only block under booking_gmv KPI:** "**Redefined 2026-05-10 (CDO, WAV-5751).**" — documents that the prior query referenced a non-existent `genesis_leads.status` column, and codifies the real columns (`qualified`, `calendly_scheduled`, `qualification_score`).
- All other shared files differ only in variable substitution (paths, issue IDs, project ID `<SUPABASE_PROJECT_REF>`, Board principal name → "Omar"). Skip.

---

### Chief of Staff (live: `50c3fadb…` ↔ vendored: `chief-of-staff`)

**Live files = Vendored files** (same six skills). No live-only or vendored-only files. All content diffs are pure variable substitution. **Zero meaningful diffs.**

Note: CoS notably does NOT have `SKILL_VERIFY_BEFORE_CLAIM.md` in the live fleet either — the only top-tier role without it. Worth confirming this is intentional (CoS grades others' verification rather than performing it).

---

### CMO (live: **none** ↔ vendored: `cmo`)

**No live CMO agent exists.** The fleet runs a "Marketing Ops" agent (`3b5fa4ea…`) instead, whose `SKILL.md` says: *"You are **Marketing Ops** in the WaveX fleet. CMO drafts strategy; you ship campaigns."* — implying the CMO seat was deliberately not instantiated.

**Vendored-only files** (all unmatched by anything in live):
- `SKILL.md`, `SKILL_ECONOMIC_SELF_AWARENESS.md`, `SKILL_HARNESS_RECOGNITION.md`, `SKILL_KPI_OWNERSHIP.md`, `SKILL_LESSONS_READ.md`, `SKILL_SMB_PRODUCTIZED.md` (productized SMB lead-gen side-offer), `SKILL_ZERO_BUDGET_PLAYBOOK.md` (zero-paid-ads operating manual).

**Implication:** The vendored CMO is more elaborate than what the running fleet validated. Not a backport candidate — possibly a "rip out and replace with Marketing Ops" candidate for the wavex-os scaffold.

---

### CRO (live: `58c39f72…` ↔ vendored: `cro`)

**Live-only file:** `SKILL_VERIFY_BEFORE_CLAIM.md` (identical to CEO's copy).
**Vendored-only:** none.
**Shared-file content drift:** template substitution only (path/UUID swaps in `SKILL_LESSONS_READ.md`, `SKILL_KPI_OWNERSHIP.md`).

---

### CTO (live: **none** ↔ vendored: `cto`)

**No live CTO agent exists.** Closest live equivalent is "Full-Stack Engineer L2" (`ec57f449…`). CMO/Marketing-Ops `SKILL.md` references "CTO merges" but no agent holds the seat.

**Vendored-only files:** `SKILL.md`, `SKILL_ECONOMIC_SELF_AWARENESS.md`, `SKILL_HARNESS_RECOGNITION.md`, `SKILL_LESSONS_READ.md`. Lean by design.

**Implication:** Live fleet collapsed CTO into FSE. Decide whether scaffold should keep a separate CTO role or merge.

---

### CDO (live: `40a7ecca…` ↔ vendored: `cdo`)

**Live-only file:** `SKILL_VERIFY_BEFORE_CLAIM.md`.
**Vendored-only:** none.
**Shared diff:** variable substitution only. **Zero other meaningful diffs.**

---

### CFO (live: `ec174309…` ↔ vendored: `cfo`)

**Live-only file:** `SKILL_VERIFY_BEFORE_CLAIM.md`.
**Vendored-only:** none.
**Shared diff:** variable substitution only. **Zero other meaningful diffs.**

---

### CPO (live: `253ef9e7…` ↔ vendored: `cpo`)

**Live-only file:** `SKILL_VERIFY_BEFORE_CLAIM.md`.
**Vendored-only:** none.
**Shared diff:** variable substitution only. **Zero other meaningful diffs.**

(Vendored CPO ships only 2 skills total. CPO is the leanest role in both.)

---

### COO (live: `db80a889…` ↔ vendored: `coo`)

**Live-only file:** `SKILL_VERIFY_BEFORE_CLAIM.md`.
**Vendored-only:** none.
**Shared diff:** variable substitution only. **Zero other meaningful diffs.**

---

## Battle-tested improvements (verbatim snippets)

### 1. The "verify before claim" kernel rule (universal — backport to all roles)

From `SKILL_VERIFY_BEFORE_CLAIM.md`, evidence-of-need preamble:

> The fleet has a track record of self-attestation. CMO claimed "22 emails sent" → Resend log showed 0. CFO published an audit on `cost_events` → table doesn't exist. CEO graded a migration as "columns missing" → columns were live, backfill missing.

The probe contract (verbatim, abridged):

> | Claim type | Required probe | Where to put output |
> |---|---|---|
> | Sent N emails / blast | `curl -s "https://api.resend.com/emails?limit=100" -H "Authorization: Bearer $RESEND_API_KEY" \| jq …` | "**Resend verification:** N actually delivered to recipients X, Y, Z…" |
> | Migration applied | `curl -s "$SUPABASE_URL/rest/v1/<table>?select=*&limit=1" …` | "**Schema verification:** columns `a, b, c` present on `public.<table>`…" |

Enforcement hook (verbatim):

> `tools/delivery-truth.mjs` runs every 10 minutes against your most recent comments. If it finds a delivery claim without supporting evidence — OR if the claim contradicts the underlying transport — it will:
> 1. Log a CRITICAL agent_lesson on you (visible to all future runs in your preflight)
> 2. Auto-revert the issue from `done`/`in_review` back to `in_progress`
> 3. Stamp a Board comment on the issue: "auto-revert by delivery-truth.mjs"

### 2. Cadence-container measurement contract (CEO-specific)

From live CEO `SKILL_KPI_OWNERSHIP.md` — surgical fix for the routine spawning issues without measurement fields:

> The routine "CEO v2: 6-Hour KPI Snapshot & Review" spawns a fresh execution issue per cycle with `target_kpi`, `measurement_plan`, `baseline_snapshot`, and `estimated_delta` all NULL. CoS grades any such issue **F**…
>
> ```sql
> UPDATE issues
>    SET target_kpi='ceo_kpi_snapshot_cycle_writes',
>        measurement_plan=$$SELECT COUNT(*)::INT AS value FROM kpi_snapshots WHERE ... AND source_query='a5_kpi_snapshot_executor';$$,
>        baseline_snapshot='{"value":0,"measured_at":"<CYCLE_START_UTC>",...}'::jsonb,
>        estimated_delta=9
>  WHERE id='<this-issue-uuid>';
> ```

### 3. KPI redefinition discipline with evidence (CEO-specific)

From live CEO `SKILL_KPI_OWNERSHIP.md`, the `booking_gmv` block:

> **Redefined 2026-05-10 (CDO, WAV-5751).** Prior definition queried `genesis_leads.status` which does not exist on the table. Actual purchase-intent flags on `public.genesis_leads`: `qualified` (bool), `calendly_scheduled` (bool), `calendly_event_uri` (text), `qualification_score` (int). `calendly_scheduled = true` = "lead booked a 1:1"…
>
> **Structural zero until ingestion lands.** Columns exist (migration `20251106213231`) but no writer populates `calendly_scheduled`. Count is currently 0 — a true zero until the Calendly webhook → `genesis_leads` UPDATE is wired. Non-zero is the first acceptance signal that ingestion is live.

The pattern worth backporting is the **"Redefined YYYY-MM-DD (auditor, issue-ref)"** convention for KPI mutations — explicit provenance, explicit "structural zero vs. measured zero" distinction.

### 4. Honest-block protocol (in SKILL_VERIFY_BEFORE_CLAIM but worth highlighting separately)

> If the verification probe is genuinely blocked (no API key, no read access, table not yet created), DO NOT claim "sent/done/applied". Post status as `blocked` with a `### BLOCKED — need <thing>` header so CEO can route. Honest blocks are graded `unmeasurable` (no penalty); false claims are graded `regression` (demotion).

This three-tier grading (`success` / `unmeasurable` / `regression`) is implicit in CEO grading but not codified in any vendored skill. Worth promoting to a kernel rule.

### 5. The five hard-won lessons (in `CONTEXT_BUNDLE.md`, not in any vendored skill)

These live in the CEO's `CONTEXT_BUNDLE.md` (auto-materialized by `distribute-context.mjs`) and were never folded into a vendored skill:

> **L1 — Edge Function returns lie:** The `await resend.emails.send()` SDK call does NOT throw on API errors… Always check the SDK's `{data, error}` return shape.
> **L2 — Forecasted deltas are inflated by default:** Require N≥3 reviews before allocating budget to a pattern.
> **L3 — Schema migrations are half the work:** A migration claim is unverified until `SELECT COUNT(*) WHERE col IS NOT NULL` returns the expected count.
> **L4 — Promotion templates carry prompt-injection signature** (truncated in source; recover before wipe).
> L5 — (also in source; recover before wipe).

**Recommendation:** Extract these five lessons into a new `SKILL_KERNEL_LESSONS.md` and ship it with every C-Suite template. They are the strongest "battle-tested" content in the entire live fleet.

---

## Backport decision checklist (for the user)

1. **Universal:** Copy live `SKILL_VERIFY_BEFORE_CLAIM.md` into all 9 vendored C-Suite templates (CEO/CoS/CMO/CRO/CTO/CDO/CFO/CPO/COO). 44 lines, identical across roles, no parameterization needed beyond keeping `$RESEND_API_KEY` / `$SUPABASE_URL` env-style placeholders.
2. **CEO-only:** Append the live `## Cadence-container measurement contract` section + the `Redefined 2026-05-10` provenance block to vendored `ceo/SKILL_KPI_OWNERSHIP.md`. Parameterize the UUID and SQL company filter.
3. **New skill (recommended):** Extract L1–L5 from `CONTEXT_BUNDLE.md` into a kernel-grade `SKILL_KERNEL_LESSONS.md` and ship to all C-Suite roles (also kernel/quickstart).
4. **Structural question (not a diff, a policy call):** The live fleet has no CMO and no CTO agent — only Marketing Ops and Full-Stack Engineer. Decide whether the wavex-os scaffold should mirror the running fleet's collapsed structure or keep the more formal C-Suite shape.
5. **Confirm CoS exclusion:** CoS is the only top-tier seat without `SKILL_VERIFY_BEFORE_CLAIM.md` in the live fleet. Likely deliberate (CoS grades verification) — confirm before backporting.

Nothing else justifies the diff cost.
