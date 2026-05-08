# Launchd templates (macOS)

Placeholder-templated `.plist` files for the recurring jobs that drive the [self-healing](../../docs/SELF_HEALING.md) and observability layers. The render script substitutes per-deployment values from `wavex-os.config.json` and writes the resolved plists to `~/Library/LaunchAgents/`, where launchd picks them up.

| Template | Cadence | Purpose |
|---|---|---|
| `com.wavex-os.recovery-on-boot.plist.tmpl` | RunAtLoad | Layer 4: post-boot recovery protocol firing once after server health is up |
| `com.wavex-os.recovery-12h.plist.tmpl` | every 12h | Layer 4: periodic recovery protocol safety net |
| `com.wavex-os.fleet-assessment.plist.tmpl` | every 30 min | Snapshots the markdown fleet assessment to disk for the Chief of Staff |
| `com.wavex-os.economics-refresh.plist.tmpl` | every 15 min | Refreshes per-agent CURRENT_ECONOMICS.md files (powers SKILL_ECONOMIC_SELF_AWARENESS) |
| `com.wavex-os.attribution-sweep.plist.tmpl` | hourly | Backfills task_outcome_attributions for any closed issue lacking one |
| `com.wavex-os.bottleneck-digest.plist.tmpl` | daily 09:00 | Posts the top-bottleneck digest to your notification channel |

## Placeholders

- `${COMPANY_ID}` — your company UUID from the orchestrator
- `${API_BASE}` — the orchestrator base URL (typically `http://127.0.0.1:3100`)
- `${STATE_DIR}` — log destination (typically `~/.wavex-os/state`)

## Render + install

```sh
node scripts/render-launchd-templates.mjs --config ./wavex-os.config.json
launchctl load -w ~/Library/LaunchAgents/com.wavex-os.*.plist
```

## Linux equivalents (systemd)

These are macOS-only templates. For Linux, the recommended approach is a single systemd timer per job, using identical `curl` ProgramArguments. Translation isn't shipped here — open an issue if you need it bundled.
