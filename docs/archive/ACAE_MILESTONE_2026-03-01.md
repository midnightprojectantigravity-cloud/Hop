# ACAE Milestone — March 1, 2026

## Scope Delivered
This milestone delivers the ACAE pilot tranche as a hybrid, feature-flagged rollout with behavior preservation as default.

1. Engine data/contracts
- Added pilot ailment catalog and DSL contracts:
  - `packages/engine/src/data/ailments/contracts.ts`
  - `packages/engine/src/data/ailments/mvp-ailments.ts`
  - `packages/engine/src/data/ailments/parser.ts`
  - `packages/engine/src/data/ailments/consistency.ts`
- Added bootstrap consistency validation in:
  - `packages/engine/src/systems/tactical-data-bootstrap.ts`

2. Engine runtime
- Added ACAE runtime modules:
  - `packages/engine/src/systems/ailments/formula.ts`
  - `packages/engine/src/systems/ailments/stat-mapping.ts`
  - `packages/engine/src/systems/ailments/application.ts`
  - `packages/engine/src/systems/ailments/annihilation.ts`
  - `packages/engine/src/systems/ailments/hardening.ts`
  - `packages/engine/src/systems/ailments/tick.ts`
  - `packages/engine/src/systems/ailments/runtime.ts`
- Added effect handlers:
  - `packages/engine/src/systems/effects/ailment-handlers.ts`
- Added atomic effect + event/timeline type support and ruleset persistence.

3. Tile and skill integration (pilot)
- Added `MIASMA` tile effect ID + registry entry.
- Added feature-flagged tile injections for `LAVA`, `FIRE`, `WET`, `MIASMA`, `ICE` in:
  - `packages/engine/src/systems/tiles/tile-effects.ts`
  - `packages/engine/src/systems/tiles/tile-registry.ts`
- Added spear-family bleed pilot paths:
  - `packages/engine/src/skills/spear_throw.ts`
  - `packages/engine/src/skills/basic_attack.ts`

4. Web integration
- Added entity ailment badges:
  - `apps/web/src/components/entity/entity-ailment-badges.tsx`
- Integrated badges into entity shell and comparator updates:
  - `apps/web/src/components/entity/entity-render-shell.tsx`
  - `apps/web/src/components/entity/entity-props-comparator.ts`
- Added preview ailment delta summaries:
  - `apps/web/src/components/game-board/useBoardTargetingPreview.ts`
  - `apps/web/src/components/PreviewOverlay.tsx`
- Added hardening toast feedback:
  - `apps/web/src/app/use-simulation-feedback.ts`

## Test and Audit Coverage

1. New engine tests
- `packages/engine/src/__tests__/acae_formula_application.test.ts`
- `packages/engine/src/__tests__/acae_annihilation_priority_dag.test.ts`
- `packages/engine/src/__tests__/acae_hardening_growth.test.ts`
- `packages/engine/src/__tests__/acae_tile_injection.test.ts`
- `packages/engine/src/__tests__/acae_effect_handler_integration.test.ts`
- `packages/engine/src/__tests__/acae_scenarios_runner.test.ts`

2. New scenario collection
- `packages/engine/src/scenarios/acae.ts`

3. New web tests
- `apps/web/src/__tests__/entity_ailment_badges.test.tsx`
- `apps/web/src/__tests__/preview_ailment_delta_overlay.test.tsx`
- `apps/web/src/__tests__/simulation_feedback_ailment_toast.test.tsx`

4. ACAE audits/scripts
- `packages/engine/scripts/runAcaeLethalitySimulation.ts`
- `packages/engine/scripts/runAcaeHardeningAudit.ts`
- `packages/engine/scripts/runAcaeCleansePathAudit.ts`
- `packages/engine/scripts/runAcaeAnnihilationStability.ts`
- `packages/engine/scripts/runAcaeStrict.ts`
- Baselines:
  - `packages/engine/scripts/fixtures/acae/lethality.baseline.json`
  - `packages/engine/scripts/fixtures/acae/hardening.baseline.json`
  - `packages/engine/scripts/fixtures/acae/cleanse_path.baseline.json`
  - `packages/engine/scripts/fixtures/acae/annihilation_stability.baseline.json`

## Gate Results
Validated in this milestone:

1. `npm --workspace @hop/engine run build` ✅
2. `npm --workspace @hop/engine run check-script-imports` ✅
3. `npm --workspace @hop/engine run test:ai-acceptance:strict` ✅
4. `npm --workspace @hop/engine run test:acae:strict` ✅
5. `npm --workspace @hop/web run test:run` ✅
6. `npm --workspace @hop/web run build` ✅

## Compatibility Posture
1. ACAE is off by default unless enabled in `GameState.ruleset.ailments`.
2. Legacy status systems remain active for non-pilot paths.
3. Pilot logic is behavior-preserving for ACAE-disabled runs; strict AI/golden acceptance remains green.

