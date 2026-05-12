# WaveX OS — Open Source Privacy Notice

**Version:** 1.0
**Effective date:** 2026-05-12

WaveX OS is open-source software released under the MIT License. When you run WaveX OS on your own machine WITHOUT hiring any WaveX Expert Agents (the free tier), the following is true:

1. **No data is sent to WaveX.** WaveX OS does not transmit your fleet state, KPI snapshots, issue bodies, agent logs, or any other operational data to WaveX servers. There is no telemetry, install pingback, or analytics call.

2. **Inference calls are between you and Anthropic.** The agents WaveX OS spawns make Claude inference calls using YOUR Claude Max OAuth (or your own Anthropic API key, depending on configuration). These calls are governed by your existing agreement with Anthropic. WaveX is not a party to them and does not see their contents.

3. **The only data WaveX can see about you is publicly available.** GitHub clone counts and npm download statistics are the extent of our visibility into open-source usage.

4. **Your data stays on the machine you run WaveX OS on.** This includes the customer Mac running the wizard, the local Paperclip instance, the local Supabase or PGlite database, and the macOS Keychain holding your OAuth credentials.

The moment you hire a WaveX Expert Agent (Optimizer, Alignment, Error Handler, or Concierge) — which requires an active paid subscription — Tier 2 of our data architecture activates and the [`EXPERT_AGENT_PROCESSING_AGREEMENT.md`](./EXPERT_AGENT_PROCESSING_AGREEMENT.md) takes effect for that specific agent. You will be shown the agreement and must consent before any data flows. You can revoke any Expert Agent at any time.

If you never hire an Expert Agent, this notice is the entirety of WaveX's data relationship with you.

Questions: open an issue at <https://github.com/aimerdoux/wavex-os/issues>.
