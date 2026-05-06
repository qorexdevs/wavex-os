# Security policy

WaveX OS is a young project that handles credentials (Claude Max OAuth tokens, Composio API keys, Stripe keys, Telegram bot tokens). Security regressions are P0.

---

## Reporting a vulnerability

**Please do not file a public GitHub issue for security problems.**

Email or DM the maintainer directly via the contact information on the [aimerdoux](https://github.com/aimerdoux) GitHub profile, with `[wavex-os security]` in the subject line. Include:

- Affected component (which package, which file if known).
- Steps to reproduce.
- Impact (what the attacker can do).
- Whether it's already public knowledge.

We will acknowledge within 72 hours, and aim to ship a patched release within 7 days for critical issues.

---

## In-scope

- Credential exfiltration (any path that causes a user's Anthropic, Stripe, Composio, Telegram, or other secret to leave their machine without explicit consent).
- The `wavex-claude` wrapper (`scripts/wrappers/claude-anthropic-direct.sh`) — token resolution, environment leakage, command injection.
- The `mock-core` server — request smuggling, SSRF, RCE in any endpoint.
- The onboarding wizard — XSS, prompt injection that escapes a sandboxed context, persistence-tampering across sessions.
- The npm package published from `apps/installer/` (Phase F).
- Public CI / GitHub Actions secrets (when those land).

## Out of scope

- Issues in Paperclip's vendored code at `packages/core/` — please report those upstream at [paperclip-ai/paperclip](https://github.com/paperclip-ai/paperclip).
- Issues in the System Optimizer hosted backend (when deployed) — that has its own security policy.
- Pure DoS via heavy-but-legitimate inputs.
- Issues in pinned third-party dependencies — unless we're using them in an unsafe way.

---

## What we already do

- **Hardened `.gitignore`** blocks `.env*`, `*.pem`, `*.key`, `secrets.json`, `credentials.json`, `~/.paperclip/`, `.claude/projects/`, lookalike paths.
- **Pre-commit secret scan** is a manual checklist today (will become a `pre-commit` hook in Phase F): every PR runs `grep -RInE` for known token patterns and personal paths over the diff.
- **PII scrub at template-ingest time** — `scripts/ingest-agency-agents.mjs` strips company-specific identifiers before templates land in `packages/agent-templates/`.
- **OAuth handoff design** — the wrapper script reads from the system keychain and never echoes the credential to disk, stdout (in non-verbose mode), or the network. Mock-core sees only the probe result.

---

## What's coming

- Phase F: secrets policy enforcement in CI (gitleaks or similar).
- Phase F: signed releases for the npm-published `wavex-os` installer.
- Phase F: documented, audited keychain integration on Linux (`secret-tool`) and Windows (`cmdkey`).
- Phase G+: subprocess sandboxing for spawned agents (so a runaway agent can't read your `~/.ssh/`).

---

## Acknowledgments

We will credit reporters in release notes (with their consent) once a public fix ships.
