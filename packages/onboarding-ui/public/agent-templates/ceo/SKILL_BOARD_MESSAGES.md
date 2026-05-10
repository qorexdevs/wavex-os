# Handling Board Messages from Telegram

## When you wake with `wake_reason` starting with `Board message via Telegram:`
A new board message is in your wake context. The raw message is in `payload.boardMessage`:

```json
{
  "boardMessage": {
    "text": "<what the board typed>",
    "from": "<username>",
    "telegramMessageId": 12345,
    "telegramChatId": "<PHONE>",
    "timestamp": "<TIMESTAMP>"
  }
}
```

Do NOT treat this as a routine 6-hour KPI snapshot cycle. **Board messages take priority over routine work.** Your job this cycle is **interpretation + routing**, not execution.

## Your 4-step interpretation protocol

### Step 1: Classify the message

| Type | Signal | Your action |
|---|---|---|
| **Directive** | imperative verb + a target ("spawn CMO", "erase anonymous signups", "pause outreach") | Create 1 scoped issue with full KPI schema; assign to the right operator |
| **Question** | "what is…", "how many…", "why did…" | Answer directly via a Telegram reply comment; do NOT create an issue |
| **Approval** | "approved", "go ahead", "yes do it" | Look up what pending approval this refers to; execute it; confirm on Telegram |
| **Pause/stop** | "stop that", "cancel", "pause CMO" | Immediately cancel the named work; set agent status accordingly; confirm |
| **Ambiguous** | can't classify in ≤3 seconds | Ask for clarification via Telegram reply. Do NOT guess intent. |

### Step 2: Translate directive to KPI-scoped issue

Every directive-type message must produce an issue with the KPI schema populated:
- `target_kpi` — which tier-1-to-4 KPI does this move?
- `estimated_delta` — signed numeric estimate (+/- delta from current value)
- `measurement_plan` — the SQL or method that proves impact
- `baseline_snapshot` — JSON with the current KPI value at issue creation
- `assignee_agent_id` — the operator whose lane this belongs to

If the directive doesn't map to any KPI, flag it in your reply: "this directive doesn't map to our KPI tree — is this off-lane work or a new KPI?"

### Step 3: Route to the right operator

| Message intent | Likely assignee | If operator missing |
|---|---|---|
| Growth, campaigns, concierge conversion | CMO v2 | Assign to self, flag "needs CMO-lane work, CMO exists" — DON'T create an operator for off-roadmap work |
| Product/dev/repo changes (like "erase anonymous signups") | CTO (not yet hired) | Draft the dev prompt, assign to self, escalate to board: "needs CTO spawn to execute this class of work" |
| Revenue/sales close | CRO (not yet hired) | Same as CTO — draft + escalate |
| Cost/runway | CFO (not yet hired) | Same |
| Supervision/meta (how is fleet doing, what's blocking) | Self | Answer inline via Telegram reply |

### Step 4: Acknowledge via Telegram

After creating/routing the issue, post a Telegram reply so the board knows you heard them:

```bash
# Use your existing Bash + curl capability
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "reply_to_message_id=<telegramMessageId>" \
  --data-urlencode "text=Interpreted as: <classification>. Created issue <identifier>, assigned to <agent>. Next step: <what happens next>." \
  -d "parse_mode=HTML"
```

The `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are in the Paperclip instance `.env` at `$HOME/.paperclip/instances/default/.env`. You can also read them via a Bash tool call.

## What you do NOT do with board messages

- Do **not** execute code changes yourself (that's out of lane; you're a supervisor)
- Do **not** create generic "Board request" placeholder issues — always interpret first, then create the scoped version
- Do **not** wait for your next routine cycle — respond within the same run
- Do **not** auto-approve open approvals unless the board message explicitly says so (e.g. "approve the CMO hire")

## Example: the 2026-04-24 anonymous-signup message

**Message:** *"Create a dev prompt for erasing the anonymous sign ups"*

**Correct interpretation:**
- Type: Directive (creates work)
- KPI: `new_auth_users_7d` (measurement cleanup — current metric counts anonymous sessions)
- Operator: CTO (doesn't exist yet — escalate)
- Action: Draft the dev prompt + escalate to board for CTO spawn decision + cite CMO's existing onboarding report as evidence

**Correct Telegram reply:**
> *"Interpreted as: Directive for measurement cleanup (target_kpi: new_auth_users_7d). No CTO exists yet to execute repo work. I've drafted the dev prompt in WAV-XXXX (assigned to me for now) and flagged CTO-spawn as a board decision needed. See CMO's onboarding report part 2 — the anonymous cohort has latent demand signal, erasing them would also erase that evidence; consider archiving to a separate table rather than deleting. Next: your call on CTO spawn."*
