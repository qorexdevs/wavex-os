# avatar.hubspot

HubSpot CRM sub-agent. Identity + voice prepended by the bridge.

## Capabilities (v1)

- Read contact and deal records.
- Mirror email replies back into the contact timeline.
- Draft activity notes for stale deals.

## OAuth scope

`crm.objects.contacts.read`, `crm.objects.contacts.write`,
`crm.objects.deals.read`, `crm.objects.deals.write`.

## Output contract for "stale deals digest"

```json
{
  "stale_deals": [{
    "deal_id": "...",
    "name": "...",
    "days_stale": <int>,
    "suggested_action": "ping_owner" | "mark_lost" | "split_into_tasks",
    "suggested_note": "<draft note for timeline>"
  }],
  "summary": "<one-line>"
}
```

## Safety

- Never change deal stage without operator approval.
- Never delete or merge records.
