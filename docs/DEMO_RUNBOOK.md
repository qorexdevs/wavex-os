# Live Demo Runbook

End-to-end onboarding walkthrough with real T2 inference + Paperclip handoff. No `?t0=1` fast-mode, no `skipInference` shortcuts — every step does real work.

## Before the demo

1. **Run the pre-flight** — `bash scripts/demo-preflight.sh`. Exits non-zero if anything's wrong. Fix until green.
2. **Wipe stale state** — if the wavex/paperclip company lists aren't empty, the demo will look cluttered. Wipe them with the cleanup steps below.
3. **Open browser tabs** in this order:
   - **Tab A** — http://localhost:5173 (wavex wizard)
   - **Tab B** — http://localhost:5174 (paperclip, ready to refresh)

## The walkthrough (~10-15 minutes total)

| Phase | Time | What happens | What to call out |
|---|---|---|---|
| Welcome | 5s | Type a company name, click Start | Name becomes the company id |
| **Pillar 1** | **2-4 min** | Paste URL (e.g. `https://www.anthropic.com`), click Next → T2 deep-dives the URL, infers industry / business model / ICP | Watch the progress bar + token counter tick up. The ETA is history-backed (median of past T2 calls) |
| Pillar 1 confirm | 10s | Edit any fields, click Confirm | Editor's last chance to override T2's inference |
| Pillar 2 | 15s | Claude probe verifies the local CLI auth works | Single click |
| Pillar 3 | 10s | Pick product state + stage | Defaults are fine |
| Pillar 4 | 10s | Pick lead sources + sales motion | Defaults are fine |
| Pillar 5 | 10s | Pick comm channel | Defaults are fine |
| **Phase 2 Connectors** | **1-2 min** | T2 picks required/suggested/deferred connectors based on pillars | "Source: t2" badge confirms real inference (not deterministic fallback) |
| Credentials | 30s | Skip every required connector with a reason | "Skip all (N)" button does this in one click |
| **Phase 3 Swarm** | **1-2 min** | T2 picks per-slot template variations | Org chart renders the 35-agent fleet including CEO + Chief of Staff at the top |
| **Phase 4 Workflows** | **2-3 min** | T2 generates workflow patches per agent (slowest phase) | This is the longest single T2 step |
| **Finalize** | **2-4 min** | Monte Carlo (30 cycles × 30 runs × 5 strategies) + T2 imprint generation + sign | Imprint summary should NOT say "fallback" — that means T2 succeeded |
| Activate | 10s | Click "Activate fleet →" | Sticky footer flips to "✓ Mirrored 7 agents to Paperclip ↗"; a new tab opens to Paperclip's UI |
| Paperclip | — | New tab shows the company with C-Suite agents wired up | Switch to Tab B to show the receiving side |

## What can fail + how to recover

**T2 hallucinates bad structured output (e.g. Pillar 1 returns an invalid industry)**
- UI shows a halt screen with the operator-readable error
- Click "Try again" — usually succeeds on second attempt
- If it keeps failing: click "Skip T2 inference" on the relevant phase (loses fidelity but completes the demo)

**Phase 2/3/4 stays "Continuing…" past 4 minutes**
- T2 call probably stuck. Open dev tools → Network tab → check the POST to `/wavex-os/onboarding/<phase>-manifest`
- If 502/504 → claude rate-limited. Wait 30s, refresh, the wizard hydrates from disk (no replay)
- If the response shows `source: "fallback"` — deterministic mode kicked in; demo still works, just point out that real T2 would refine further

**Paperclip handoff shows "⚠ Paperclip not detected"**
- Paperclip API on :3100 isn't responding. Run `bash scripts/demo-preflight.sh` to confirm
- Restart Paperclip: `cd packages/core && pnpm dev:server`
- Re-click Activate — auto-detection retries per-activate so no wavex restart needed

**Activate fails with "manifest not found"**
- The finalize step didn't actually persist the manifest. Click "Finalize + sign →" again — idempotent

**Mid-flow refresh loses position**
- Shouldn't happen — URL has `?phase=` which restores. If it does, navigate manually via the top nav tabs

## Talking points during the slow waits

- **During Pillar 1's 2-3 min T2 wait**: "This is fetching their URL, reading the content, and inferring industry + business model + ideal customer profile + competitive position + tone. Roughly $0.05-0.10 in tokens for a real run."
- **During Phase 2/3/4**: "Each phase is a separate T2 call refining the manifest based on previous answers. Phase 4 makes 2 calls per agent so it's the slowest."
- **During Finalize**: "Monte Carlo simulates 30 strategies × 30 runs × 30 cycles to pick the best go-to-market path. The imprint summarizes the whole onboarding in plain prose."
- **At Activate**: "Now the manifest hits the bridge, 35 agents land in the wavex DB, and the C-Suite mirrors to Paperclip — so the same 7 senior agents are now running on Paperclip's runtime with the same skill bundles."

## Cleanup between demos

```bash
# stop all four servers
pkill -f "tsx watch" ; pkill -f "vite" ; pkill -f "core/server"

# wipe everything
rm -rf ~/.wavex-os/instances/default/companies
rm -rf ~/.wavex-os/db/pglite
rm -f ~/.wavex-os/state/t2-events.jsonl
rm -rf ~/.paperclip

# restart
cd /Users/dylanriedweg/wavex-os && pnpm dev &
cd /Users/dylanriedweg/wavex-os/packages/core && pnpm dev:server &
cd /Users/dylanriedweg/wavex-os/packages/core/ui && pnpm exec vite --port 5174 &

# verify
bash scripts/demo-preflight.sh
```

## Reference URLs

| Service | URL | What it serves |
|---|---|---|
| Wavex onboarding | http://localhost:5173 | Wizard + Mission Control |
| Wavex API | http://127.0.0.1:3101 | Internal — not for demoing |
| Paperclip dashboard | http://localhost:5174 | Where mirrored fleet appears |
| Paperclip API | http://127.0.0.1:3100 | Internal — wavex calls this for handoff |
