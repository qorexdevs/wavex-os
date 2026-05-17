# Operator Ω · Differential-Equation Suite Report

**Generated:** 2026-04-21T17:12:01.776Z
**Records scanned:** 201
**Verdict:** `CURVE_DETECTED`

## Suite results

| Suite | Total | Passed | Failed | Pass rate |
|---|---:|---:|---:|---:|
| 1 · Divergence | 120 | 48 | 72 | 40% |
| 2 · Stability | 0 | 0 | 0 | — |
| 3 · Surface Coverage | 0 | 0 | 0 | — |
| 4 · Inference Value | 21 | 15 | 6 | 71.4% |

## Anomaly breakdown

| Flag | Count |
|---|---:|
| `low_agent_divergence` | 68 |
| `low_connector_divergence` | 67 |
| `low_allocation_shift` | 55 |
| `low_overlay_gap` | 5 |
| `low_workflow_patch_gap` | 1 |
| `low_rationale_gap` | 1 |

## Notes

- 67 connector-divergence anomalies detected — some pillar may not be propagating.
- 1 low-rationale-gap anomalies — T2 rationale specificity may be weak.

## Verdict interpretation

Onboarding collapses to a curve. Fix before production — see anomaly breakdown for the failing dimension.

---

## Prompt versions

| Phase | Version | Snapshot sha256 | Drift |
|---|---|---|---|
| `phase-2` | 0.2.0 | `84bdf9f710a8…` | ✓ none |
| `phase-3` | 0.4.0 | `471c8b59971c…` | ✓ none |
| `phase-4` | 0.2.0 | `7857877f4e53…` | ✓ none |
| `finalize-imprint` | 0.1.0 | `42d597189f2b…` | ✓ none |

---

## Longitudinal analysis · corpus = 201 records

### Pillar propagation strength

| Pillar | Records | Low-connector | Low-agent | Low-allocation | Signal |
|---:|---:|---:|---:|---:|---:|
| 1 | 12 | 6 | 6 | 12 | 0% |
| 3 | 36 | 17 | 14 | 6 | 28% |
| 4 | 48 | 14 | 14 | 11 | 38% |
| 5 | 24 | 4 | 0 | 0 | 83% |

### Surface compression

- 201 records · 201 distinct manifest hashes · compression ratio 1
- Top clusters:
  - `sha256:85072fe46c858…` × 1
  - `sha256:53146931a6e72…` × 1
  - `sha256:957c71615386f…` × 1
  - `sha256:f15725a84e0d0…` × 1
  - `sha256:e2b1aaf12f1dd…` × 1

### Fixture stability (fixtures seen ≥ 2 runs)

| Fixture | Runs | Distinct hashes | Stability |
|---|---:|---:|---:|
| `acme-b2b-saas-outbound__p1_has_product_false` | 6 | 6 | 0.17 |
| `acme-b2b-saas-outbound__p3_stage_less_than_10k` | 6 | 6 | 0.17 |
| `acme-b2b-saas-outbound__p3_stage_more_than_1m` | 6 | 6 | 0.17 |
| `acme-b2b-saas-outbound__p3_product_state_prototype` | 6 | 6 | 0.17 |
| `acme-b2b-saas-outbound__p4_gtm_inbound_plg` | 6 | 6 | 0.17 |
| `acme-b2b-saas-outbound__p4_gtm_content_led` | 6 | 6 | 0.17 |
| `acme-b2b-saas-outbound__p4_gtm_referral` | 6 | 6 | 0.17 |
| `acme-b2b-saas-outbound__p4_gtm_bootstrap` | 6 | 6 | 0.17 |
| `acme-b2b-saas-outbound__p5_comm_telegram` | 6 | 6 | 0.17 |
| `acme-b2b-saas-outbound__p5_comm_email_only` | 6 | 6 | 0.17 |

### Inference efficiency

- Mean T2 calls per record: **2.79**
- T2 on passes: 251 · on failures: 309
- Anomalies per T2 call: 0.35

### Top anomaly flags (max 10)

- `low_agent_divergence` × 68
- `low_connector_divergence` × 67
- `low_allocation_shift` × 55
- `low_overlay_gap` × 5
- `low_workflow_patch_gap` × 1
- `low_rationale_gap` × 1
