# Hop Engine - Project Context

## Core Architecture
- Referee (Engine): `packages/engine` - headless, deterministic TypeScript game logic.
- Juice (Client): `apps/web` - React/PixiJS UI rendering only (no game logic).
- Server: `apps/server` - headless validation and leaderboard.

## Repo Map (Quick Paths)
- Engine entry: `packages/engine/src/logic.ts` (reducer + turn loop).
- Skills: `packages/engine/src/skills/`
- Systems: `packages/engine/src/systems/`
- Scenarios: `packages/engine/src/scenarios/`
- Web app: `apps/web/src/`
- Server: `apps/server/index.js`

## Non-Negotiables
- Determinism: use engine RNG (`rngCounter`), no `Math.random` in logic.
- Single source of truth: `state.tiles` Map + `UnifiedTileService`.
- Intent vs execution: validate intent before execution; execution emits `AtomicEffect`s only.
- Movement hooks: tile `onPass`/`onEnter` via `TileResolver`.

## Skills and Targeting
- Skills are compositional (`SkillDefinition`); UI uses `getValidTargets`.
- Passive skills may be triggered by tile click; active skills require explicit selection.
- Targeting must be deterministic and mirror execution rules (LoS, hazards, occupancy).

## Logic Rules (Gold Standard)
- Intent before execution: validate against current `GameState` before mutating.
- Atomic effects only: execution produces `AtomicEffect[]`, never direct mutations.
- Determinism: use engine RNG, no `Math.random` in logic.
- Immutability: reducers return fresh state objects each turn.
- Movement hooks: all movement must pass through tile `onPass`/`onEnter`.
- Occupancy mask: refresh at the start of each execution phase.
- Entity factory: create all actors via `EntityFactory` with consistent skills.

## Testing and Quality
- Scenario-driven tests in `packages/engine/src/scenarios/`.
- Run scenarios: `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts`
- Validate replays: `packages/engine/scripts/validateReplay.ts`
