# @wavex-os/cloud-client

Clients for the WaveX OS Console plus the `wavex-os` command line. It owns the
device-pairing HTTP flow against the Supabase edge functions
(`os-link-device`, `os-claim-device`, `os-device-token`, `os-device-refresh`),
the spend-intent stub, and the Supabase Realtime channel that routes inference
calls to the operator Mac. The device token bundle lives at
`~/.wavex-os/device-token.json` (chmod 600).

## The `wavex-os` command

`install.sh` / `install.ps1` put `wavex-os` on your PATH. From a manual clone
you can run it without linking:

```bash
pnpm wavex:os login          # = node packages/cloud-client/bin/wavex-os.mjs login
```

| Command | What it does |
|---|---|
| `wavex-os login` | Pair this machine: POST `os-link-device`, open the browser, poll until you claim the code, then write the device JWT + refresh token. |
| `wavex-os status [--refresh] [--json]` | Show local pairing state. `--refresh` rotates the access token; `--json` emits one machine-readable line. |
| `wavex-os logout` | Delete the local device token bundle (cloud-side revoke is separate). |
| `wavex-os whoami [--json]` | One-line "who is this machine paired as". `--json` emits a machine-readable line. |
| `wavex-os version [--json]` | Print the version. `--json` adds `node` + `platform` for bug reports. |
| `wavex-os init / doctor / audit / reset` | Forwarded to the `wavex-os-installer` bin. |

`login`, `status`, `logout`, `whoami`, and `version` are implemented here; the installer
subcommands are delegated, so a single `wavex-os` binary covers the whole
surface. The bin entrypoint (`bin/wavex-os.mjs`) imports the built
`dist/cli.js` and calls `runCli()`, no `tsx` loader.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Success (paired, status queried, version printed). |
| 1 | `status` / `whoami`: not paired yet. |
| 2 | `login`: pairing code expired, run it again. |
| 3 | `login`: pairing failed; `status --refresh`: refresh failed. |

`status --json` prints `{"paired":false}` and exits 1 when there is no bundle,
otherwise `{"paired":true,"valid":...,"user_id":...,"device_id":...,
"access_token_expires_in_sec":...}`. `whoami --json` carries the same
`access_token_expires_in_sec`, so a script can gate on time-left from the
cheaper identity call without a full `status`.

## Environment

Sensible defaults are baked in; override only when pointing at a non-prod
console. `login` reads `~/.wavex-os/state/.env` first so these can live there.

| Var | Default | Purpose |
|---|---|---|
| `WAVEX_CLOUD_FUNCTIONS_URL` | prod edge functions | Base URL for the pairing edge functions |
| `WAVEX_CONSOLE_URL` | prod console | Browser URL the login flow opens |
| `WAVEX_DEVICE_TOKEN_PATH` | `~/.wavex-os/device-token.json` | Where the token bundle is read/written |
| `WAVEX_DEVICE_JWT_SECRET` | unset | When set, `login` verifies the token locally; customer machines leave it unset |
| `WAVEX_CLOUD_HTTP_TIMEOUT_MS` | `30000` | HTTP request timeout |

## Programmatic use

The package also exports the pieces the CLI is built on:

```ts
import { runLogin, introspectBundle, getValidAccessToken, deleteBundle } from "@wavex-os/cloud-client";
```

Subpath exports: `./token-store`, `./inference`, `./spend-intent`, `./login`,
`./config`, `./cli`.

## Offline smoke

No network needed. A filtered install builds the package and runs the suite:

```bash
pnpm install --filter "@wavex-os/cloud-client..."
npx -y tsx packages/cloud-client/scripts/smoke-offline.mjs
```

It covers the CLI dispatcher (`version` / `status` / `--help` / unknown
command), both `--json` paths, and the paired/unpaired bundle states. The
mint + verify section runs only when `WAVEX_DEVICE_JWT_SECRET` is set.
