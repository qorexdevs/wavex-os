# Contributing to WaveX OS

Thanks for considering a contribution. WaveX OS is in active development; the easiest way to help is to clone, run, and report what breaks.

---

## Quickstart for contributors

```bash
git clone https://github.com/aimerdoux/wavex-os.git
cd wavex-os
pnpm install
pnpm dev          # runs onboarding-ui + mock-core in parallel
```

Open [http://localhost:5173](http://localhost:5173) — you'll land on Mission Control.

To work on individual packages:

```bash
pnpm dev:ui       # just the onboarding wizard
pnpm dev:core     # just the mock-core server
```

---

## Repo layout

| Path | What it is |
|---|---|
| `apps/installer/` | `npx wavex-os init` CLI |
| `packages/onboarding-ui/` | Vite + React wizard + Mission Control |
| `packages/mock-core/` | In-memory Paperclip stand-in (Fastify on :3101) |
| `packages/agent-templates/` | 30 curated agent templates |
| `packages/core/` | Paperclip vendored via git subtree (don't modify directly — see below) |
| `packages/onboarding-server-client/` | Typed stub for future hosted backend |
| `scripts/wrappers/claude-anthropic-direct.sh` | Claude Max OAuth wrapper |
| `scripts/ingest-agency-agents.mjs` | Re-runnable upstream → curated template ingester |
| `docs/` | Architecture, OAuth handoff design, roadmap |

---

## Where to start

| You want to… | Look at |
|---|---|
| Improve a wizard step | `packages/onboarding-ui/src/pages/onboarding/<step>.tsx` |
| Improve Mission Control | `packages/onboarding-ui/src/components/mission/` and `pages/MissionControl.tsx` |
| Add or refine a template | `packages/agent-templates/<id>/SKILL.md` and `_registry.json` |
| Improve the mock backend | `packages/mock-core/src/server.ts` |
| Touch the OAuth wrapper | `scripts/wrappers/claude-anthropic-direct.sh` |
| Update the architecture | `docs/ARCHITECTURE.md` |

---

## Conventions

### Commits
Follow [Conventional Commits](https://www.conventionalcommits.org/) with a phase tag:
```
feat(phase-c): live SSE spawn feed
fix(installer): handle missing pnpm
docs(architecture): clarify OAuth handoff
```

### TypeScript
Every package uses strict TypeScript. Before pushing:
```bash
pnpm --filter @wavex-os/onboarding-ui exec tsc --noEmit
pnpm --filter @wavex-os/mock-core exec tsc -p tsconfig.json
```
The CI for individual packages should pass `tsc --noEmit` and `vite build` (UI) cleanly.

### Bash
The wrapper script (`scripts/wrappers/*.sh`) is `set -euo pipefail` strict bash. Test on macOS at minimum; Linux/Windows paths land in Phase F.

### Templates
Agent templates ship under `packages/agent-templates/<id>/SKILL.md`. They are PII-scrubbed at ingest time (see `scripts/ingest-agency-agents.mjs`). If you modify a template, run a fresh `grep -RInE 'sk-[A-Za-z0-9]+|<your-email>|/Users/'` over the directory before commit.

### Paperclip subtree
`packages/core/` is a git subtree of [paperclip-ai/paperclip](https://github.com/paperclip-ai/paperclip). Do **not** edit files there directly. To pull upstream changes:

```bash
git remote add paperclip-upstream https://github.com/paperclip-ai/paperclip.git
git subtree pull --prefix=packages/core paperclip-upstream master --squash
```

WaveX-specific patches to core land in `patches/` and are applied at build time (Phase D will formalize this).

---

## Security

If you find a security issue (credential leakage, RCE, prototype pollution, etc.), please **do not file a public issue**. Email security concerns directly until we publish a `SECURITY.md`. We treat secret-scanning regressions as P0.

The repo has a hardened `.gitignore` for `.env*`, `*.pem`, `*.key`, `secrets.json`, `~/.paperclip/`, `.claude/projects/`, and similar paths. **Never commit a real Anthropic key, Telegram bot token, Composio token, or Stripe key.** The wrapper's `WAVEX_CLAUDE_STUB=1` gives you a working synthetic credential for plumbing tests.

---

## Pull requests

1. Fork the repo and create a feature branch.
2. Make your change. Match the existing code style (no new linters or formatters in a PR — that's a separate change).
3. Ensure type-check + production build pass on every package you touched.
4. If you changed UX, add a 1–2 sentence note in the PR description on what the user now sees.
5. Open the PR against `main`.

For substantial changes (new package, architectural refactor, new dependency >100KB), open a discussion or issue first — the maintainer will tell you if it fits the roadmap before you sink hours.

---

## Roadmap input

The phase plan is in [docs/ROADMAP.md](docs/ROADMAP.md). If you have a feature request:

- **In-roadmap:** check off an unchecked item via PR.
- **Out-of-roadmap:** open an issue with the rationale and which phase it would slot into. We default to "subtractive" — we cut more than we add — so make the case clearly.

---

## Code of Conduct

Be kind. Disagree on technical merit, not personal grounds. We don't have a long CoC document yet; the [Contributor Covenant](https://www.contributor-covenant.org/) applies in spirit.
