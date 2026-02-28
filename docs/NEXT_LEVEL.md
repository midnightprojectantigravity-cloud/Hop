# NEXT_LEVEL Active Tracker

## Status (February 28, 2026)
- AI convergence is complete and gated:
  - `docs/AI_CONVERGENCE_MILESTONE_2026-02-28.md`
- Post-AI roadmap tranches are complete and gated:
  - `docs/NEXT_PHASES_MILESTONE_2026-02-28.md`
- Current project status and validation snapshot:
  - `docs/STATUS.md`

## Current Operating Mode
- Behavior-preserving changes only by default.
- Determinism and replay parity are non-negotiable.
- No new gameplay systems unless explicitly approved as a new tranche.
- Active balance/tuning intake is tracked in:
  - `docs/BALANCE_BACKLOG.md`

## Active Priorities

### P1: Compatibility Cleanup (Engine)
Goal: remove temporary compatibility ownership after migration stability window.

- [ ] Remove new runtime dependencies on compatibility constants (`ENEMY_STATS`, `FLOOR_ENEMY_*`).
- [ ] Define and execute retirement plan for deprecated compatibility exports in a dedicated cleanup slice.
- [ ] Add a CI/static guard to block new ownership callsites on deprecated constants.

Acceptance:
- [ ] Runtime/evaluation ownership stays catalog/profile-backed only.
- [ ] Strict AI acceptance gate remains green.

### P2: Frontend Complexity Follow-up (Web)
Goal: continue reducing high-churn file complexity without behavior drift.

- [ ] Continue decomposition of `apps/web/src/components/BiomeSandbox.tsx` into smaller feature modules.
- [ ] Continue decomposition of `apps/web/src/components/Entity.tsx` rendering branches where complexity remains high.
- [ ] Keep external props/API behavior stable for existing app integration.

Acceptance:
- [ ] `npm --workspace @hop/web run test:run` passes.
- [ ] `npm --workspace @hop/web run build` passes.

### P3: Harness and Evaluation Hardening (Engine)
Goal: keep shared harness core stable and easier to extend.

- [ ] Add any missing parity/regression checks when new harness metrics are introduced.
- [ ] Keep `balance-harness` and `pvp-harness` as thin wrappers over shared batch primitives.
- [ ] Keep public harness exports stable.

Acceptance:
- [ ] `npm --workspace @hop/engine run test:ai-acceptance:strict` passes.
- [ ] `npx vitest run packages/engine/src/__tests__/balance_harness.test.ts` passes.
- [ ] `npx vitest run packages/engine/src/__tests__/pvp_harness.test.ts` passes.

## Merge Gate (Default for Active Tranches)
- `npm --workspace @hop/engine run build`
- `npm --workspace @hop/engine run check-script-imports`
- `npm --workspace @hop/engine run test:ai-acceptance:strict`
- `npm --workspace @hop/web run test:run`
- `npm --workspace @hop/web run build`

## History and Archives
- Historical roadmap log: `docs/ROADMAP_HISTORY.md`
- Archived implementation plans: `docs/archive/`
