# SKILL_ECONOMIC_SELF_AWARENESS — read your CURRENT_ECONOMICS.md every heartbeat

**Audience:** every agent in a WaveX OS fleet.
**Source pattern:** field-tested in production for ~7 days; introduced after a forensic audit found the fleet was burning ~$1,000/day in imputed Anthropic spend producing 21 closed issues from 231 comments — discussion-heavy, decision-light. The fleet knew its goals; it lacked awareness of its own economic footprint.

This skill makes you self-aware of your token cost so you can self-regulate.

## The economics file you must read

At the start of EVERY heartbeat, before producing any output, read:

```
agents/<your-id>/instructions/CURRENT_ECONOMICS.md
```

This file is auto-refreshed every 15 min by the maintenance service. It contains:

- Your 24h heartbeat run count, closed issues, comments
- Your imputed burn (24h, in cents) — model-aware
- Your $/done and $/comment ratios
- Your fleet rank and share %
- The output:cache verbosity ratio

If the file does not yet exist (new agent), default to the conservative profile in the bottom section.

## Token cost ladder (memorize this)

For Opus 4.7:
- Input tokens: **$15 per million** (1×)
- Cached input tokens: **$1.50 per million** (0.1×)
- Output tokens: **$75 per million** (5×)

For Sonnet 4.6 (≈5× cheaper than Opus across the board):
- Input: $3/Mtok · Cached: $0.30/Mtok · Output: $15/Mtok

**Key insight:** output tokens cost **50× more** than cache reads. Verbose responses are the dominant cost driver. Cache reuse is nearly free.

## Self-regulation rules

### Rule 1 — High-burner output gate
**If your fleet share > 15% OR your $/done > $50:**
This heartbeat MUST end with one of: `delegate` (spawn a child issue with KPI), `kill` (cancel a stalled issue), `approve` (advance a waiting agent), or `escalate` (file a board approval). It MUST NOT end with comment-only output. (See SKILL_DELEGATE_OR_KILL on the CEO; the same gate applies to any high-burner agent.)

### Rule 2 — Verbosity gate
**If your output:cache ratio > 0.05** (you're producing fresh content faster than reusing cache):
- Replace prose with bullets
- Replace re-statement with deep-link to the prior comment/document
- Replace "let me explain X again" with a link to `[CMT-XXXX](<issue-url>#comment-XXXX)`
- Output 5 lines when 50 came to mind. The 45 you didn't write are 45 × $75/Mtok of saved imputed cost.

### Rule 3 — Spinning detection
**If you have ≥ 30 runs in 24h and 0 closed issues:**
You are spinning. This heartbeat must close something or escalate the blocker. If you produce another comment-only output, the maintenance service will flag you for review and may auto-pause you.

### Rule 4 — Restate prevention
**Never restate ground-truth that's already in a comment thread or document.** When you need to refer to prior info:

- ✅ Right: `Per [CMT-1234](<issue-url>#comment-1234), the funnel data is …`
- ❌ Wrong: A multi-paragraph block recapping data the next reader could click into.

Each restatement multiplies your output tokens by 50× the cache cost they replaced. If the data hasn't changed, link to it.

### Rule 5 — One artifact, not one comment per thought
Bundle your decisions into ONE comment per heartbeat where possible. Three comments saying "doing X", "doing Y", "done with X" cost 3× a single comment saying "X done; Y in flight".

## What "good economics" looks like

A healthy heartbeat:
- Reads CURRENT_ECONOMICS.md (cache hit, ~free)
- Reads relevant ancestors and recent comments (cache hits)
- Produces ONE concise comment with bullets
- Spawns ONE child issue (the artifact)
- Output tokens: ~500–1,500
- Imputed burn: ~$0.10–$0.30 per heartbeat

A bad heartbeat:
- Restates the goal, the cycle, the prior decisions
- Multi-paragraph rationale that ends in "checking in"
- 5 separate comments
- Output tokens: 8,000+
- Imputed burn: $0.60+ per heartbeat

The bad heartbeat costs ~6× more than the good one for the same downstream effect. Multiplied across high-frequency wakers (e.g. ~92 daily wakes), that's ~$200/day vs ~$30/day on a single agent.

## The closing line (required)

Every heartbeat must end with a line that reflects awareness of your economics:

```
ECON: rank=#N share=X% burn24h=$Y heartbeat-output=Z-tokens artifact=<delegate|kill|approve|escalate|noop>
```

If `artifact=noop` AND your share > 5%, you should have skipped the heartbeat. Add to your retro that you didn't.

## Conservative profile (when CURRENT_ECONOMICS.md is empty)

If the file doesn't exist or has zeros (e.g., new agent), default to:
- 1 comment per heartbeat
- ≤ 1,500 output tokens
- Prefer bullets
- Wait for the data to fill in before relaxing.
