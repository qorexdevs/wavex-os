# Claude Max OAuth handoff

> Status: **Phase E (in progress)** — wrapper + probe shipped, per-agent symlink wiring lands later in Phase E. See [ROADMAP.md](./ROADMAP.md).

The hardest design problem in WaveX OS is: **how does the spawned fleet inherit the user's Claude Max subscription without the token ever touching our servers?**

This document explains how it works.

---

## TL;DR

1. The user's Claude Max OAuth credential lives in their **system keychain** (macOS) — written by the official Claude desktop app under the service `Claude Code-credentials`.
2. WaveX OS ships a **bash wrapper** (`scripts/wrappers/claude-anthropic-direct.sh`) that reads the credential at invocation time and exports it as `ANTHROPIC_API_KEY` for the wrapped `claude` CLI process.
3. **The credential never leaves the user's machine.** Mock-core (and, later, real Paperclip core) only ever sees the *probe result* — `{ok, source, plan}` — never the token itself.
4. Every spawned agent runs `claude` indirectly via the wrapper, so each heartbeat re-reads the keychain. If the user signs out, agents start failing immediately — by design.

---

## The wrapper: `wavex-claude`

```bash
$ ./scripts/wrappers/claude-anthropic-direct.sh --help
wavex-claude — Claude Max OAuth wrapper

Subcommands:
  probe                  Check that credentials are available; print JSON status.
  exec <args...>         Run claude CLI with credentials injected.
  --help, -h             Show this message.
```

### `probe`

Returns JSON; exit code reflects success.

```bash
$ ./scripts/wrappers/claude-anthropic-direct.sh probe
{
  "ok": true,
  "source": "keychain-macos",
  "plan": "claude_max_detected",
  "note": "Token resolved from keychain-macos. Not transmitted to any remote service."
}
```

| Exit | Meaning |
|------|---------|
| 0    | Credential found and resolved |
| 2    | No credential found anywhere |
| 1    | Wrapper invocation failed (claude binary missing, etc.) |

### `exec`

Wraps the `claude` CLI with credentials injected into its environment:

```bash
$ ./scripts/wrappers/claude-anthropic-direct.sh exec --version
0.x.x

$ WAVEX_CLAUDE_VERBOSE=1 ./scripts/wrappers/claude-anthropic-direct.sh exec /agent run my-agent
[wavex-claude] using credential from keychain-macos
... (output of claude CLI)
```

---

## Resolution precedence

The wrapper resolves a credential in this order; the **first** that succeeds wins:

1. `$ANTHROPIC_API_KEY` — direct environment override. Useful for CI / testing / users who prefer bring-your-own API key.
2. `$WAVEX_CLAUDE_STUB=1` — synthetic stub credential. Never used for real inference; lets us smoke-test plumbing without a real keychain entry.
3. **macOS Keychain** — `security find-generic-password -s 'Claude Code-credentials' -w`.
4. **Linux** (Phase F) — `secret-tool lookup application 'Claude Code'`.
5. **Windows** (Phase F) — `cmdkey`-equivalent.

If all five fail, the wrapper returns `ok: false` and exits 2.

---

## Privacy properties

- **No telemetry from the wrapper.** It does not phone home, log to disk, or write the credential to any file.
- **Credential never crosses the network from this machine** unless the user explicitly invokes a network-bound `claude exec` command.
- **Mock-core sees only the probe result** — `{ok, source, plan}`. It cannot see the token.
- **The hosted backend never sees the token.** Even when Phase F's System Optimizer runs, it only sees KPI metadata, not credentials.

---

## How the wizard uses it

Step 10 (handoff) of the onboarding wizard does the following:

1. On mount, calls `GET /api/paperclip/probe/claude-max`.
2. Vite proxies that to mock-core's `/api/probe/claude-max`.
3. Mock-core invokes `scripts/wrappers/claude-anthropic-direct.sh probe` via `child_process.execFile`.
4. Wrapper reads keychain, returns JSON.
5. Mock-core returns the JSON (passthrough).
6. UI renders OK / missing / error state with appropriate guidance.

The wizard never sees the token. Mock-core never sees the token. Only the wrapper process sees the token, and only for the duration of one `exec` invocation.

---

## Phase F additions (planned)

- **Per-agent symlink wiring during spawn.** Each spawned agent gets its own symlink to the wrapper at `~/.wavex-os/instances/<company>/agents/<agentId>/claude` so per-agent rate-limit policies can be enforced.
- **Smoke heartbeat per agent.** After spawn, run one `wrapper exec --version` per agent to confirm the wiring works. Surface results in step 10.
- **Linux / Windows credential lookup.** `secret-tool` on Linux, `cmdkey`-based path on Windows.
- **Token rotation handling.** If the wrapper detects an expired token (Claude returns 401), it can attempt a refresh via the official Claude desktop app's refresh flow (if running), and fall back to "please sign in" guidance otherwise.
