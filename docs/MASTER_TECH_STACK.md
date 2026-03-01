# Hop Master Tech Stack

This document is the high-level source of truth for current engine/runtime architecture.

## Core Principles

1. Headless-first referee
- All gameplay truth lives in `packages/engine`.
- The web client renders and orchestrates UX only.

2. Determinism
- Engine RNG and `rngCounter` are authoritative.
- No `Math.random` in engine logic paths.
- Same seed + same actions must reproduce identical outcomes.

3. Intent before execution
- Actions/intents are validated before mutation.
- Execution emits atomic effects; handlers perform state transitions.

4. Tile and movement contract
- `state.tiles` is the tile source of truth.
- Movement resolves through tile hooks (`onPass`, `onEnter`) and tile services.

## Repository Topology

- `packages/engine` - deterministic game engine, AI, simulation, and evaluation.
- `apps/web` - React/Pixi presentation layer.
- `apps/server` - leaderboard/validation service.

## Engine Architecture (Current)

1. Turn and reducer core
- `packages/engine/src/logic.ts`
- `packages/engine/src/logic-turn-loop.ts`

2. Effects runtime
- `packages/engine/src/systems/effect-engine.ts`
- decomposed effect handlers in `packages/engine/src/systems/effects/`

3. Grouped systems
- AI: `packages/engine/src/systems/ai/`
- Combat: `packages/engine/src/systems/combat/`
- Entities: `packages/engine/src/systems/entities/`
- Evaluation/harness: `packages/engine/src/systems/evaluation/`
- Movement: `packages/engine/src/systems/movement/`
- Tiles: `packages/engine/src/systems/tiles/`
- Visual metadata: `packages/engine/src/systems/visual/`

4. Skills and registry
- Skills live in `packages/engine/src/skills/`.
- Registry generation:
  - source: `packages/engine/scripts/generateSkillRegistry.ts`
  - generated: `packages/engine/src/generated/skill-registry.generated.ts`

## AI Stack (Post-Convergence)

1. Shared AI core
- `packages/engine/src/systems/ai/core/types.ts`
- `packages/engine/src/systems/ai/core/scoring.ts`
- `packages/engine/src/systems/ai/core/tiebreak.ts`

2. Enemy runtime framework
- `packages/engine/src/systems/ai/enemy/candidates.ts`
- `packages/engine/src/systems/ai/enemy/features.ts`
- `packages/engine/src/systems/ai/enemy/policies.ts`
- `packages/engine/src/systems/ai/enemy/selector.ts`
- `packages/engine/src/systems/ai/enemy/decision-adapter.ts`

3. Runtime wrappers and strategy integration
- API-compatible wrapper: `packages/engine/src/systems/ai/ai.ts`
- strategy adapter use: `packages/engine/src/strategy/wild.ts`

4. Player/harness selector layer
- `packages/engine/src/systems/ai/player/`
- evaluation orchestration and contracts in `packages/engine/src/systems/evaluation/`

Reference milestone:
- `docs/AI_CONVERGENCE_MILESTONE_2026-02-28.md`

## Post-AI + Post-Tranche Baseline (March 1, 2026)

1. Content pipeline closure
- Canonical enemy runtime accessors:
  - `packages/engine/src/data/enemies/enemy-catalog.ts`
  - `packages/engine/src/data/enemies/floor-spawn-profile.ts`
- Content consistency validation:
  - `packages/engine/src/data/enemies/content-consistency.ts`
  - bootstrap gate in `packages/engine/src/systems/tactical-data-bootstrap.ts`
- Deprecated constants (`ENEMY_STATS`, floor enemy constants) are retired from source/export ownership.
- Guardrail:
  - `packages/engine/scripts/checkDeprecatedConstantsUsage.ts` (wired in `check-script-imports`)

2. Frontend decomposition (behavior-preserving)
- Biome sandbox state modules:
  - `apps/web/src/components/biome-sandbox/state/`
- Entity rendering helpers:
  - `apps/web/src/components/entity/`
- UI shell/panel decomposition:
  - `apps/web/src/components/ui/`

3. Harness core unification
- Shared batch contracts and orchestration:
  - `packages/engine/src/systems/evaluation/harness-batch.ts`
- Runtime harness entry points (API preserved):
  - `packages/engine/src/systems/evaluation/balance-harness.ts`
  - `packages/engine/src/systems/evaluation/pvp-harness.ts`

Reference milestone:
- `docs/NEXT_PHASES_MILESTONE_2026-02-28.md`

## Quality Gates

1. Engine build
- `npm --workspace @hop/engine run build`

2. Script import integrity
- `npm --workspace @hop/engine run check-script-imports`
  - includes deprecated-constants ownership guard

3. Strict AI acceptance
- `npm --workspace @hop/engine run test:ai-acceptance:strict`

4. Web tests (non-watch)
- `npm --workspace @hop/web run test:run`

5. Web build
- `npm --workspace @hop/web run build`

## Related Docs

1. Contribution workflow: `docs/CONTRIBUTING.md`
2. Current status: `docs/STATUS.md`
3. Active tracker: `docs/NEXT_LEVEL.md`
4. AI milestone: `docs/AI_CONVERGENCE_MILESTONE_2026-02-28.md`
5. Post-AI phases milestone: `docs/NEXT_PHASES_MILESTONE_2026-02-28.md`
6. Historical archive: `docs/ROADMAP_HISTORY.md`
7. Archived completed plans: `docs/archive/`
8. UPA operations: `docs/UPA_GUIDE.md`
9. Rules/guardrails: `docs/GOLD_STANDARD_MANIFESTO.md`
