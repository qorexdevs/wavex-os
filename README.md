# WaveX OS

> Open-source operating system for running an AI agent company on your localhost.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status: 0.1.0 / Phase G](https://img.shields.io/badge/status-0.1.0%20%E2%80%94%20Phase%20G-4ec9b0)](docs/ROADMAP.md)
[![Built on Paperclip](https://img.shields.io/badge/built%20on-Paperclip-86c5da)](https://github.com/paperclip-ai/paperclip)

WaveX OS turns one founder's hard-won R&D into a 45-minute setup wizard. Clone the repo, run one command, and a localhost browser walks you through 11 steps to define your company — KPIs, org structure, agent templates, OAuth handoff. The wizard then spawns your fleet on a local server and drops you on a real Mission Control dashboard.

After spawn, an optional **System Optimizer** subscription on our cloud injects board-level reasoning into your fleet on a daily cadence — using your Claude Max OAuth on our infrastructure. Code is free. The optimizer is a tiered membership.

---

## What works today (v0.1.0)

| Step | What you do | What we built |
|---|---|---|
| 1–2 | Name your company, define your headline KPI | Form + zustand-persisted state |
| 3 | Connect Claude Max + 6 optional integrations | Stub-connect (Phase D wires real OAuth flows) |
| 4 | See your default org tree | Interactive [reactflow](https://reactflow.dev) graph, drag nodes |
| 5 | Browse 30 curated agent templates | Click any tile → modal with skill markdown + KPIs + origin badge |
| 6 | Review KPI ownership | Auto-built from primary goal + each template's `defaultKpis` |
| 7 | Customize via chat | UI + token-budget meter (Phase D wires real inference) |
| 8 | Review your manifest | Live JSON dump of everything you configured |
| 9 | Spawn your fleet | Live SSE feed from `mock-core` — agents persist to `~/.wavex-os/instances/<co>/agents.json` |
| 10 | OAuth handoff | Real keychain probe via `wavex-claude` wrapper — credential never leaves your machine |
| 11 | Subscribe (optional) | Tier picker (Phase F wires Stripe) |
| → | Mission Control | Live dashboard at `/` — KPI scoreboard, fleet graph polling agents API every 8s, core health strip every 5s |

See [docs/ROADMAP.md](docs/ROADMAP.md) for the phase plan and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design.

---

## Quickstart

You need [Node ≥18](https://nodejs.org), [pnpm ≥8](https://pnpm.io), and [git](https://git-scm.com).

```bash
git clone https://github.com/aimerdoux/wavex-os.git
cd wavex-os
pnpm install
pnpm dev
```

This boots two servers in parallel:

- `http://localhost:5173` — onboarding wizard + Mission Control (Vite + React)
- `http://localhost:3101` — `mock-core` (in-memory Paperclip stand-in until Phase D)

Open [http://localhost:5173](http://localhost:5173) and you'll land on Mission Control. Click **Start onboarding** to begin the wizard.

> **`npx wavex-os init`** is in the box but ships from `apps/installer/` — Phase F will publish to npm. For now, `pnpm dev` is the supported path.

---

## What's in the box

```
wavex-os/
├── apps/installer/              # `npx wavex-os init` CLI (doctor + spawn dev:full)
├── packages/
│   ├── core/                    # Paperclip vendored via git subtree (Phase D will wire it up)
│   ├── mock-core/               # In-memory stand-in for Paperclip; Fastify on :3101
│   ├── onboarding-ui/           # Vite + React wizard + Mission Control v2
│   ├── agent-templates/         # 30 curated templates (19 vendored + 11 WaveX-authored)
│   └── onboarding-server-client/ # Typed stub for the future hosted backend
├── scripts/
│   ├── wrappers/
│   │   └── claude-anthropic-direct.sh   # Claude Max OAuth wrapper (probe / exec)
│   └── ingest-agency-agents.mjs # Re-runnable upstream → curated template ingester
└── docs/
    ├── ARCHITECTURE.md
    ├── CLAUDE_MAX_HANDOFF.md
    └── ROADMAP.md
```

---

## Architecture

```
       ┌──── localhost (your machine) ───────────────────────────────┐
       │                                                             │
       │  Browser  ──HTTP──▶  Vite UI  ──proxy──▶  mock-core (3101)  │
       │                       (5173)                  │              │
       │                                                ▼              │
       │                                         macOS Keychain        │
       │                                  via wavex-claude wrapper      │
       │                          (token never leaves this box)         │
       └─────────────────────────────────────────────────────────────┘
                                       ▲
                                       │  Phase F: optional, paid
                                       │  System Optimizer cron pulls
                                       │  KPI digest, posts board-level
                                       │  injection back as a comment
                                       ▼
                            api.wavex-os.com  (planned)
```

Three design principles:

1. **Your data, your inference.** Spawned agents use *your* Claude Max plan via the wrapper. Token never crosses the wire.
2. **Open-source first, paid optimizer second.** The full local product is MIT. Hosted optimizer is a tier on top.
3. **Subtractive over additive.** Every phase has a single exit criterion. We cut features that don't pull their weight.

Full design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). OAuth handoff details: [docs/CLAUDE_MAX_HANDOFF.md](docs/CLAUDE_MAX_HANDOFF.md).

---

## Pricing

- **Code:** free, MIT, fork it.
- **System Optimizer (optional cloud subscription, Phase F):**
  - Trial — 14 days free
  - Founder — $29/mo (1 daily injection, 500K tokens/mo)
  - Growth — $99/mo (hourly during business hours, 2M tokens, on-demand asks)
  - Custom — $299/mo (unlimited, dedicated optimizer)

You can self-host the optimizer too — `docs/SELF_HOSTING.md` lands with Phase F.

---

## Credits

WaveX OS stands on the shoulders of:

- **[Paperclip](https://github.com/paperclip-ai/paperclip)** — the agent runtime engine, vendored via git subtree at `packages/core/`.
- **[agency-agents](https://github.com/msitarzewski/agency-agents)** by [@msitarzewski](https://github.com/msitarzewski) — 207 agent templates (MIT). 19 of them are vendored into `packages/agent-templates/` with per-file attribution.
- **[Anthropic](https://anthropic.com)** — Claude Max powers the spawned agents.
- **[reactflow](https://reactflow.dev)** — drives both the onboarding org-design step and the Mission Control fleet graph.
- **[Fastify](https://fastify.dev)** — the mock-core HTTP server.

Full attribution: [CREDITS.md](CREDITS.md).

---

## Status

**v0.1.0 — Phase G** (Mission Control). The wizard → product loop is closed end-to-end with mock-core. Phase D will swap in real Paperclip; Phase E completes OAuth handoff (per-agent symlinks + smoke heartbeat); Phase F adds Stripe + the hosted Optimizer.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full plan and what's done.

---

## License

MIT. See [LICENSE](LICENSE).
