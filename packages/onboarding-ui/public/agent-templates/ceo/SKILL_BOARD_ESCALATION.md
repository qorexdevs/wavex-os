# CEO Board Escalation — outbound to Telegram

The board has observed: zero novel-request escalations have hit Telegram despite 14 days of fleet operation. **That is a defect.** A working autonomous system surfaces decisions to humans. A silent system is either (a) not finding novel work or (b) hoarding decisions it should be passing up.

This skill defines when YOU (the CEO) MUST escalate to the board via Telegram.

## Escalation triggers (any one of these → escalate immediately)

| Trigger | Severity | What to send |
|---|---|---|
| **Operator requests novel external integration** (Composio connector, third-party API, OAuth flow) | High | Connector name, business case, KPI tied, who would own it |
| **Operator requests headcount expansion** (CMO wants Video Studio, etc.) | High | Role + lane + L0 cost (~$0/day stub) + promotion criteria |
| **Operator requests budget approval** (ad spend > $50/day, paid tools) | Critical | Amount, projected ROAS, kill criteria, max-loss exposure |
| **Operator stuck > 3 cycles on same issue** with `null_impact` or `regression` grades | Medium | Issue ID, what they tried, your read of the blocker |
| **KPI regression** > 10% week-over-week on any tier 1-2 KPI | Critical | Which KPI, delta, hypothesis, mitigation options |
| **Operator proposes promotion** to L2 (autonomous-write tier) | High | Operator name, evidence (3+ aligned), proposed scope, blast radius |
| **Trend Research surfaces a time-sensitive opportunity** (event in <14 days, competitor move) | Medium | Opportunity, owner, estimated GMV delta, decision needed |
| **Recurring routine fails 3+ runs** | Medium | Routine, error class, recommended fix |

## DO NOT escalate

- Routine 6h grading reports — those go in issue_comments, not Telegram
- Token rotations / 401 storms — retry-watcher + token-probe handle these
- Successful completions — silent success is the default
- Anything you can resolve within your own L3 lane

## How to escalate

```bash
# Use the existing TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID from .env
TELEGRAM_BOT_TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" $HOME/.paperclip/instances/default/.env | cut -d= -f2)
TELEGRAM_CHAT_ID=$(grep "^TELEGRAM_CHAT_ID=" $HOME/.paperclip/instances/default/.env | cut -d= -f2)

curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=<message>" \
  -d "parse_mode=HTML"
```

## Message format (HTML)

```
🚨 <b>BOARD ESCALATION — {trigger_class}</b>

<b>What:</b> {one-line summary}
<b>Why now:</b> {why this can't wait for a routine cycle}
<b>Decision needed:</b> {exactly what you want them to decide — yes/no, pick A or B, etc.}
<b>If approved:</b> {what happens next}
<b>If rejected:</b> {what's the fallback}
<b>Context:</b> {issue identifiers, KPI numbers, links}

Reply to this message with: APPROVE / REJECT / DEFER / DISCUSS
```

## Track every escalation

Insert a row to `kpi_snapshots` with `kpi_name='_board_escalation_<class>'` and value=1 every time you escalate. This lets us measure escalation rate over time as a proxy for system maturity.

## Why this matters

A frontier autonomous system **surfaces novel decisions** because it discovers things humans haven't yet thought about. If you never escalate, you're probably not finding the edges. The user's stated goal: see novel-integration requests, see hiring asks from the CMO, see trend-driven campaign ideas. Be the bridge that gets those to the board.
