# Hop Master Tech Stack

This document is the high-level architecture snapshot for the live repo.

## Core Principles

1. Headless-first referee
- All gameplay truth lives in `packages/engine`.
- `apps/web` renders and orchestrates UX only.

2. Determinism
- Engine RNG and `rngCounter` are authoritative.
- No `Math.random` in engine logic.

3. Intent before execution
- Actions are validated before mutation.
- Execution emits atomic effects only.

4. Tile and movement contract
- `state.tiles` is the tile source of truth.
- Movement resolves through tile hooks and tile services.

## Repository Topology

- `packages/engine` - deterministic engine, AI, simulation, evaluation
- `apps/web` - React presentation layer
- `apps/server` - replay validation and leaderboard service

## Engine Runtime

### Reducer and turn core

- `packages/engine/src/logic.ts`
- `packages/engine/src/logic-turn-loop.ts`
- `packages/engine/src/logic-rules.ts`

### Effect runtime

- `packages/engine/src/systems/effect-engine.ts`
- effect handlers under `packages/engine/src/systems/effects/`

### Grouped systems

- AI: `packages/engine/src/systems/ai/`
- Combat: `packages/engine/src/systems/combat/`
- Entities: `packages/engine/src/systems/entities/`
- Evaluation: `packages/engine/src/systems/evaluation/`
- Movement: `packages/engine/src/systems/movement/`
- Tiles: `packages/engine/src/systems/tiles/`
- Visual metadata: `packages/engine/src/systems/visual/`

### Combat and IRES

- Combat is live only on `trinity_ratio_v2`
- Trinity content ships as `core-v2-live`
- IRES is fully integrated into live runtime skill costs and pacing

### ACAE and capability runtime

- ACAE is part of the live runtime path
- shared-vector carry is always live
- loadout passive capability content is always live
- movement capability runtime policy is always live
- retired runtime flag branches are no longer part of the supported architecture

Supported authoritative ruleset families:

- `ruleset.combat`
- `ruleset.ires`

Legacy rollout-era ruleset branches may appear only in old payloads and are normalized away during hydration.

## AI Stack

### Shared tactical identity

- behavior overlays resolve actor posture from:
  - universal default
  - loadout overlay
  - skill-derived identity
  - ready-skill tactical bias
  - temporary runtime overlays

### Shared pacing

- Spark doctrine applies rested-aware weighted taxes and bonuses
- pacing logic is shared across players, enemies, companions, and summons
- runtime selection and evaluation harnesses use the same shared AI core

### Main AI entry areas

- `packages/engine/src/systems/ai/generic-unit-ai.ts`
- `packages/engine/src/systems/ai/behavior-profile.ts`
- `packages/engine/src/systems/ai/spark-doctrine.ts`
- `packages/engine/src/systems/ai/player/`
- `packages/engine/src/systems/ai/enemy/`

## World Compiler

- Deterministic map generation lives under `packages/engine/src/generation/`
- web run starts and floor transitions use artifact-only worker transport
- full `GameState` does not cross the worker boundary

## Quality Gates

```powershell
npm run build
npm --workspace @hop/engine run test:full
npm --workspace @hop/web run test:run
npm run engine:fast
npm run upa:quick:ai
```

Additional engine gates:

```powershell
npm --workspace @hop/engine run test:ai-acceptance:strict
npm --workspace @hop/engine run test:acae:strict
npm --workspace @hop/engine run check-script-imports
```

## Related Docs

- Current law: `docs/STATUS.md`
- Guardrails: `docs/GOLD_STANDARD_MANIFESTO.md`
- Active tracker: `docs/NEXT_LEVEL.md`
- Historical milestone docs: `docs/archive/`
