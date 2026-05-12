# Landing page prompt — paste into Lovable / v0 / Bolt

Build a landing page for **WaveX OS** — an open-source operating system for running an AI agent company on your localhost. Repo: <https://github.com/aimerdoux/wavex-os> (MIT). Currently shipping v0.2.0 (Phase H).

## Tone + design

Developer-first, technical but elegant. Dark mode primary (matte black `#0a0a0a` background, off-white `#e6e6e6` text, single accent: soft mint `#4ec9b0` used for links, KPI numbers, and code-block borders only). Use a monospace font for code/numbers (JetBrains Mono or IBM Plex Mono); a humanist sans for prose (Inter). Tight grid, generous whitespace. No stock illustrations. Prefer:

- One animated terminal showing the quickstart
- One ASCII-art architecture diagram (verbatim from below)
- **A screenshot carousel of the actual wizard** (PNGs in `docs/images/wizard/` of the repo — pull them via raw GitHub URLs)
- One fleet-graph visual (org-chart shape — show the screenshot of Phase 3 swarm)

No marketing fluff. Every word earns its place. Audience: technical founders who run their own machines.

## Sections, in order

### 1. Hero

- Eyebrow: "v0.2.0 — Phase H · MIT licensed"
- H1: "Run an AI agent company on your localhost."
- Subhead: "A ~1 hour wizard turns 5 questions into a 30+ agent fleet, simulated against your goal, then handed off to a live Paperclip runtime. Your Claude Max, your machine, your data."
- Two CTAs: primary **"View on GitHub"** → <https://github.com/aimerdoux/wavex-os>, secondary **"Read the docs"** → <https://github.com/aimerdoux/wavex-os/blob/main/docs/ARCHITECTURE.md>
- Below the CTAs, three pill-badges: "Built on Paperclip" · "Claude Max OAuth" · "165 vetted templates"

### 2. Quickstart (animated terminal)

Render as an animated typewriter terminal that runs in ~6 seconds:

```
$ git clone https://github.com/aimerdoux/wavex-os.git
$ cd wavex-os && pnpm install
$ pnpm -r --filter "./vendor/op-omega/*" build
$ pnpm dev
▶ vite ready on http://localhost:5173
▶ mock-core ready on http://localhost:3101
```

After the terminal, a single sentence: "Open `localhost:5173` and a wizard walks you through 5 pillars + 3 phases."

### 3. Wizard walkthrough (the screenshots)

A scrollable horizontal carousel OR a vertical stack of screenshots (mobile-first → vertical). Each card pairs a screenshot with a one-line caption. Source images:

| Caption | Image (raw GitHub URL) |
|---|---|
| **Start** — pick a company name, or resume a draft | `https://raw.githubusercontent.com/aimerdoux/wavex-os/main/docs/images/wizard/01-welcome.png` |
| **Pillar 1 — Who you are** | `https://raw.githubusercontent.com/aimerdoux/wavex-os/main/docs/images/wizard/02-pillar-1-who.png` |
| **Pillar 1 confirm** — review what was inferred | `https://raw.githubusercontent.com/aimerdoux/wavex-os/main/docs/images/wizard/03-pillar-1-confirm.png` |
| **Pillar 2 — Setup verification** | `https://raw.githubusercontent.com/aimerdoux/wavex-os/main/docs/images/wizard/04-pillar-2-verify.png` |
| **Pillar 3 — Product state** | `https://raw.githubusercontent.com/aimerdoux/wavex-os/main/docs/images/wizard/05-pillar-3-product-state.png` |
| **Pillar 4 — GTM motion** | `https://raw.githubusercontent.com/aimerdoux/wavex-os/main/docs/images/wizard/06-pillar-4-gtm.png` |
| **Pillar 5 — Comms** | `https://raw.githubusercontent.com/aimerdoux/wavex-os/main/docs/images/wizard/07-pillar-5-comms.png` |
| **Phase 2 — Connectors** | `https://raw.githubusercontent.com/aimerdoux/wavex-os/main/docs/images/wizard/08-phase-2-connectors.png` |
| **Credential Concierge** | `https://raw.githubusercontent.com/aimerdoux/wavex-os/main/docs/images/wizard/09-credential-concierge.png` |
| **Phase 3 — Swarm** | `https://raw.githubusercontent.com/aimerdoux/wavex-os/main/docs/images/wizard/10-phase-3-swarm.png` |
| **Phase 4 — Workflow** | `https://raw.githubusercontent.com/aimerdoux/wavex-os/main/docs/images/wizard/11-phase-4-workflow.png` |
| **Finalize — Imprint + Monte Carlo** | `https://raw.githubusercontent.com/aimerdoux/wavex-os/main/docs/images/wizard/12-finalize.png` |
| **Mission Control** — KPI scoreboard + live fleet graph | `https://raw.githubusercontent.com/aimerdoux/wavex-os/main/docs/images/wizard/13-mission-control.png` |

Below the carousel, italic muted line: "Every screenshot above is real — captured by the e2e test suite. Reproduce locally: `pnpm test:e2e e2e/screenshot-walkthrough.spec.ts`."

### 4. What works today — Phase H shipped

A 3×2 grid of feature cards. Each card: short title, 1-sentence body, a small mono-font detail line. Use these exact cards:

- **Minimal inception kernel** — Two-agent topology (CEO + Chief of Staff) that exhibits coherent self-direction with one actor and one observer. `docs/MINIMAL_INCEPTION.md`
- **5-pillar onboarding wizard** — Full op-omega-vendored pipeline (~12K LOC plugin, 5K LOC UI). T2 inference + decision matrix + Monte Carlo. `vendor/op-omega/`
- **165 vetted agent templates** — Matrix-driven per-slot selection by stage × GTM motion. C-Suite bodies are production-derived. `packages/onboarding-ui/public/agent-templates/`
- **Four-layer self-healing** — OAuth refresh with concurrency lock, worker restart on SIGTERM grace, 401 self-heal + Sonnet fallback per spawn. `packages/healing/`
- **Fleet observability** — Bottleneck scoring, outcome attribution, token-budget throttle, mission-control aggregator. 96% burn drop in production. `packages/observability/`
- **Paperclip handoff bridge** — After local activate, mirror your C-Suite into a running Paperclip instance with real heartbeats. Env-gated, idempotent. `packages/op-omega-server/src/bridge/paperclip-handoff.ts`

### 5. Architecture (ASCII diagram, monospace, accent-bordered code block)

Render verbatim:

```
       ┌──── localhost (your machine) ─────────────────────────────────┐
       │                                                                │
       │  Browser  ──HTTP──▶  Vite UI  ──proxy──▶  mock-core (3101)    │
       │                       (5173)                  │                 │
       │                                                ▼                 │
       │                                         macOS Keychain           │
       │                                  via wavex-claude wrapper         │
       │                          (token never leaves this box)            │
       │                                                                   │
       │                       (optional) ──HTTP──▶  Paperclip (3100)     │
       │                                              │ heartbeats,        │
       │                                              │ claude CLI,        │
       │                                              │ KPI snapshots,     │
       │                                              ▼ fleet-observer     │
       │                                         your live agents          │
       └────────────────────────────────────────────────────────────────┘
                                       ▲
                                       │  Phase F: optional, paid
                                       │  System Optimizer cron pulls
                                       │  KPI digest, posts board-level
                                       │  injection back as a comment
                                       ▼
                            api.wavex-os.com  (planned)
```

Caption underneath in muted text: "Your data, your inference. Spawned agents use your Claude Max plan via the wrapper. Token never crosses the wire."

### 6. What's coming (roadmap)

A vertical timeline. Each entry: phase, title, status pill (planned / in progress / shipped). Show:

- **Phase D** — Paperclip handoff bridge — **shipped** (commit `6b4cb676`)
- **Phase D** — Hosted onboarding inference at api.wavex-os.com — in progress
- **Phase D** — Replace mock-core with real Paperclip core — in progress
- **Phase E** — Claude Max OAuth handoff (Linux + Windows parity) — planned
- **Phase F** — Stripe + System Optimizer cron + self-host Docker — planned
- **Phase G** — Mission Control v2 (workflows queue, approvals tray, KPI sparklines) — in progress

Below the timeline, a small note: "Each phase ships behind a single git tag with one measurable exit criterion. Subtractive over additive."

### 7. Pricing

Plain table, four columns:

| Tier | Price | What you get |
|---|---|---|
| Free | $0 | All code under MIT. Everything except the cloud optimizer. |
| Founder | $29/mo | 1 daily board-level injection, 500K tokens/mo |
| Growth | $99/mo | Hourly during business hours, 2M tokens, on-demand asks |
| Custom | $299/mo | Unlimited, dedicated optimizer |

Below the table: "Code is free under MIT — fork it. Subscriptions only add hosted convenience. Self-host the optimizer too: `docs/SELF_HOSTING.md` (Phase F)."

### 8. Credits (compact, single paragraph)

> Stands on Paperclip (vendored as the agent runtime engine), op-omega (vendored as the full-fidelity onboarding pipeline), agency-agents by @msitarzewski (MIT, 165 templates vendored), Anthropic (Claude Max powers spawned agents), reactflow (org graph + Mission Control), Fastify (mock-core HTTP server). Full attribution: `CREDITS.md` on the repo.

### 9. Footer

Three columns:

- **Repo:** github.com/aimerdoux/wavex-os
- **Docs:** ARCHITECTURE.md · ROADMAP.md · MINIMAL_INCEPTION.md · SELF_HEALING.md
- **Status:** link to `/docs/ROADMAP.md`

Bottom line, muted: "MIT licensed · v0.2.0 Phase H · Built by Omar (@aimerdoux)"

## Tech stack constraints

- Astro or Next.js 14 static export
- Tailwind, no UI library (hand-crafted look, not Vercel-template)
- No animations beyond the typewriter terminal + one subtle gradient on hero + the screenshot carousel transition
- All CTAs are real anchor links to real paths on the repo (no fake buttons)
- Mobile-first responsive: 360px → 1440px clean
- Screenshots load lazily, max 1280px wide
- Use `<picture>` + WebP if the generator supports it; PNG fallback always works

## Anti-requirements (do NOT add)

- No "join our Discord" or "subscribe to newsletter"
- No testimonials, no logos-of-customers strip, no fake AI-generated faces
- No "trusted by X+ developers"
- No floating chat widget
- No cookie banner (no tracking)
- No comparison tables vs other AI products
- No "live demo" embed — link out to the screenshots only

## Notes for the generator

- The 13 wizard screenshots are at `docs/images/wizard/01-welcome.png` through `13-mission-control.png` in the repo. Use the `raw.githubusercontent.com/aimerdoux/wavex-os/main/...` form for inline-able URLs.
- The "Wizard walkthrough" carousel is the single most important section after the hero — most visitors will judge the product by these images. Make sure they're the visual centerpiece, not buried under feature cards.
- Color discipline matters: only the accent `#4ec9b0` should pop. Everything else lives in the grayscale spectrum.
