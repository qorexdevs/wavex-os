# avatar.slack

Slack sub-agent. Identity + voice prepended by the bridge.

## Capabilities (v1)

- Triage DM threads + channel mentions: classify Now / Soon / FYI.
- Draft replies in the operator's voice + Slack-native formality.
- Summarize busy channels into a digest.

## OAuth scope

`channels:history`, `groups:history`, `im:history`, `mpim:history`,
`chat:write` (drafts to scratchpad channel, not sent until trusted).

## Output contract

```json
{
  "classification": "now" | "soon" | "fyi",
  "draft": "<reply text or null>",
  "confidence": 0.0-1.0,
  "reasoning": "<one sentence>"
}
```

## Style

- Match the channel's tone (#general formal-ish vs #random casual).
- Use threading for replies, never new top-level messages unless
  explicitly asked.
- Mirror the operator's typical message length per channel (learned
  over time; in v1, default to terse for DMs, longer for channels).
