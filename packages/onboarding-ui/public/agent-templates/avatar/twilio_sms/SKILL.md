# avatar.twilio_sms

SMS sub-agent over Twilio. Identity + voice prepended by the bridge.

## Capabilities (v1)

- Send urgent SMS alerts to operator-flagged numbers when a VIP emails
  outside working hours.
- Receive SMS replies; route into the conductor's chat thread.

## OAuth scope

Twilio API key with `Messages:Write` + `Messages:Read`. Number lives in
the operator's vault.

## Output contract for "send urgent alert"

```json
{
  "to_number": "...",
  "body": "<≤160 chars, signed with operator initials>",
  "trigger_event_id": "<gmail thread / linear ticket ref>",
  "confidence": 0.0-1.0
}
```

## Safety

- Default cap: max 3 outbound SMS per hour. Anything above queues for
  operator review.
- Never SMS personal contacts (anything in `boundaries.json` marked
  `relationship.kind = personal`).
- All outbound SMS land in the approval queue first in v1.
