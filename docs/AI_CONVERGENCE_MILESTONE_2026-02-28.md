# AI Convergence Milestone - February 28, 2026

## Summary
The AI Convergence tranche is complete and behavior-preserving gates are green.

This milestone unified enemy runtime AI, strategy intent output, and harness player-bot decision contracts around shared scoring and deterministic tie-break infrastructure.

## Delivered Scope

1. Shared AI core contracts
- `packages/engine/src/systems/ai/core/types.ts`
- `packages/engine/src/systems/ai/core/scoring.ts`
- `packages/engine/src/systems/ai/core/tiebreak.ts`

2. Enemy AI framework migration
- `packages/engine/src/systems/ai/enemy/candidates.ts`
- `packages/engine/src/systems/ai/enemy/features.ts`
- `packages/engine/src/systems/ai/enemy/policies.ts`
- `packages/engine/src/systems/ai/enemy/selector.ts`
- `packages/engine/src/systems/ai/enemy/decision-adapter.ts`
- Runtime wrapper remains API-compatible in `packages/engine/src/systems/ai/ai.ts`.

3. Wild strategy convergence
- `packages/engine/src/strategy/wild.ts` now consumes shared AI intent output for standard enemies.
- `falcon` and `bomb` stay bespoke by design.

4. Harness convergence and decomposition
- Player selector contracts moved under `packages/engine/src/systems/ai/player/`.
- Evaluation decomposition:
  - `packages/engine/src/systems/evaluation/harness-types.ts`
  - `packages/engine/src/systems/evaluation/harness-simulation.ts`
  - `packages/engine/src/systems/evaluation/harness-matchup.ts`
  - `packages/engine/src/systems/evaluation/balance-harness.ts` (facade/orchestration)
  - `packages/engine/src/systems/evaluation/README.md` (module boundaries)

5. Regression and parity gates
- `packages/engine/src/__tests__/enemy_ai_parity_corpus.test.ts`
- `packages/engine/src/__tests__/wild_strategy_intent_parity.test.ts`
- `packages/engine/src/__tests__/ai_scoring_core.test.ts`
- `packages/engine/src/__tests__/ai_tiebreak_determinism.test.ts`
- `packages/engine/src/__tests__/harness_ai_convergence_regression.test.ts`
- Supplemental parity/diagnostic tests:
  - `packages/engine/src/__tests__/enemy_ai_shadow_fallback_rate.test.ts`
  - `packages/engine/src/__tests__/enemy_ai_synthetic_edge_parity.test.ts`
  - `packages/engine/src/__tests__/player_selector_parity_sample.test.ts`

## Validation Snapshot

Commands validated in this milestone:
- `npm --workspace @hop/engine run build`
- `npm --workspace @hop/engine run check-script-imports`
- `npm --workspace @hop/engine run test:ai-acceptance:strict`
- `npm --workspace @hop/web exec vitest run`

Latest strict AI acceptance result:
- `13` test files passed
- `93` tests passed

## Compatibility Notes

1. Public runtime signatures preserved
- `computeEnemyAction(...)`
- `WildStrategy` contract
- harness public entry points

2. Diagnostics remain available
- Oracle/shadow diff utilities stay internal to selector tests/scripts and are not part of stable runtime API.

