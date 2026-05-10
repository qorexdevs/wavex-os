# SKILL_ZERO_BUDGET_PLAYBOOK — CMO operating manual under zero paid-ads budget

**Effective:** 2026-05-01 → 2026-05-08 (cycle), reviewed weekly thereafter.
**Owner:** WaveX CMO. **Source:** `doc/board/alignment-cycle-2026-05-01.md` §3.

## The constraint
Zero Meta/Google ad spend this cycle. Every dollar of effective spend is **agent token cost**. So every owned channel, organic surface, and partnership is now load-bearing.

## What you must STOP doing
- ❌ Routing ratifications to CEO. Reassignment without a value-add in the same comment is forbidden. (See: 2026-05-01 03:12 reassign-to-CEO comment — too low value for an Opus heartbeat.)
- ❌ Pure status-check comments. If your wake produces no decision, draft, or kill, you have wasted the heartbeat.
- ❌ Ad-platform muscle memory. Do not draft creatives that assume targeting, lookalikes, retargeting pixels, or paid amplification. Those don't exist this cycle.

## What you must DO each heartbeat
Pick exactly **one** of these three lanes and produce its deliverable:

### Lane A — Campaign brief (owned channel)
A campaign brief is: title + segment + 1-3 message variants + asset list + CTA + measurement plan + go/no-go gate. Approved by CEO before Promotion Designer drafts assets. Channels permitted:
- Resend transactional + marketing
- In-product banner / modal / inbox-lite notification
- Partnership co-marketing (other Miami operators with non-overlapping ICP)
- Concierge-initiated 1:1 (high-intent only)
- Organic Instagram / TikTok / YouTube (Video Studio's distribution lane)

### Lane B — SEO topic-cluster spec
A topic-cluster spec is: pillar keyword + 6-12 cluster keywords + 1-line page intent for each + internal-link map. Hands off to Trend Research for keyword scoring, then Content Studio for page production. **Pillar keywords must be commercial-intent** (e.g. "private F1 Miami transfer", not "what is F1").

### Lane C — Kill decision
A kill is: a campaign or content thread that's not converting, terminated cleanly with reason code + redirected budget. Lower variance is better; if a campaign hasn't moved `marketing_events_7d` in 5 days, kill it. Worth at least 1 kill per week.

## Hard limits (enforced by COO + CFO)
- **Max 5 comments per heartbeat.** Each comment must be one of: ratification, kill-decision, strategic re-prioritization, brief, or kill. No "checking in" comments.
- **One Opus heartbeat per 4 hours.** If wake-frequency exceeds this, propose a downgrade to Sonnet for routine work.
- **No starting a new campaign while ≥ 2 are unmeasured.** Measurement before expansion.

## KPI gates (this cycle)
- `new_auth_users_7d` ≥ +30 vs prior 7-day window by 2026-05-08.
- `marketing_events_7d` ≥ 4 owned-channel campaigns shipped, each with measured open/click metrics within 48h.
- Token cost per heartbeat: **≤ 50% of last week's average** (CFO will publish daily).

## Pattern library (use these, evolve them)

### Pattern: F1 Miami micro-cohort blast
- Segment: confirmed bookings + concierge-engaged users in last 60 days
- Channel: Resend (owned email)
- Variant cadence: 3 variants @ 24h spacing, then kill all that don't beat baseline open >35%
- Measurement: open rate + click rate from Resend webhook, conversion attributed via UTM `utm_source=email&utm_campaign=f1-miami-{variant}`
- Already shipped via <ISSUE-N> — Promotion Designer holds the template.

### Pattern: SEO topic cluster (NEW for this cycle)
- Pillar: one commercial-intent query, ~500-2K monthly volume
- Clusters: 6-12 long-tail variants, "people also ask" mining
- Each cluster page: 800-1500 words, schema.org/Service or LocalBusiness, FAQ block
- Internal-link the cluster pages to the pillar; pillar links to /book CTA
- Sitemap.xml + Search Console submission via composio-search-console connector

### Pattern: Concierge-initiated 1:1
- Trigger: lead score > threshold OR specific intent signal
- Concierge Ops drafts message → CMO ratifies template → Concierge sends via owned channel (NOT mass email)
- Volume target: ≤ 20/day. Quality > quantity. Each touch needs a personalization variable that proves it's not template spam.

## Lane D — Community-presence lead capture (added by <ISSUE-N>, 2026-05-03)

A Lane D deliverable is: **community shortlist + thread-finding rules + per-community reply template + lead-magnet target page**, all human-approved before any external posting.

- **Discovery (Researcher).** Identify 8–12 high-fit communities, classified per row as B2B intermediary or B2C consumer, with ICP fit notes:
  - B2B intermediaries: Miami hotel concierges, yacht brokers, event planners, luxury travel agents, F1-ticket resellers, wedding planners. Channels: LinkedIn groups, industry Slack/Discord, trade-show alumni lists, public business listings. **No scraping of private member lists.**
  - B2C consumers: Reddit (r/miami, r/yachting, r/formula1, r/luxurylife), expat FB groups (public), F1 fan Discords, luxury-travel forums, yacht-owner forums. **Public threads only.**
- **Thread-finding rules.** Match queries: "yacht charter Miami", "F1 Miami transportation", "Miami concierge recommendations", "Miami bachelor/bachelorette yacht", "corporate event Miami". Filter for threads <14 days old where OP is asking for recommendations.
- **Reply drafting.** For each match, draft an authentic 1:1 reply that (a) names the OP's actual question, (b) gives one piece of genuine non-promotional value, (c) links to a lead-magnet page (not directly to /book). Reply pushed to a board-review queue — **a human approves every external post.** Agents do not post autonomously to communities.
- **Lead-magnet pages.**
  - B2C: "F1 Miami 2026 — Yacht & VIP Transfer Survival Guide" (free PDF, email opt-in) at `/lp/f1-miami-yacht-guide`.
  - B2B: "Miami Luxury Concierge Partner Program — Commission + Rapid-Quote Sheet" (email opt-in for partner kit) at `/lp/concierge-partner-kit`.
  - Both pages: UTM-tagged, schema.org/Article, Resend opt-in, double opt-in for GDPR safety.
- **Capture.** Email → consented list → measurable Resend campaign per UTM source.

### Forbidden tactics (board-mandated)
- ❌ Bulk email harvesting from forums, Discord, Slack, member lists.
- ❌ Mass automated posting to communities. One-shot bot replies = brand kill + account bans.
- ❌ Buying email lists or LinkedIn-data export tools that violate platform ToS.
- ❌ Cold-emailing scraped consumer addresses. All consumer email must be consented opt-in.
- ❌ Cold outreach without CAN-SPAM compliance (valid sender ID, physical address, working unsubscribe). B2B cold to public business contacts is allowed; consumer cold is not.

### KPI gate (per cycle)
- `community_leads_captured_7d` ≥ 25. Counted as: opt-in email confirmed via Resend double-opt-in, source = community channel, UTM = `utm_source=community&utm_medium={reddit|linkedin|fb|forum|discord}&utm_campaign={lead-magnet-slug}`.
- Secondary: `community_replies_posted_7d` ≥ 30 (human-approved replies actually posted to threads). Quality > quantity — kill any community where reply-to-opt-in conversion < 5% by day 5.

## Decision shortcuts
- Should I run this campaign? **YES if** (a) target segment ≥ 50, (b) measurement plan defined, (c) creative approved by Promotion Designer, (d) attribution_coverage on the channel ≥ 80%.
- Should I keep running this campaign? **YES if** open rate > 30% AND click-to-conversion > 2% by day 3. Otherwise kill or iterate.
- Should I escalate to CEO? **NO unless** the decision crosses lanes (e.g., spending budget that doesn't exist, breaking attribution, reversing a prior CEO ratification).

## Required pre-action sequence each heartbeat
1. Read your `agent_lessons` (per `SKILL_LESSONS_READ.md`).
2. Check `marketing_events_7d` and `new_auth_users_7d` current values.
3. Pick lane A/B/C above.
4. Produce deliverable.
5. Post ground-truth probe per `SKILL_VERIFY_BEFORE_CLAIM.md`.
6. Exit. Maximum 5 comments total in the heartbeat.
