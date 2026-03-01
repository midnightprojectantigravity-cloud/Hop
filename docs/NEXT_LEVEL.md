# NEXT_LEVEL Active Tracker

## Status (March 1, 2026)
- AI convergence is complete and gated:
  - `docs/AI_CONVERGENCE_MILESTONE_2026-02-28.md`
- Post-AI roadmap tranches are complete and gated:
  - `docs/NEXT_PHASES_MILESTONE_2026-02-28.md`
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
- No new gameplay systems unless explicitly approved as a new tranche.
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

## Merge Gate (Default for Active Tranches)
- `npm --workspace @hop/engine run build`
- `npm --workspace @hop/engine run check-script-imports`
- `npm --workspace @hop/engine run test:ai-acceptance:strict`
- `npm --workspace @hop/web run test:run`
- `npm --workspace @hop/web run build`

## History and Archives
- Historical roadmap log: `docs/ROADMAP_HISTORY.md`
- Archived implementation plans: `docs/archive/`
