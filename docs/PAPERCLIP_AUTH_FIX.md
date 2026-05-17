# Paperclip Agent Auth — `CLAUDE_CONFIG_DIR` poisoning

**Incident:** 2026-05-14, live demo. Every incepted Paperclip agent failed with
`Not logged in · Please run /login`. Diagnosis took far too long; this doc
exists so it never recurs.

## Root cause

`claude` v2.1.x: when `CLAUDE_CONFIG_DIR` is **explicitly set**, claude reads
credentials from `<dir>/.credentials.json` and **does not** fall back to the
macOS login keychain. On a keychain-auth box that file does not exist, so
claude reports "Not logged in".

Paperclip's `claude_local` adapter received `CLAUDE_CONFIG_DIR` on every agent
spawn (it was written into `adapterConfig.env` by `paperclip-handoff.ts`), so
every incepted agent failed auth — even though `claude` worked fine in a normal
shell.

Isolation proof:

```
env -i HOME USER LOGNAME PATH claude --print hi                    # OK
env -i HOME USER LOGNAME PATH CLAUDE_CONFIG_DIR=... claude --print hi  # "Not logged in"
```

Two secondary poisons found in the same pass:
- a **set-but-empty** `ANTHROPIC_API_KEY` also pushes claude off the keychain path
- missing `USER` / `LOGNAME` (common under launchd) stops claude locating the
  login keychain

## The permanent fix

### 1. Repo-versioned auth wrapper

`scripts/ops/claude-keychain-wrapper.sh` — unsets `CLAUDE_CONFIG_DIR`, drops an
empty `ANTHROPIC_API_KEY`, guarantees `USER`/`LOGNAME`/`HOME`, then `exec`s
`claude` (or `$WAVEX_CLAUDE_BIN`).

### 2. Handoff wires the wrapper by default

`packages/wavex-os-server/src/bridge/paperclip-handoff.ts` → `hireOne()`:
- `adapterConfig.command` defaults to the repo wrapper path (was bare `claude`)
- `adapterConfig.env` **no longer sets `CLAUDE_CONFIG_DIR`**; it sets only
  `HOME` + `USER` + `LOGNAME`
- `PAPERCLIP_HANDOFF_WRAPPER` still overrides for per-box wrappers

Every fleet incepted from this commit forward authenticates correctly with no
hand-patching.

### 3. Existing fleets

Agents hired before this commit have the poisoned `adapterConfig`. Re-point each
agent's `adapterConfig.command` at the wrapper and remove `CLAUDE_CONFIG_DIR`
from `adapterConfig.env` via `PATCH /api/agents/:id`, or re-incept.

## Keeping Paperclip supervised (launchd)

So the customer never has to open a terminal, run Paperclip under a LaunchAgent.
Launcher: `scripts/ops/paperclip-launchd.sh`. Install the plist manually
(`templates/launchd/` is a frozen path — this plist is operator-local, not a
wavex-os runtime loop):

```xml
<!-- ~/Library/LaunchAgents/com.wavex-os.paperclip.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.wavex-os.paperclip</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>REPO_DIR/scripts/ops/paperclip-launchd.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key><string>/Users/USERNAME</string>
    <key>USER</key><string>USERNAME</string>
    <key>LOGNAME</key><string>USERNAME</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/Users/USERNAME/.local/bin:/usr/bin:/bin</string>
  </dict>
  <key>KeepAlive</key><true/>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/Users/USERNAME/.wavex-os/state/paperclip.log</string>
  <key>StandardErrorPath</key><string>/Users/USERNAME/.wavex-os/state/paperclip.log</string>
</dict>
</plist>
```

Install: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.wavex-os.paperclip.plist`

## Redundancy playbook #1

This incident is the seed of the watchdog's remediation library
(see `docs/REDUNDANCY_ARCHITECTURE.md`):

> **Signature:** agent runs failing within ~1s with `Not logged in` /
> `Please run /login`.
> **Remediation:** ensure `adapterConfig.command` points at the keychain
> wrapper; strip `CLAUDE_CONFIG_DIR` from `adapterConfig.env`; if claude itself
> is logged out, escalate to operator (only a human can re-auth).
