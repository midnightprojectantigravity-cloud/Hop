# NEXT_LEVEL Active Tracker

## Status (March 1, 2026)
- AI convergence is complete and gated:
  - `docs/AI_CONVERGENCE_MILESTONE_2026-02-28.md`
- Post-AI roadmap tranches are complete and gated:
  - `docs/NEXT_PHASES_MILESTONE_2026-02-28.md`
- ACAE pilot tranche is complete and gated (feature-flagged hybrid rollout):
  - `docs/ACAE_MILESTONE_2026-03-01.md`
- Documentation sync for post-tranche architecture is complete:
  - `docs/MASTER_TECH_STACK.md`
  - `docs/GOLD_STANDARD_MANIFESTO.md`
  - `docs/CONTRIBUTING.md`
  - `docs/STATUS.md`
- Current project status and validation snapshot:
  - `docs/STATUS.md`

## Current Operating Mode
- Behavior-preserving changes only by default.
- Determinism and replay parity are non-negotiable.
- New gameplay systems are introduced only as explicit, gated tranches.
- Active balance/tuning intake is tracked in:
  - `docs/BALANCE_BACKLOG.md`

## Active Priorities

### P1: Compatibility Retirement Plan (Engine)
Goal: retire temporary compatibility exports after migration stability window.

- [x] Remove new runtime dependencies on compatibility constants (`ENEMY_STATS`, `FLOOR_ENEMY_*`).
- [x] Isolate compatibility constants to a dedicated legacy surface.
- [x] Add a CI/static guard to block new ownership callsites on deprecated constants.
- [x] Remove deprecated compatibility exports from engine source + package exports.

Acceptance:
- [x] Runtime/evaluation ownership stays catalog/profile-backed only.
- [x] `check-script-imports` enforces deprecated-constant usage checks.
- [x] Strict AI acceptance gate remains green.

### P2: Frontend Complexity Follow-up (Web)
Goal: continue reducing high-churn file complexity without behavior drift.
Status: complete for this tranche (`BiomeSandbox.tsx` is 74 lines, `Entity.tsx` is 110 lines).

- [x] Extract `BiomeSandbox` defaults + persistence/copy workflow into dedicated state modules/hooks.
- [x] Split `BiomeSandboxControlsPanel` into section components under `components/biome-sandbox/controls/*`.
- [x] Extract `Entity` motion and visual-state logic into dedicated hooks under `components/entity/*`.
- [x] Extract `Entity` ring/status/spear render branches into `components/entity/*` presentational modules.
- [x] Extract `Entity` render shell + memo comparator helpers into dedicated `components/entity/*` modules.
- [x] Decompose `JuiceEffectsLayer` into focused renderer modules (`juice-effect-signature-renderers`, `juice-effect-generic-renderers`).
- [x] Decompose `useBoardBiomeVisuals` into focused modules (`biome-visuals-types`, `biome-visuals-utils`, `biome-mountain-settings`).
- [x] Decompose `useBoardJuicePresentation` into focused modules (`board-juice-pose-builder`, `board-juice-camera-cues`, `board-juice-presentation-types`, `board-juice-presentation-utils`).
- [x] Decompose `use-juice-manager-effects` timeline/cleanup logic into focused modules (`juice-timeline-utils`, `juice-cleanup-utils`).
- [x] Decompose `ClutterObstaclesLayer` sprite branches into focused modules (`clutter-obstacles-renderers`, `clutter-obstacles-types`).
- [x] Decompose `BiomeBackdropLayer` into focused modules (`biome-backdrop-defs`, `biome-backdrop-surfaces`, `biome-backdrop-types`).
- [x] Decompose `useBoardCamera` sync logic into focused modules (`board-camera-sync`, `board-camera-types`).
- [x] Extract `GameBoard` SVG/layer render stack into `components/game-board/GameBoardSceneSvg.tsx` and keep `GameBoard.tsx` focused on orchestration/hooks.
- [x] Decompose `ui-log-feed` into classifier/types/filter-controls/entries modules and add classifier unit coverage.
- [x] Decompose `ui-status-panel` into focused section modules (header, initiative, vitals, progress, directives).
- [x] Continue decomposition of `apps/web/src/components/BiomeSandbox.tsx` into smaller feature modules.
- [x] Continue decomposition of `apps/web/src/components/Entity.tsx` rendering branches where complexity remains high.
- [x] Keep external props/API behavior stable for existing app integration.

Acceptance:
- [x] `npm --workspace @hop/web run test:run` passes.
- [x] `npm --workspace @hop/web run build` passes.

### P3: Harness and Evaluation Hardening (Engine)
Goal: keep shared harness core stable and easier to extend.

- [x] Add missing parity/regression checks for shared batch behavior and seed normalization in harness suites.
- [x] Keep `balance-harness` and `pvp-harness` as thin wrappers over shared batch primitives.
- [x] Keep public harness exports stable.

Acceptance:
- [x] `npm --workspace @hop/engine run test:ai-acceptance:strict` passes.
- [x] `npx vitest run packages/engine/src/__tests__/balance_harness.test.ts` passes.
- [x] `npx vitest run packages/engine/src/__tests__/pvp_harness.test.ts` passes.

### P4: ACAE Pilot (Engine + Web)
Goal: introduce a deterministic, data-driven ailment counter runtime behind a persisted ruleset flag.
Status: complete for pilot tranche.

- [x] Added pilot ailment content/contracts/parser (`burn`, `wet`, `poison`, `frozen`, `bleed`) and bootstrap consistency validation.
- [x] Added ACAE runtime modules for formula evaluation, trigger/deposit, annihilation, hardening, and tick orchestration.
- [x] Added new atomic effect handlers (`ApplyAilment`, `DepositAilmentCounters`, `ClearAilmentCounters`).
- [x] Added feature-flagged tile injections for `LAVA`, `FIRE`, `WET`, `MIASMA`, and `ICE`.
- [x] Added spear-family bleed pilot path.
- [x] Added web counter badges, preview ailment delta math overlay text, and hardening toast feedback.
- [x] Added ACAE strict suite and audits:
  - `npm --workspace @hop/engine run test:acae:strict`

## Merge Gate (Default for Active Tranches)
- `npm --workspace @hop/engine run build`
- `npm --workspace @hop/engine run check-script-imports`
- `npm --workspace @hop/engine run test:ai-acceptance:strict`
- `npm --workspace @hop/engine run test:acae:strict`
- `npm --workspace @hop/web run test:run`
- `npm --workspace @hop/web run build`

## History and Archives
- Historical roadmap log: `docs/ROADMAP_HISTORY.md`
- Archived implementation plans: `docs/archive/`
