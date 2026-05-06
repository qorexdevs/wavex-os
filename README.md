# WaveX OS

> Open-source operating system for running an AI agent company on your own machine.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

WaveX OS turns one founder's hard-won R&D into a 45-minute setup wizard. You clone the repo, run one command, and a localhost browser walks you through defining your company — KPIs, org structure, agent templates, connectors. Authorize once with your Claude Max subscription, and the wizard spawns 5–25 agents wired to your goals.

After spawn, an optional **System Optimizer** subscription on our cloud injects board-level reasoning into your fleet on a daily cadence — using your Claude Max OAuth on our infrastructure. Code is free. The optimizer is a tiered membership.

## Quickstart

```bash
npx wavex-os init my-company
cd my-company
pnpm dev
```

Browser auto-opens at `http://localhost:5173/onboarding`. Follow the wizard.

## What's in the box

| Layer | What it does |
|---|---|
| `packages/core` | Vendored [Paperclip](https://github.com/anthropics/paperclip) — the agent runtime |
| `packages/onboarding-ui` | Browser wizard for company setup |
| `packages/agent-templates` | 30 curated templates from [agency-agents](https://github.com/msitarzewski/agency-agents) (MIT) — see [CREDITS](CREDITS.md) |
| `packages/connectors` | First-class Composio, Telegram, ngrok, Stripe, Supabase, GitHub |
| `packages/mission-control-v2` | KPI scoreboard + agent org graph + workflow queue |
| `packages/system-optimizer-client` | Hooks for the optional cloud optimizer subscription |

## Architecture

- **Local:** Paperclip server (`localhost:3100`) runs your agents. Onboarding UI (`localhost:5173`) is a Vite/React wizard.
- **Cloud (optional):** WaveX OS Cloud at `api.wavex.os` runs the System Optimizer for paid subscribers. Code stays local; only ngrok-tunneled state crosses the wire when you opt in.
- **OAuth:** Your Claude Max subscription powers the spawned agents via the wrapper script. Token never leaves your machine.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full diagram.

## Pricing

- **Code:** free, MIT, fork it
- **System Optimizer (optional cloud subscription):**
  - Trial — 14 days free
  - Founder — $29/mo (1 daily injection, 500K tokens/mo)
  - Growth — $99/mo (hourly during business hours, 2M tokens, on-demand asks)
  - Custom — $299/mo (unlimited, dedicated optimizer)

You can self-host the optimizer too — see [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## Credits

WaveX OS stands on the shoulders of:

- **[Paperclip](https://github.com/anthropics/paperclip)** — the agent runtime engine, vendored into `packages/core/`
- **[agency-agents](https://github.com/msitarzewski/agency-agents)** by [@msitarzewski](https://github.com/msitarzewski) — 144 agent templates (MIT), 30 of which we curate into `packages/agent-templates/`. Per-template attribution in [CREDITS.md](packages/agent-templates/_CREDITS.md).
- **[Anthropic](https://anthropic.com)** — Claude Max subscription powers the agents.
- **[Composio](https://composio.dev)** — connector hub for Meta Ads, Google Ads, and more.

See [CREDITS.md](CREDITS.md) for the comprehensive list.

## Status

🚧 **v0.1.0 — Phase A (foundation)**. See [docs/ROADMAP.md](docs/ROADMAP.md).

## License

MIT. See [LICENSE](LICENSE).
