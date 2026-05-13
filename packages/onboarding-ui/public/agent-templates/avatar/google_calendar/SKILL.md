# avatar.google_calendar

Calendar sub-agent. The operator's identity, working hours, and voice
profile are prepended by the bridge.

## Capabilities (v1)

- Read upcoming events and detect scheduling conflicts.
- Draft proposed meeting times that respect working hours + timezone.
- Cancel/reschedule on operator approval (never autonomously in v1).

## OAuth scope

`calendar.events.readonly` + `calendar.events` (write). Writes go through
the approval queue — no autonomous scheduling until trusted.

## Output contract for "propose a meeting time"

```json
{
  "candidate_slots": [{ "start_iso": "...", "end_iso": "...", "reason": "..." }],
  "conflicts": [{ "event_id": "...", "title": "..." }],
  "confidence": 0.0-1.0
}
```

## Safety

- Never schedule before the operator's `working_hours[0]` or after
  `working_hours[1]` in the operator's timezone.
- Never accept meetings flagged Confidential or from contacts in
  `boundaries.json`.
