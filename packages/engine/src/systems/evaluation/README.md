# Evaluation Systems

This directory is split by responsibility. Keep modules narrow and avoid reintroducing monoliths.

## Module Boundaries

- `harness-types.ts`
  - Shared contracts for harness runs and summaries.
  - Canonical place for `RunResult`, `BatchSummary`, `Matchup*`, and telemetry summary types.

- `harness-simulation.ts`
  - Single-run simulation assembly (`simulateHarnessRun`, `simulateHarnessRunDetailed`).
  - Consumes player AI runner + telemetry and assembles final run artifacts.

- `harness-matchup.ts`
  - Head-to-head comparison semantics (`compareRuns`) and matchup summarization (`summarizeMatchup`).

- `balance-harness-summary.ts`
  - Batch aggregation (`summarizeBatch`) only.
  - Computes aggregate metrics and dynamic skill grades.

- `balance-harness.ts`
  - Public facade/orchestration layer.
  - Re-exports stable types and functions used by tests/scripts.

- `pvp-harness.ts` / `pvp-harness-summary.ts`
  - PvP simulation and aggregation paths.

- `harness-core.ts`
  - Shared pure helpers (seeded batching, histograms, averages).

## Dependency Direction

- Facades depend on internals, not vice versa:
  - `balance-harness.ts` -> `harness-simulation.ts`, `harness-matchup.ts`, `balance-harness-summary.ts`
- Summary modules should import contracts from `harness-types.ts`, not from facade files.
- Avoid importing from `balance-harness.ts` inside other evaluation internals.

## Extension Rules

- New run-level fields:
  - Add to `harness-types.ts`.
  - Populate in `harness-simulation.ts`.
  - Aggregate in `balance-harness-summary.ts`.

- New matchup win logic:
  - Change only `harness-matchup.ts`.

- New seeded helper utilities:
  - Add to `harness-core.ts`.

## Regression Gate

Before merging evaluation changes, run:

```bash
npm --workspace @hop/engine run test:ai-acceptance:strict
```
