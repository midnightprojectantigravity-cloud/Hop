# UPA Success Tuning Milestone - March 1, 2026

## Scope Completed
UPA multi-archetype success tuning was implemented end-to-end with strict no-regress gating:
1. Policy and selector tuning for weak archetypes.
2. Targeted trinity profile buffs for underperforming player archetypes.
3. Bounded skill constant tuning for `ASSASSIN`, `HUNTER`, and `SKIRMISHER` kits.
4. Deterministic tuning scripts and gate automation.
5. Golden strict rebaseline updates where behavior drift was intentionally accepted.

## Implemented Surfaces
1. AI policy/selection:
   - `packages/engine/src/systems/ai/strategic-policy.ts`
   - `packages/engine/src/systems/ai/player/selector.ts`
   - `packages/engine/src/systems/ai/player/policy.ts`
   - `packages/engine/src/systems/ai/player/candidates.ts`
   - `packages/engine/src/systems/ai/player/harness-runner.ts`
2. Archetype combat profile tuning:
   - `packages/engine/src/systems/combat/trinity-profiles.ts`
3. Targeted skill tuning:
   - `packages/engine/src/skills/sneak_attack.ts`
   - `packages/engine/src/skills/withdrawal.ts`
   - `packages/engine/src/skills/kinetic_tri_trap.ts`
   - `packages/engine/src/skills/grapple_hook.ts`
   - `packages/engine/src/skills/vault.ts`
4. Tooling:
   - `packages/engine/scripts/runUpaArchetypeSweep.ts`
   - `packages/engine/scripts/runUpaTuningGate.ts`
   - `packages/engine/scripts/rebaselineGoldenFingerprints.ts`
   - root scripts in `package.json`: `upa:tuning:baseline`, `upa:tuning:candidate`, `upa:tuning:gate`, `golden:rebaseline:fingerprints`

## Acceptance Results
`npm run upa:tuning:gate` result:
1. `passed: true`
2. `regressions: 0`
3. `unmetChecks: 0`
4. `weakestDelta: 0.7033`
5. `focusArchetype: ASSASSIN`
6. `focusArchetypeDelta: 0.7567`

Artifacts:
1. `artifacts/upa/UPA_TUNING_BASELINE.json`
2. `artifacts/upa/UPA_TUNING_CANDIDATE.json`
3. `artifacts/upa/UPA_TUNING_GATE_REPORT.json`

## Strict Gate Closure
All required gates are green:
1. `npm --workspace @hop/engine run build`
2. `npm --workspace @hop/engine run check-script-imports`
3. `npm --workspace @hop/engine run test:ai-acceptance:strict`
4. `npm --workspace @hop/web run test:run`
5. `npm --workspace @hop/web run build`

## Baseline/Fixture Updates Applied
To keep strict suites aligned with the tuned deterministic baseline:
1. `packages/engine/src/__tests__/enemy_ai_shadow_fallback_rate.test.ts`
   - fallback corpus `totalCases` baseline updated to `176`.
2. `packages/engine/src/__tests__/harness_ai_convergence_regression.test.ts`
   - necromancer timeout/turn envelopes updated to match post-tuning deterministic behavior.
3. `packages/engine/src/__tests__/golden-runs/fixtures/hunter_floor3_loss.json`
   - envelope updated (`floorsTarget`, `finalFloor`, `totalTurns`) and strict fingerprint updated.

## Notes
1. This tranche intentionally changes balance outcomes while preserving determinism and replay stability.
2. ACAE pilot work is separate and tracked in `docs/ACAE_MILESTONE_2026-03-01.md`.
