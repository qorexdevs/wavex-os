# Operator Ω · Differential-Equation Suite Report

**Generated:** 2026-04-21T14:35:34.248Z
**Records scanned:** 141
**Verdict:** `CURVE_DETECTED`

## Suite results

| Suite | Total | Passed | Failed | Pass rate |
|---|---:|---:|---:|---:|
| 1 · Divergence | 60 | 26 | 34 | 43.3% |
| 2 · Stability | 0 | 0 | 0 | — |
| 3 · Surface Coverage | 0 | 0 | 0 | — |
| 4 · Inference Value | 21 | 15 | 6 | 71.4% |

## Anomaly breakdown

| Flag | Count |
|---|---:|
| `low_agent_divergence` | 49 |
| `low_connector_divergence` | 43 |
| `low_allocation_shift` | 41 |
| `low_overlay_gap` | 5 |
| `low_workflow_patch_gap` | 1 |
| `low_rationale_gap` | 1 |

## Notes

- 43 connector-divergence anomalies detected — some pillar may not be propagating.
- 1 low-rationale-gap anomalies — T2 rationale specificity may be weak.

## Verdict interpretation

Onboarding collapses to a curve. Fix before production — see anomaly breakdown for the failing dimension.

---

## Prompt versions

| Phase | Version | Snapshot sha256 | Drift |
|---|---|---|---|
| `phase-2` | 0.1.0 | `1265c9ec1144…` | ✓ none |
| `phase-3` | 0.2.0 | `bc1253fc763a…` | ✓ none |
| `phase-4` | 0.1.0 | `92f84a9ef24e…` | ✓ none |
| `finalize-imprint` | 0.1.0 | `42d597189f2b…` | ✓ none |

---

## Longitudinal analysis · corpus = 141 records

### Pillar propagation strength

| Pillar | Records | Low-connector | Low-agent | Low-allocation | Signal |
|---:|---:|---:|---:|---:|---:|
| 1 | 6 | 4 | 4 | 6 | 0% |
| 3 | 18 | 7 | 4 | 2 | 39% |
| 4 | 24 | 4 | 7 | 7 | 38% |
| 5 | 12 | 2 | 0 | 0 | 83% |

### Surface compression

- 141 records · 141 distinct manifest hashes · compression ratio 1
- Top clusters:
  - `sha256:85072fe46c858…` × 1
  - `sha256:53146931a6e72…` × 1
  - `sha256:957c71615386f…` × 1
  - `sha256:f15725a84e0d0…` × 1
  - `sha256:e2b1aaf12f1dd…` × 1

### Fixture stability (fixtures seen ≥ 2 runs)

| Fixture | Runs | Distinct hashes | Stability |
|---|---:|---:|---:|
| `acme-b2b-saas-outbound__p1_has_product_false` | 4 | 4 | 0.25 |
| `acme-b2b-saas-outbound__p3_stage_less_than_10k` | 4 | 4 | 0.25 |
| `acme-b2b-saas-outbound__p3_stage_more_than_1m` | 4 | 4 | 0.25 |
| `acme-b2b-saas-outbound__p3_product_state_prototype` | 4 | 4 | 0.25 |
| `acme-b2b-saas-outbound__p4_gtm_inbound_plg` | 4 | 4 | 0.25 |
| `acme-b2b-saas-outbound__p4_gtm_content_led` | 4 | 4 | 0.25 |
| `acme-b2b-saas-outbound__p4_gtm_referral` | 4 | 4 | 0.25 |
| `acme-b2b-saas-outbound__p4_gtm_bootstrap` | 4 | 4 | 0.25 |
| `acme-b2b-saas-outbound__p5_comm_telegram` | 4 | 4 | 0.25 |
| `acme-b2b-saas-outbound__p5_comm_email_only` | 4 | 4 | 0.25 |

### Inference efficiency

- Mean T2 calls per record: **2.28**
- T2 on passes: 164 · on failures: 158
- Anomalies per T2 call: 0.43

### Top anomaly flags (max 10)

- `low_agent_divergence` × 49
- `low_connector_divergence` × 43
- `low_allocation_shift` × 41
- `low_overlay_gap` × 5
- `low_workflow_patch_gap` × 1
- `low_rationale_gap` × 1
