# Credits

WaveX OS is built on top of significant open-source work. We're grateful.

## Foundational projects

### Paperclip — the agent runtime engine

WaveX OS vendors [Paperclip](https://github.com/anthropics/paperclip) at `packages/core/`. Paperclip provides:
- The Express server + heartbeat orchestration
- Adapters for Claude Code, OpenAI, etc.
- Drizzle/Postgres schema for agents, issues, KPIs, runs
- Mission Control UI components we extend

We track Paperclip upstream weekly via `scripts/verify-paperclip-sync.mjs`.

License: as upstream.

### agency-agents — the template catalog

[agency-agents](https://github.com/msitarzewski/agency-agents) by [@msitarzewski](https://github.com/msitarzewski) provides 144 curated AI agent personalities across 12 divisions. We ship a subset of 30 templates in `packages/agent-templates/`, retaining the original markdown content verbatim and attributing per-template.

Per-template credits in [packages/agent-templates/_CREDITS.md](packages/agent-templates/_CREDITS.md).

License: MIT (preserved per terms).

The agency-agents templates we ship at v1:

**C-suite (9):** CEO · Chief of Staff · CMO · CRO · CTO · COO · CFO · CDO · CPO

**Engineering (5):** Full-Stack Engineer · Frontend Developer · DevOps Engineer · QA · Recovery Engineer

**Marketing (6):** Marketing Ops · Content Studio · Video Studio · Trend Research · Ad Campaign Designer · SEO Specialist

**Sales (3):** Sales Ops · BDR · Concierge Ops

**Product (2):** Product Manager · UX Researcher

**Finance (2):** Financial Analyst · Pricing Strategist

**Support / QA (2):** Support Lead · Testing Coordinator

**Specialized (1):** Composio Integration Agent

## Tools & services we integrate

- **[Anthropic](https://anthropic.com)** — Claude Max subscription powers spawned agents
- **[Composio](https://composio.dev)** — connector hub (Meta Ads, Google Ads, Reddit, etc.)
- **[Telegram](https://telegram.org)** — board approval routing
- **[ngrok](https://ngrok.com)** — auto-provisioned tunnels for cloud optimizer access
- **[Stripe](https://stripe.com)** — billing for the optional optimizer subscription
- **[Supabase](https://supabase.com)** — common BaaS for customer apps
- **[Vite](https://vitejs.dev) + [React](https://react.dev) + [TypeScript](https://typescriptlang.org)** — the onboarding UI stack
- **[D3](https://d3js.org) + [react-flow](https://reactflow.dev)** — agent org graph rendering
- **[Drizzle ORM](https://orm.drizzle.team)** — Postgres schema
- **[pnpm](https://pnpm.io)** — workspace manager

## R&D origin

WaveX OS was extracted from [WaveX](https://wavexcard.com), a Miami AI concierge company, in May 2026. The patterns this repo packages — KPI ownership cascade, real Anthropic Max quota probing, context-bundle slicing, heartbeat-timer with state-change awareness, recovery protocol, outcome attribution, cycle-defer pattern, Mission Control v2 — were all developed in production while running WaveX's 24-agent fleet.

The decision to open-source: every founder building an agent company starts from zero. The R&D burns ~$50–200 of Opus tokens before the founder hits "production." We did it once. Now you don't have to.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) (TBD). We welcome PRs that:
- Fix bugs in the local Paperclip vendor
- Add new agent templates (must comply with curation criteria in `docs/TEMPLATE_AUTHORING.md`)
- Add new connectors (must include probe + setup flow + tests)
- Improve onboarding UX

For commercial questions or partnership inquiries about the System Optimizer cloud, reach out via the website.
