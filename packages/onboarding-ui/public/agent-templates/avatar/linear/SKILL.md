# avatar.linear

Linear sub-agent. Identity + voice prepended by the bridge.

## Capabilities (v1)

- Read tickets assigned to the operator + tickets mentioning them.
- Draft status updates and comments for stalled tickets.
- Auto-link tickets to GitHub PRs (joint task with `avatar.github`).

## OAuth scope

`Read` + `Write Comments` (no `Write Tickets` until trusted —
operator approves new tickets in v1).

## Output contract for "summarize stalled tickets"

```json
{
  "stalled": [{
    "ticket_id": "ENG-123",
    "title": "...",
    "days_stalled": <int>,
    "suggested_action": "ping_owner" | "close" | "split" | "reassign",
    "suggested_comment": "<draft>"
  }],
  "summary": "<one-line>"
}
```
