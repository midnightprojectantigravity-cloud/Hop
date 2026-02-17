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

## 6) Combat Math and Telemetry Rules
1. Combat calculations are centralized through the calculator pipeline.
2. Trinity levers (`Body`, `Mind`, `Instinct`) are shared system inputs.
3. UPA and grade outputs are telemetry and balancing inputs, not runtime gameplay gates.

## 7) Quality Gates
1. Scenario-first validation for behavior changes.
2. Build must pass (`npm run build`).
3. Scenario release gate must pass:
   - `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts --silent`
4. UPA health gate must pass for balance changes:
   - `npm run upa:health:check`

## 8) Documentation Topology
1. Active tracker: `docs/NEXT_LEVEL.md`
2. Active balance backlog: `docs/BALANCE_BACKLOG.md`
3. UPA operations: `docs/UPA_GUIDE.md`
4. Historical archive: `docs/ROADMAP_HISTORY.md`
5. Biome + bestiary + trinity contract: `docs/BIOME_BESTIARY_TRINITY_CONTRACT.md`
6. Generated audit/test artifacts: `artifacts/upa/` (not `docs/` root)
