# WaveX OS — Architecture

> Status: Phase B (scaffold). This document describes the **target** architecture; implementation lands across phases B → G. See [ROADMAP.md](./ROADMAP.md) for delivery cadence.

---

## 1. Core principle: three-axis design

WaveX OS is the open-source product layer on top of [Paperclip](https://github.com/paperclip-ai/paperclip) (the agent runtime engine). Three axes were considered up front because they each have different cost / control / privacy tradeoffs:

| Axis | Options | WaveX OS choice |
|------|---------|-----------------|
| **Inference origin** | Hosted-only · Local-only · **Hybrid** | **Hybrid**. Onboarding agent uses hosted inference (free trial, capped at 30K tokens). Spawned fleet uses **your** Claude Max subscription via local OAuth handoff. |
| **Control surface** | CLI · MCP bridge · **Localhost browser UI** | **Localhost browser UI**. The user clones the repo, runs `npx wavex-os init`, the installer opens `http://localhost:5173` for an 11-step onboarding wizard. The UI talks to a local Paperclip server on `:3100`. |
| **Personalization** | Vendored static · Curated mix · Dynamic AI-tuned | **Curated** (Phase B) → **dynamic** (Phase F). 30 templates ship in-repo (19 vendored from `agency-agents`, 11 WaveX-authored). Phase F adds an onboarding-agent-driven chat that customizes them in-place under a 30K-token-per-session cap. |

The result: **your data, your inference, your agents** — once you finish onboarding, nothing about your fleet has to leave your machine. The hosted System Optimizer (paid, optional) is a *prompt-injection* layer on top, not a dependency.

---

## 2. High-level component graph

```
┌─────────────────────────────────────────────────────────────────┐
│  USER MACHINE (localhost-only by default)                       │
│                                                                 │
│  ┌──────────────────────┐      ┌───────────────────────────┐    │
│  │ Browser              │      │ Paperclip server          │    │
│  │  http://localhost:   │      │  http://127.0.0.1:3100    │    │
│  │     5173             │ ───► │                           │    │
│  │                      │ HTTP │  - Drizzle / Postgres OR  │    │
│  │ packages/            │      │    SQLite (default)       │    │
│  │   onboarding-ui      │      │  - heartbeat scheduler    │    │
│  │  (Vite + React)      │      │  - issues/comments/agents │    │
│  └──────────────────────┘      └───────────────────────────┘    │
│           │                              │                      │
│           │                              │ spawn()              │
│           ▼                              ▼                      │
│  ┌──────────────────────┐      ┌───────────────────────────┐    │
│  │ macOS Keychain /     │      │ Spawned agents            │    │
│  │ secret store         │ ───► │  (Claude CLI processes,   │    │
│  │  (Claude Max OAuth)  │ read │   wrapped per-agent)      │    │
│  └──────────────────────┘      └───────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  │  optional, paid (Phase F)
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  WAVEX HOSTED — System Optimizer (api.wavex-os.com)             │
│                                                                 │
│  - daily/hourly cron: pulls fleet KPI digest                    │
│  - injects board-level prompts → CEO/CoS via Paperclip API      │
│  - billing (Stripe, future)                                     │
│                                                                 │
│  Tokens never travel here. Only KPI metadata + the              │
│  injection body do.                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Repo layout

```
wavex-os/
├── apps/
│   └── installer/              # `npx wavex-os init` (TypeScript CLI)
│       ├── src/init.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── core/                   # Paperclip, vendored via git subtree
│   │                           # (origin: github.com/paperclip-ai/paperclip)
│   ├── onboarding-ui/          # Vite + React 18 + TypeScript
│   │   ├── src/
│   │   │   ├── pages/onboarding/   # 11 wizard steps
│   │   │   ├── components/
│   │   │   ├── store.ts            # zustand + persist
│   │   │   └── main.tsx
│   │   ├── vite.config.ts
│   │   └── package.json
│   ├── agent-templates/        # 30 curated templates
│   │   ├── _registry.json
│   │   ├── _CREDITS.md
│   │   └── <division>/<role>.md
│   └── onboarding-server-client/
│       └── src/index.ts        # typed stub for hosted backend (Phase D+)
│
├── scripts/
│   └── ingest-agency-agents.mjs    # converts upstream → curated
│
├── docs/
│   ├── ARCHITECTURE.md         # this file
│   └── ROADMAP.md
│
├── README.md
├── LICENSE                     # MIT
└── CREDITS.md                  # full attribution chain
```

The reason `core/` is a **subtree** and not a submodule:
- One-clone install (subtrees ship with the parent repo's history).
- We can patch core for WaveX-specific needs without forking upstream.
- Pulling new Paperclip releases is `git subtree pull --prefix=packages/core paperclip-local master --squash`.

---

## 4. Onboarding flow (11 steps)

Each step is a route under `/onboarding/:slug`. State is persisted in `localStorage` via zustand `persist`, keyed `wavex-os-onboarding`.

| # | Slug | Purpose | Phase B status |
|---|------|---------|-----------------|
| 1 | `welcome` | Company name + industry | ✅ functional |
| 2 | `goal` | One headline KPI, current/target/window | ✅ functional |
| 3 | `connectors` | 7 connector cards (Claude Max required) | ✅ stub-connect |
| 4 | `org-design` | Default org tree preview | ✅ static preview |
| 5 | `template-picker` | 30 templates grouped by division | ✅ static preview |
| 6 | `kpi-ownership` | Drag-drop KPI → owner mapping | 🚧 stub (Phase C) |
| 7 | `customize-chat` | Free-form chat, 30K-token cap | 🚧 stub (Phase D) |
| 8 | `manifest-review` | Final JSON dump | ✅ live |
| 9 | `spawn` | Live progress feed (SSE) | 🚧 stub (Phase C) |
| 10 | `handoff` | Claude Max OAuth bind via wrapper | 🚧 stub (Phase E) |
| 11 | `subscription` | System Optimizer tier picker | 🚧 stub (Phase F) |

---

## 5. The OAuth handoff (the load-bearing piece)

The hardest design problem was: **how does the spawned fleet inherit the user's Claude Max subscription without the token ever touching our servers?** Three options were considered:

- **A: pass the token through hosted backend** — rejected, security/privacy nightmare.
- **B: user copies token manually** — rejected, terrible UX.
- **C: wrapper script reads keychain on every heartbeat** — **chosen**. Token never leaves the user's machine. The Paperclip-spawned agent invokes `claude-anthropic-direct.sh`, which reads from the macOS Keychain (or platform-equivalent), refreshes on 401, falls back to Sonnet on rate-limit. This is the same wrapper pattern proven out in the WaveX OS prototype.

Phase E will productionize the wrapper:
- macOS: `security find-generic-password -s 'Claude Code-credentials' -w`
- Linux: `secret-tool lookup application 'Claude Code'`
- Windows: `cmdkey`-based equivalent

---

## 6. Templates: vendored vs. WaveX-authored

The 30 curated templates split into:
- **19 vendored** from [`msitarzewski/agency-agents`](https://github.com/msitarzewski/agency-agents) (MIT, credited per-file)
- **11 WaveX-authored** for roles missing or significantly different upstream:
  CEO, Chief of Staff, CMO, CRO, CTO, COO, CFO, CDO, CPO, Recovery Engineer, Concierge Ops, Composio Integration

`scripts/ingest-agency-agents.mjs` is the single source of truth for the import — re-run it after the upstream repo updates.

All templates are scrubbed for PII before being committed. See [CREDITS.md](../CREDITS.md) for the full attribution chain and license summary.

---

## 7. Subscription tiers (Phase F design)

| Tier | Price | Daily injections | Monthly tokens | Audience |
|------|-------|------------------|----------------|----------|
| Trial | $0 (14 days) | 1 | 200K | First-touch evaluation |
| Founder | $29/mo | 1 | 500K | Solo founder running 5–10 agents |
| Growth | $99/mo | 8 (hourly biz hours) | 2M | Small team, mid-velocity fleet |
| Custom | $299/mo | Unlimited | 10M+ | High-velocity, white-glove |

**Self-host path (always free):** the System Optimizer is a small cron job. We will publish it as a separate Docker image (`wavex-os-optimizer`) so anyone can run their own with their own API key. See `docs/SELF_HOSTING.md` (Phase F).

---

## 8. Security posture

- **No telemetry** — the localhost UI does not call out except to the local Paperclip server.
- **No secrets in repo** — `.gitignore` blocks `.env*`, `*.pem`, `*.key`, `secrets.json`, `~/.paperclip/`, `.claude/projects/`.
- **OAuth handoff is local-only** — see Section 5.
- **Templates are PII-scrubbed** at ingest time (see `scripts/ingest-agency-agents.mjs`).
- **Workflows that touch external services** (Composio, Stripe, GitHub) require explicit board approval before the spawned agents are allowed to call them.

---

## 9. Open architectural questions (deliberately unresolved)

- Should the hosted backend support BYO-key for the System Optimizer (i.e. user supplies their own Anthropic API key, we just run the cron)? Likely yes, leaning into the open-core philosophy. Decide before Phase F.
- How do we keep `packages/core/` synced with upstream Paperclip without dragging in things that conflict with WaveX customizations? Need a "WaveX-safe upstream patches" workflow. Decide during Phase C.
- Does the customize-chat (step 7) talk to the hosted backend or the local Paperclip server? Hosted gives a better trial experience; local respects "your data never leaves" more strictly. Likely **hosted with explicit consent**, but TBD at Phase D.
