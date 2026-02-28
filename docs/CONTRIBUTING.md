# Contributing to Hop

This document covers the current repo layout, local workflows, and the engine rules that matter most when making changes.

## Monorepo layout

- `packages/engine` - deterministic headless game logic (the referee)
- `apps/web` - React/Pixi client rendering and UI (the juice)
- `apps/server` - headless validation / leaderboard server

## Quickstart

1. Install dependencies
   - `npm install`
2. Run the web app
   - `npm run dev`
3. Run tests
   - `npm test`

## Engine guardrails (non-negotiable)

- Determinism first: engine logic must use engine RNG (`rngCounter` flow), never `Math.random`.
- Intent before execution: validate actions against current state before mutating.
- Atomic effects only: execution emits `AtomicEffect[]`; effect handlers perform mutations.
- Tile source of truth: `state.tiles` + `UnifiedTileService`.
- Movement hooks: all movement must pass through tile `onPass` / `onEnter` flows.
- Entity creation: use `EntityFactory` paths for consistent runtime hydration.

## Testing

- Scenario mechanics tests:
  - `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts`
- Golden run integration envelopes (multi-turn seeded runs):
  - `npx vitest run packages/engine/src/__tests__/golden-runs/`
  - strict fingerprint mode: `HOP_GOLDEN_STRICT=1 npx vitest run packages/engine/src/__tests__/golden-runs/`
- Engine AI acceptance suite (parity + strategy + scenarios + harness + strict golden runs):
  - `npm --workspace @hop/engine run test:ai-acceptance`
  - strict mode (recommended before merging AI changes): `npm --workspace @hop/engine run test:ai-acceptance:strict`
- Web tests (non-watch):
  - `npm --workspace @hop/web exec vitest run`
- Replay validation:
  - `npx vitest run packages/engine/src/__tests__/replay_validation.test.ts`
  - `packages/engine/scripts/validateReplay.ts`
- Script import integrity:
  - `npm --workspace @hop/engine run check-script-imports`

## Skill registry codegen (important)

The skill registry import list is generated at build time.

- Generator script:
  - `packages/engine/scripts/generateSkillRegistry.ts`
- Generated output:
  - `packages/engine/src/generated/skill-registry.generated.ts`
- Engine package scripts:
  - `npm --workspace @hop/engine run generate-skill-registry`
  - `npm --workspace @hop/engine run prebuild` (runs generator)

When adding/removing skill files in `packages/engine/src/skills/`, run the generator before committing.

## Content pipeline notes

- Enemy content is defined in shared MVP pack-backed data and consumed by:
  - `packages/engine/src/data/bestiary.ts` (compatibility facade)
  - `packages/engine/src/data/packs/mvp-pack.ts` (base-unit pack hydration)
- Default player loadouts are data definitions in:
  - `packages/engine/src/data/loadouts/default-loadouts.ts`
- Runtime loadout hydration/validation remains in:
  - `packages/engine/src/systems/loadout.ts`

## AI parity fixtures and rebaseline policy

- Enemy AI parity corpus expected outputs are snapshot fixtures:
  - `packages/engine/src/__tests__/__fixtures__/ai/enemy_decision_corpus/expected_outputs.v1.json`
- Regenerate/check them with:
  - `npm --workspace @hop/engine run generate-enemy-ai-parity-fixture`
  - `npm --workspace @hop/engine run check-enemy-ai-parity-fixture`
- Rebaseline rules (strict):
  - Rebaseline only after reviewing the behavior change and confirming it is intended.
  - Run `npm --workspace @hop/engine run test:ai-acceptance:strict` before and after the rebaseline.
  - If strict golden fingerprints change, include the reason in the PR description and keep the failure artifacts for review while iterating.

## AI decision framework entry points

- Enemy runtime decision path:
  - `packages/engine/src/systems/ai/enemy/selector.ts` via `selectEnemyDecision(...)`
- Strategy adapter path (Intent output):
  - `packages/engine/src/systems/ai/ai.ts` via `decideEnemyIntent(...)`
  - wrapper delegates to selector path and is consumed by `packages/engine/src/strategy/wild.ts`
- Candidate and scoring layers:
  - candidates: `packages/engine/src/systems/ai/enemy/candidates.ts`
  - features: `packages/engine/src/systems/ai/enemy/features.ts`
  - core scoring/tiebreak contracts: `packages/engine/src/systems/ai/core/`
- Player-bot shared selector surface:
  - `packages/engine/src/systems/ai/player/`
- Diagnostics and parity tools:
  - `npm --workspace @hop/engine run report-enemy-ai-mode-diff`
  - `npm --workspace @hop/engine run report-enemy-ai-turn-mode-diff`
  - `npm --workspace @hop/engine run report-enemy-ai-policy-dependence`

Milestone reference:
- `docs/AI_CONVERGENCE_MILESTONE_2026-02-28.md`

## Submitting changes

- Keep PRs focused.
- Add or update tests for behavior changes.
- Prefer scenario tests for mechanics, golden runs for cross-system regressions.
- Run relevant typechecks/tests before opening a PR.
