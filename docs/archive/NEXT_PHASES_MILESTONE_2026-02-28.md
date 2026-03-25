# Post-AI Roadmap Milestone - February 28, 2026

## Summary
The three post-AI tranches are complete and behavior-preserving gates are green:
1. Content Pipeline Closure
2. Frontend Decomposition
3. Harness Core Unification

## Delivered Scope

### 1) Content Pipeline Closure (Engine)
- Added canonical enemy content runtime modules:
  - `packages/engine/src/data/enemies/enemy-catalog.ts`
  - `packages/engine/src/data/enemies/floor-spawn-profile.ts`
  - `packages/engine/src/data/enemies/content-consistency.ts`
- Refactored runtime and evaluator callsites off `ENEMY_STATS` ownership:
  - `packages/engine/src/systems/map.ts`
  - `packages/engine/src/systems/evaluation/evaluation-baselines.ts`
  - legacy scenario helper path in `packages/engine/src/skillTests.ts`
- Added bootstrap-time consistency assertion:
  - `packages/engine/src/systems/tactical-data-bootstrap.ts`
- Initially kept compatibility exports as temporary facades during rollout.

### Post-Milestone Hardening (March 1, 2026)
- Retired deprecated enemy constants surface:
  - removed `packages/engine/src/legacy/enemy-constants.ts`
  - removed `@hop/engine/legacy/enemy-constants` export path
- Added deprecated-constants static guard:
  - `packages/engine/scripts/checkDeprecatedConstantsUsage.ts`
- Wired guard into:
  - `npm --workspace @hop/engine run check-script-imports`

### 2) Frontend Decomposition (Web)
- Extracted biome sandbox state and preview helpers:
  - `apps/web/src/components/biome-sandbox/state/settings-utils.ts`
  - `apps/web/src/components/biome-sandbox/state/settings-storage.ts`
  - `apps/web/src/components/biome-sandbox/state/preview-state.ts`
  - shared types in `apps/web/src/components/biome-sandbox/types.ts`
- Split UI composition into shell + focused subcomponents:
  - `apps/web/src/components/UI.tsx`
  - `apps/web/src/components/ui/ui-status-panel.tsx`
  - `apps/web/src/components/ui/ui-log-feed.tsx`
- Extracted entity view helpers:
  - `apps/web/src/components/entity/entity-icon.tsx`
  - `apps/web/src/components/entity/entity-animation.ts`

### 3) Harness Core Unification (Engine Evaluation)
- Added shared batch contracts and wrappers:
  - `packages/engine/src/systems/evaluation/harness-batch.ts`
- Refactored both harness surfaces to shared batch primitives:
  - `packages/engine/src/systems/evaluation/balance-harness.ts`
  - `packages/engine/src/systems/evaluation/pvp-harness.ts`
- Public harness exports preserved.

## Regression Coverage Added
- Engine:
  - `packages/engine/src/__tests__/enemy_content_consistency.test.ts`
  - `packages/engine/src/__tests__/map_spawn_profile_pipeline.test.ts`
  - `packages/engine/src/__tests__/evaluation_baseline_enemy_source.test.ts`
  - `packages/engine/src/__tests__/harness_batch_core.test.ts`
- Web:
  - `apps/web/src/__tests__/biome_sandbox_state.test.ts`
  - `apps/web/src/__tests__/biome_sandbox_preview_state.test.ts`
  - `apps/web/src/__tests__/entity_animation_helpers.test.ts`

## Validation Snapshot
- `npm --workspace @hop/engine run build` -> pass
- `npm --workspace @hop/engine run check-script-imports` -> pass
- `npm --workspace @hop/engine run test:ai-acceptance:strict` -> pass
- `npm --workspace @hop/web run test:run` -> pass
- `npm --workspace @hop/web run build` -> pass

## Compatibility Notes
1. `ENEMY_STATS`, `FLOOR_ENEMY_BUDGET`, and `FLOOR_ENEMY_TYPES` are retired and must not be used in runtime source.
2. Deprecated-constant usage is fail-gated via `check-script-imports`.
3. Harness public API remains stable (`simulateRun`, `runBatch`, `runHeadToHeadBatch`, `summarizeBatch`, `summarizeMatchup`, `runPvpBatch`, `summarizePvpBatch`).
4. UI external props remained stable for `UI`, `Entity`, and `BiomeSandbox` callsites.
