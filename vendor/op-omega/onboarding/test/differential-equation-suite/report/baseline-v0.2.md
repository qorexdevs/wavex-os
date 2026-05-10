# Operator Ω · Differential-Equation Suite Report

**Generated:** 2026-04-21T05:23:37.373Z
**Records scanned:** 81
**Verdict:** `PARTIAL_SURFACE`

## Suite results

| Suite | Total | Passed | Failed | Pass rate |
|---|---:|---:|---:|---:|
| 1 · Divergence | 0 | 0 | 0 | — |
| 2 · Stability | 0 | 0 | 0 | — |
| 3 · Surface Coverage | 0 | 0 | 0 | — |
| 4 · Inference Value | 21 | 15 | 6 | 71.4% |

## Anomaly breakdown

| Flag | Count |
|---|---:|
| `low_agent_divergence` | 34 |
| `low_allocation_shift` | 26 |
| `low_connector_divergence` | 26 |
| `low_overlay_gap` | 5 |
| `low_workflow_patch_gap` | 1 |
| `low_rationale_gap` | 1 |

## Notes

- Suite 1 has no records — run with OP_OMEGA_TEST_LIVE=1 to populate divergence data.
- 26 connector-divergence anomalies detected — some pillar may not be propagating.
- 1 low-rationale-gap anomalies — T2 rationale specificity may be weak.

## Verdict interpretation

Mixed results. Some dimensions are surface-like, others curve-like. Triage per suite.

---

## Prompt versions

| Phase | Version | Snapshot sha256 | Drift |
|---|---|---|---|
| `phase-2` | 0.1.0 | `1265c9ec1144…` | ✓ none |
| `phase-3` | 0.1.0 | `a32022e059fa…` | ✓ none |
| `phase-4` | 0.1.0 | `92f84a9ef24e…` | ✓ none |
| `finalize-imprint` | 0.1.0 | `42d597189f2b…` | ✓ none |

---

## Longitudinal analysis · corpus = 81 records

### Pillar propagation strength

| Pillar | Records | Low-connector | Low-agent | Low-allocation | Signal |
|---:|---:|---:|---:|---:|---:|
| 1 | 0 | 0 | 0 | 0 | 0% |
| 3 | 0 | 0 | 0 | 0 | 0% |
| 4 | 0 | 0 | 0 | 0 | 0% |
| 5 | 0 | 0 | 0 | 0 | 0% |

### Surface compression

- 81 records · 81 distinct manifest hashes · compression ratio 1
- Top clusters:
  - `sha256:85072fe46c858…` × 1
  - `sha256:53146931a6e72…` × 1
  - `sha256:957c71615386f…` × 1
  - `sha256:f15725a84e0d0…` × 1
  - `sha256:e2b1aaf12f1dd…` × 1

### Fixture stability (fixtures seen ≥ 2 runs)

| Fixture | Runs | Distinct hashes | Stability |
|---|---:|---:|---:|
| `acme-no-product` | 3 | 3 | 0.33 |
| `acme-b2b-saas-outbound__p1_has_product_false` | 2 | 2 | 0.5 |
| `acme-b2b-saas-outbound__p3_stage_less_than_10k` | 2 | 2 | 0.5 |
| `acme-b2b-saas-outbound__p3_stage_more_than_1m` | 2 | 2 | 0.5 |
| `acme-b2b-saas-outbound__p3_product_state_prototype` | 2 | 2 | 0.5 |
| `acme-b2b-saas-outbound__p4_gtm_inbound_plg` | 2 | 2 | 0.5 |
| `acme-b2b-saas-outbound__p4_gtm_content_led` | 2 | 2 | 0.5 |
| `acme-b2b-saas-outbound__p4_gtm_referral` | 2 | 2 | 0.5 |
| `acme-b2b-saas-outbound__p4_gtm_bootstrap` | 2 | 2 | 0.5 |
| `acme-b2b-saas-outbound__p5_comm_telegram` | 2 | 2 | 0.5 |

### Inference efficiency

- Mean T2 calls per record: **1.02**
- T2 on passes: 60 · on failures: 23
- Anomalies per T2 call: 1.12

### Top anomaly flags (max 10)

- `low_agent_divergence` × 34
- `low_allocation_shift` × 26
- `low_connector_divergence` × 26
- `low_overlay_gap` × 5
- `low_workflow_patch_gap` × 1
- `low_rationale_gap` × 1
