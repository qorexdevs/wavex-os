# Role collapse — when to merge formal C-Suite into operator roles

The vendored templates ship with a formal 9-role C-Suite (CEO, CoS, CMO, CRO, CTO, CDO, CFO, CPO, COO). That structure is correct for a Series A+ company with 20+ humans + 20+ agents. **It is wrong for sub-PMF companies** where the operator has 0–5 humans and one founder wearing all hats.

The live fleet from which V2's lessons were extracted runs a collapsed 6-role roster — *Marketing Ops* in place of CMO+CRO, *Full-Stack Engineer* in place of CTO+CPO, *Recovery Engineer* in place of COO. Decision-making is 2× faster and role-confusion 5× lower, because there are fewer hops between problem and owner.

## When to collapse (the wizard reads this)

The Pillar 3 `stage` answer gates collapse automatically:

| Pillar 3 stage | Roster shape | Rationale |
|---|---|---|
| `pre_product` | **Minimal kernel only:** CEO + CoS + 2 L·IV operators (Full-Stack Engineer + Marketing Ops). 4 agents total. | At pre-product there is no real C-Suite work. Anything specialized is theater. |
| `live_no_paying_customers` | **Collapsed (6 roles):** CEO + CoS + Marketing Ops + Full-Stack Engineer + Data/Attribution + Recovery Engineer. ~12 agents total (with L·IV specialists under each). | The fleet exists to find the first 10 paying customers. Formal CFO/COO are honorific until there's revenue to manage. |
| `live_paying_customers` | **Collapsed (6 roles).** Same as above. | Below $100K MRR, finance/ops are still part-time concerns. |
| `10k_100k_mrr` | **Hybrid (7–8 roles):** Add a part-time CFO seat for cash-flow modeling. Keep Marketing Ops merged. | Cash flow becomes a real constraint around $50K MRR. |
| `100k_mrr_plus` | **Formal C-Suite (9 roles).** All vendored roles activated. | At this stage the company has the surface area to need specialist focus. |

The wizard's `swarm_manifest` builder consults this table and emits the right roster size.

## The collapse map

When collapsed roles are used, each absorbs the responsibilities + skill bundles of the formal roles it replaces:

| Collapsed role | Replaces | Skill bundles inherited |
|---|---|---|
| **Marketing Ops** | CMO + CRO | All CMO `SKILL_*.md` + all CRO `SKILL_*.md`. The agent operates demand-gen, content, brand AND outbound, demo, close — explicitly, because in a sub-PMF company those are the same conversation. |
| **Full-Stack Engineer** | CTO + CPO | All CTO + CPO skill bundles. The agent makes architecture decisions, ships code, and owns product priorities — explicitly, because a 1-engineer team cannot afford to context-switch between "tech direction" and "what to build". |
| **Recovery Engineer** | COO + CDO (partial) | COO health/credentials/scheduler skills + CDO observability/telemetry. Owns "the lights stay on". |
| (CFO is part-time at sub-PMF) | CFO (partial) | Only `SKILL_QUEUE_ECONOMICS.md` and `SKILL_ECONOMIC_SELF_AWARENESS.md`. Modeling/forecast skills deferred until 10k_mrr. |

CEO + CoS are NEVER collapsed. The two-agent kernel is the minimum coherent topology — collapsing either one destroys the actor/observer dyad that the entire system depends on.

## What to do when you start with collapsed roles and the company grows

The wizard's first-run roster is not permanent. When KPIs cross a stage threshold (e.g. you hit $10K MRR), the CEO files an `[ALIGNMENT]` issue: "stage shift detected — propose hiring a dedicated CFO". The operator (human) approves or rejects. If approved, the wizard's `add-agent` flow runs against the relevant role template and the new agent inherits the collapsed agent's open issues.

**Do not collapse roles after promoting them.** A dedicated CMO does not become Marketing Ops six months later just because revenue dipped. The skill-bundle merge is a one-way transition; demoting roles confuses both the human operator and the fleet itself.

## What this skill does NOT do

- It does NOT auto-collapse roles at runtime. Collapse decisions happen at activate time based on Pillar 3, and at later stage-shift moments via explicit CEO `[ALIGNMENT]` issues + operator approval.
- It does NOT change KPI tree structure. KPIs are owned by tier, not by role title. A collapsed Marketing Ops still owns all the KPIs CMO+CRO would have owned formally.
- It does NOT eliminate the need for specialist L·IV agents. Even in a 6-role collapsed roster, each role can have 0–4 specialist sub-agents per the swarm_manifest.

## Edge case — single-operator companies (no employees)

When Pillar 1's `headcount` answer is 1 (solo founder), the wizard runs a **further-collapsed minimal kernel** at any stage below `100k_mrr_plus`:

- CEO + CoS + Marketing Ops + Full-Stack Engineer + Recovery Engineer. **5 agents total.**
- No specialist L·IV agents. All work happens at the role level.
- The Marketing Ops + Full-Stack Engineer roles each absorb their respective Data/Attribution responsibilities until headcount > 1.

This is the absolute floor. Below this, the kernel cannot run.
