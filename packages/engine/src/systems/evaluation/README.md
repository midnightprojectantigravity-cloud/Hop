# Evaluation Systems

This directory contains the shared evaluation and harness stack for runtime AI review.

## Module Boundaries

- `harness-types.ts`
  - shared run, summary, and telemetry contracts
- `harness-simulation.ts`
  - single-run assembly and orchestration
- `harness-matchup.ts`
  - head-to-head comparison logic
- `balance-harness-summary.ts`
  - aggregate batch summarization
- `balance-harness.ts`
  - public evaluation facade
- `pvp-harness.ts` / `pvp-harness-summary.ts`
  - PvP simulation and aggregation
- `harness-core.ts`
  - shared pure helpers

## Current AI/Evaluation Posture

- runtime enemy AI and player/UPA selection share the same generic core
- behavior overlays and Spark doctrine telemetry now flow through evaluation summaries
- harness summaries should stay aligned with the live runtime decision model, not a parallel simulator doctrine

## Common Review Commands

```powershell
npm run upa:quick:ai
npx tsx packages/engine/scripts/runUpaOutlierAnalysis.ts
npx tsx packages/engine/scripts/runUpaCalibration.ts 300 80 heuristic artifacts/upa/UPA_CALIBRATION_BASELINE.json
```

## Extension Rules

- new run-level fields:
  - add to `harness-types.ts`
  - populate in `harness-simulation.ts`
  - aggregate in `balance-harness-summary.ts`
- new matchup win logic:
  - change `harness-matchup.ts`
- new shared helper logic:
  - add to `harness-core.ts`

## Regression Gate

```powershell
npm --workspace @hop/engine run test:ai-acceptance:strict
```
