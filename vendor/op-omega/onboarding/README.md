# @op-omega/plugin-onboarding

Operator Ω · onboarding pipeline (phases 2–4 + finalize) plus the surface tuning map.

## Surface tuning

The onboarding pipeline produces a **solution surface** — per-operator variation across 8 axes:

1. Active agent set
2. Overlay tokens
3. Workflow tasks
4. Bundle allocation (L1)
5. Connector set
6. Dry-run gates
7. MC winner
8. MC projection (L2)

The surface is shaped by ~40 scattered constants and heuristic branches. Every one is catalogued in `src/tuning/registry.ts` and rendered to `docs/ops/surface-tuning-map.md` (regenerate with `pnpm omega:tune:map`).

### How to use the map

Two things you can't get from reading the code alone:

- **2D push direction** — each tunable is labelled with `diversityPull` and `accuracyPull`, both `-2..+2`. High diversity / low accuracy = widen the surface; high accuracy / low diversity = tighten manifests; both high = a rare free lunch; both low = dead weight.
- **Coupling class** — tells you what else must change when you turn the knob:
  - `runtime` — edit the constant, redeploy. No prompt or snapshot changes.
  - `prompt` — value is mirrored in a T2 prompt body. Bump `CURRENT_PROMPT_VERSIONS` (in `test/differential-equation-suite/qa/prompt-version-registry.ts`) and refresh the snapshot under `test/differential-equation-suite/prompts/<phase>/v<ver>.md`. The drift detector in `prompt-version-registry.ts:174` will flag mismatches at test time.
  - `structural` — adding/removing an enum, strategy, or agent. Requires coordinated code + prompt + test changes.

### Common moves

- **Widen industry diversity** — raise magnitudes in `phase3.industry_delta` (±0.05 → ±0.08). Validate with `pnpm test:validation-matrix` and look for increased allocation divergence across fintech/ecom/devtools fixtures.
- **Tighten Phase 4 task specificity** — raise thresholds in `phase4.specificity_gate` (distinct ≥5 → ≥6). Expect more `shallow_customization` warnings until prompts are nudged.
- **Let more overlay text through** — raise `phase3.skill_overlay_slice` (400 → 500). UI sidebar card may overflow past 3 lines.
- **Shorten operator wait** — lower `phase4.t2_timeout_ms` and `phase4.reprompt_cap`. Trades off accuracy (more fallbacks to deterministic baseline).
- **Experiment with MC horizon** — raise `finalize.mc_horizon_cycles` (30 → 48) to surface long-tail ruin. Latency scales ~linearly.
- **Add a connector** — add to `phase2.registry_ids` set, mirror in `phase-2-connector/prompt.ts`, bump the prompt version, refresh the snapshot, ensure the adapter exists in `@paperclipai/connector-registry`.

### Annotation convention

Every registry entry has a matching `// @tunable <id>` comment at the call site. Grep works in both directions:

```sh
# id → source
grep -rn "@tunable phase3.industry_delta" packages/plugins/onboarding/src

# source → registry entry
grep -n "phase3.industry_delta" packages/plugins/onboarding/src/tuning/registry.ts
```

The round-trip is guarded by `src/tuning/registry.test.ts` — CI fails if you add a constant without a registry entry (or vice versa).

### Verifying a tuning change

1. Edit the constant at `location`.
2. If `coupling === "prompt"`: bump the version and refresh the snapshot. Run `pnpm test:differential-equation` to confirm drift detection passes.
3. Run `pnpm test:validation-matrix` to compare the new surface against baseline fixtures. Look for per-axis divergence that matches your intent.
4. Regenerate the doc: `pnpm omega:tune:map`.
