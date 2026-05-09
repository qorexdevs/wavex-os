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

- **Hardened `.gitignore`** blocks `.env*`, `*.pem`, `*.key`, `secrets.json`, `credentials.json`, `~/.paperclip/`, `.claude/projects/`, `wavex-os.config.json`, lookalike paths.
- **Pre-commit secret scan** is a manual checklist today (will become a `pre-commit` hook in Phase F): every PR runs `grep -RInE` for known token patterns and personal paths over the diff.
- **PII scrub at template-ingest time** — `scripts/ingest-agency-agents.mjs` strips company-specific identifiers before templates land in `packages/onboarding-ui/public/agent-templates/`.
- **OAuth handoff design** — the wrapper script reads from the system keychain and never echoes the credential to disk, stdout (in non-verbose mode), or the network. Mock-core sees only the probe result.
- **Per-spawn wrapper hardening** (`scripts/wrappers/claude-spawn.sh`) — strips inherited Anthropic env vars before exec to prevent the wrapped CLI from routing through a stale or unintended endpoint. Token never persists outside the keychain.

---

## What's intentionally NOT in this repo

This is enforceable convention; it's also the v0.2.0 release contract. None of the following ships as code, configuration, or example data:

- Real OAuth tokens, refresh tokens, keychain dumps.
- Real Telegram bot tokens, chat IDs, or any third-party API keys.
- Specific company UUIDs, agent UUIDs, or per-tenant identifiers (the originating WaveX deployment's UUIDs are scrubbed).
- Real KPI definitions tied to a specific industry. The shipped `examples/kpi-registry.example.json` uses generic placeholders (revenue_target_30d, qualified_leads_7d, etc.) — your deployment substitutes its own.
- Customer data or scraped lead lists.
- Personal hostnames, ngrok URLs, IP addresses.
- Internal product URLs.

If you find any of the above in the repo, **treat it as a P0 vulnerability** and follow the reporting process at the top of this document.

---

## What's coming

- Phase F: secrets policy enforcement in CI (gitleaks or similar).
- Phase F: signed releases for the npm-published `wavex-os` installer.
- Phase F: documented, audited keychain integration on Linux (`secret-tool`) and Windows (`cmdkey`).
- Phase G+: subprocess sandboxing for spawned agents (so a runaway agent can't read your `~/.ssh/`).

---

## Acknowledgments

We will credit reporters in release notes (with their consent) once a public fix ships.
