# The Hop Engine: Gold Standard Manifesto

## Purpose
This document defines the non-negotiable architecture and quality rules for Hop.
Use it as the decision filter for engine, client, and balance changes.

## 1) Engine and Client Contract
1. Referee (`packages/engine`): deterministic game truth only.
2. Juice (`apps/web`): presentation only (animation, VFX, input UX).
3. No gameplay logic is implemented in the client.

## 2) Intent and Execution Contract
1. Intent is validated against current `GameState` before mutation.
2. Execution emits `AtomicEffect[]`; no direct state mutation from skills.
3. Turn consumption happens only on valid execution outcomes.
4. Simulation/preview must remain deterministic and side-effect free.

## 3) Determinism Rules
1. Use engine RNG only (`rngCounter`); no `Math.random()` in logic.
2. Spatial tie-breakers must be deterministic.
3. Replays must produce identical outcomes for same seed + inputs.

## 4) Grid and Tile Rules
1. Single source of truth for world state is `state.tiles` with `UnifiedTileService`.
2. Movement must pass through tile hooks (`onPass`, `onEnter`) via `TileResolver`.
3. Occupancy mask is refreshed at execution-phase boundaries.
4. One hex, one entity.

## 5) Entity and Skill Rules
1. All actor creation goes through `EntityFactory`.
2. Actor behavior is defined by skill loadout IDs and skill definitions.
3. Skill targeting (`getValidTargets`) must mirror execution rules.
4. Skill files should provide intent and effects, not isolated combat math.

## 6) Content Ownership Rules
1. Runtime enemy ownership is catalog-based (`data/enemies/enemy-catalog.ts`), not constants-table based.
2. Floor spawn ownership is profile-based (`data/enemies/floor-spawn-profile.ts`).
3. `ENEMY_STATS` and `FLOOR_ENEMY_*` constants are retired and must not appear in runtime source ownership paths.
4. Content consistency must be validated at bootstrap (`ensureTacticalDataBootstrapped()`).
5. Deprecated-constant ownership is enforced by script gate (`check-script-imports` + `checkDeprecatedConstantsUsage`).

## 7) AI and Harness Rules
1. Enemy AI and harness policy logic must use shared AI core contracts (`systems/ai/core/*`) for scoring and tie-break behavior.
2. Deterministic tie-break selection must use explicit adapters (`consumeRandom` or seeded chooser), never ad hoc randomness.
3. Strategy adapters may translate decisions, but must preserve deterministic target/action outcomes.
4. Harness orchestration must use shared batch primitives (`systems/evaluation/harness-batch.ts`) when adding new runners.

## 8) Combat Math and Telemetry Rules
1. Combat calculations are centralized through the calculator pipeline.
2. Trinity levers (`Body`, `Mind`, `Instinct`) are shared system inputs.
3. UPA and grade outputs are telemetry and balancing inputs, not runtime gameplay gates.

## 9) Quality Gates
1. Engine build must pass:
   - `npm --workspace @hop/engine run build`
2. Script import integrity must pass:
   - `npm --workspace @hop/engine run check-script-imports`
3. Strict AI acceptance must pass:
   - `npm --workspace @hop/engine run test:ai-acceptance:strict`
4. Strict ACAE acceptance must pass when ACAE tranche code is touched:
   - `npm --workspace @hop/engine run test:acae:strict`
5. Web regression gates must pass:
   - `npm --workspace @hop/web run test:run`
   - `npm --workspace @hop/web run build`
6. Behavior change slices should keep scenario coverage green:
   - `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts --silent`
7. Balance slices should keep UPA health gate green:
   - `npm run upa:health:check`

## 10) ACAE Runtime Rules (Pilot)
1. ACAE is state-ruleset gated (`GameState.ruleset.ailments.acaeEnabled`) and deterministic.
2. No runtime string eval is allowed for ailment formulas; only deterministic DSL evaluators are permitted.
3. Ailment trigger/deposit/annihilation/tick/hardening must never use `Math.random`; use engine RNG (`consumeRandom`) when a roll is required.
4. Pilot ailment paths must preserve legacy behavior when ACAE is disabled.
5. Tile injectors (`LAVA`, `FIRE`, `WET`, `MIASMA`, `ICE`) must not double-apply legacy + ACAE payloads on the same path.
6. Hardening persistence is per-run only in this tranche.
7. Ailment interaction graph must validate as acyclic at bootstrap.

## 11) Documentation Topology
1. Current status board: `docs/STATUS.md`
2. Active tracker: `docs/NEXT_LEVEL.md`
3. AI convergence milestone: `docs/AI_CONVERGENCE_MILESTONE_2026-02-28.md`
4. Post-AI phases milestone: `docs/NEXT_PHASES_MILESTONE_2026-02-28.md`
5. ACAE milestone: `docs/ACAE_MILESTONE_2026-03-01.md`
6. Active balance backlog: `docs/BALANCE_BACKLOG.md`
7. UPA operations: `docs/UPA_GUIDE.md`
8. Historical archive: `docs/ROADMAP_HISTORY.md`
9. Archived completed plans: `docs/archive/`
10. Biome + bestiary + trinity contract: `docs/BIOME_BESTIARY_TRINITY_CONTRACT.md`
11. Generated audit/test artifacts: `artifacts/upa/` (not `docs/` root)
