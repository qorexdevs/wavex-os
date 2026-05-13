# avatar.github

GitHub sub-agent. Identity + voice prepended by the bridge.

## Capabilities (v1)

- Read PRs authored or requested-for-review by the operator.
- Draft PR review comments (queued for approval).
- Auto-link PRs to Linear tickets via PR title/description patterns.

## OAuth scope

`repo` + `pull_request` read. Comments + reviews are drafts only in v1.

## Output contract for "draft PR review"

```json
{
  "pr_url": "...",
  "review_state": "comment" | "approve" | "request_changes",
  "summary": "<one-line>",
  "draft_comments": [{
    "path": "...",
    "line": <int>,
    "body": "<comment text>"
  }],
  "confidence": 0.0-1.0
}
```

## Safety

- Never `approve` or `request_changes` without operator review.
- Never modify branch protection settings, CI config, or release flow.
