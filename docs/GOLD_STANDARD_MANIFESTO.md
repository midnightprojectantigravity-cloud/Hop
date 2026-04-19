# The Hop Engine: Gold Standard Manifesto

This document defines the non-negotiable architecture and quality rules for Hop.

## 1. Engine and Client Contract

1. Referee (`packages/engine`) is deterministic game truth only.
2. Juice (`apps/web`) is presentation only.
3. Gameplay logic does not live in the client.

## 2. Intent and Execution Contract

1. Intent is validated against current `GameState` before mutation.
2. Execution emits `AtomicEffect[]`.
3. Skills and systems do not directly mutate runtime state.
4. Simulation and preview stay deterministic and side-effect free.

## 3. Determinism Rules

1. Use engine RNG only.
2. Spatial and tactical tie-breakers must be deterministic.
3. Replays must reproduce identical outcomes for the same seed and actions.

## 4. Grid and Tile Rules

1. The world source of truth is `state.tiles` with `UnifiedTileService`.
2. Movement passes through tile hooks.
3. Occupancy is refreshed at execution boundaries.
4. One hex, one entity.

## 5. Entity and Skill Rules

1. Actor creation goes through `EntityFactory`.
2. Actor behavior is derived from loadouts, skills, and runtime state, not bespoke entity-type scripts.
3. Skill targeting must mirror execution rules.
4. Skill files provide intent/effects composition, not isolated runtime mutations.

## 6. Content Ownership Rules

1. Runtime enemy ownership is catalog-based.
2. Floor spawn ownership is profile-based.
3. Deprecated constants such as `ENEMY_STATS` and `FLOOR_ENEMY_*` are not runtime ownership sources.
4. Content consistency must validate at bootstrap.

## 7. AI and Evaluation Rules

1. Runtime enemy AI and evaluation/harness AI share the same generic core.
2. Tactical identity resolves through behavior overlays.
3. Spark pacing resolves through the shared Spark doctrine.
4. Strategy adapters may translate decisions, but may not become authoritative bespoke AI playbooks.
5. Evaluation runners should extend shared harness primitives rather than duplicating orchestration.

## 8. Runtime Ruleset Rules

1. Combat runs on `trinity_ratio_v2` only.
2. Trinity content ships as `core-v2-live` only.
3. ACAE, shared-vector carry, loadout passive capability content, and movement capability runtime are unconditional live runtime behavior.
4. Retired rollout flags, URL params, env defaults, and retired ruleset branches are not supported runtime control surfaces.
5. Legacy payload compatibility is hydration-only; live state must not re-emit retired branches.

## 9. ACAE Runtime Rules

1. ACAE is deterministic and part of the live runtime.
2. No runtime string eval is allowed for ailment formulas.
3. Ailment trigger, deposit, annihilation, tick, and hardening paths must never use `Math.random`.
4. Tile injectors must not double-apply overlapping hazard payloads.
5. Ailment interaction graphs must validate as acyclic at bootstrap.

## 10. Quality Gates

```powershell
npm run build
npm --workspace @hop/engine run test:full
npm --workspace @hop/web run test:run
npm run engine:fast
npm run upa:quick:ai
```

Use stricter engine gates when touching those surfaces:

```powershell
npm --workspace @hop/engine run check-script-imports
npm --workspace @hop/engine run test:ai-acceptance:strict
npm --workspace @hop/engine run test:acae:strict
```

## 11. Documentation Topology

1. Current runtime law: `docs/STATUS.md`
2. Architecture overview: `docs/MASTER_TECH_STACK.md`
3. Historical tracker snapshot: `docs/NEXT_LEVEL.md`
4. Historical milestone material: `docs/archive/`
5. Balance doctrine: `docs/GOLD_STANDARD_BALANCING.md`
