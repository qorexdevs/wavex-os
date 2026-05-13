# @wavex-os/paperclip-plugin-wavex

WaveX customization layer for Paperclip — adds branded panels and data
handlers without forking the Paperclip core. See
[`docs/PAPERCLIP_PLUGIN_WAVEX.md`](../../docs/PAPERCLIP_PLUGIN_WAVEX.md) for
the operator runbook.

## What this plugin contributes

| Slot | ID | What it shows |
|---|---|---|
| Dashboard widget | `wavex-expert-agents-status` | Each catalog Expert Agent + active hire count |
| Sidebar | `wavex-inception-status` | Current company's `<ready>/<total>` agent count + readiness state |
| Settings page | `wavex-preferences` | Subscription + last Stripe webhook + quick links to WaveX Mission Control |

## How it talks to WaveX

- **Inception status** — fetches `GET /api/companies/<id>/agents` against
  `wavexApiBase` (default `http://127.0.0.1:3101`), which is the mock-core
  endpoint added in commit `a1685229`. Returns immediately when wavex-os
  isn't running.
- **Expert Agents + subscription** — calls the public RPCs
  `wavex_os_ops_catalog_hire_counts` and `wavex_os_ops_last_webhook_at`
  (migration `20260513000012`) when `supabaseUrl` + `supabasePublishableKey`
  are configured. Skipped silently otherwise.

## Read-only by design

The plugin never writes to issues, comments, agents, or the Paperclip DB.
Any state change goes through Paperclip's native flows (operator-initiated
issue creation, command composer, etc.) so the plugin can't get out of sync
with the host. To act on what you see, follow the deep links in the
Settings page back to WaveX Mission Control.

## Build

```sh
pnpm --filter @wavex-os/paperclip-plugin-wavex build
```

Outputs to `dist/manifest.js`, `dist/worker.js`, `dist/ui/`. The plugin
manifest at `package.json#paperclipPlugin` points Paperclip's loader at
those compiled artifacts.

## Discovery in Paperclip

Paperclip discovers plugins by reading `package.json#paperclipPlugin` for
every package in its workspace. Because this plugin lives at
`packages/paperclip-plugin-wavex/` inside the same monorepo as vendored
Paperclip (`packages/core/`), no extra installation step is needed — the
host picks it up at startup once built.
