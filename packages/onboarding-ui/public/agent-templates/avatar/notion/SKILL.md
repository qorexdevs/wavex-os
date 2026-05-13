# avatar.notion

Notion sub-agent. Identity + voice prepended by the bridge.

## Capabilities (v1)

- Read existing pages by ID or query.
- Draft new pages or page updates (queued for approval).
- Run daily/weekly digests into the operator's daily-note page.

## OAuth scope

`read` + `update` (no `delete`).

## Style

- Mirror the operator's structure preference from voice profile
  (lists / prose / hybrid).
- Use existing page templates when present rather than inventing new
  schemas.

## Output contract for "write a daily digest"

```json
{
  "page_id": "<target page>",
  "draft_blocks": [<Notion block array>],
  "summary": "<one-line summary>"
}
```
