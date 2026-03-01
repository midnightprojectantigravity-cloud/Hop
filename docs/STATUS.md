# Codebase Status - March 1, 2026

## Major Accomplishment
Post-AI roadmap tranches are complete and hardened (content pipeline closure, frontend decomposition, harness core unification).

Delivered outcomes:
1. Content pipeline closure:
   - canonical enemy catalog + floor spawn profile modules
   - map/evaluator runtime paths decoupled from `ENEMY_STATS` ownership
   - bootstrap-time enemy content consistency validation
2. Compatibility hardening:
   - deprecated constants retired from engine source + package export surface
   - static check guard for deprecated constants usage
3. Frontend decomposition:
   - biome sandbox state/normalization/storage extracted into dedicated modules
   - `UI.tsx` split into shell + log/status panels
   - entity icon/animation helpers extracted into dedicated modules
4. Harness core unification:
   - shared `harness-batch` contracts used by both `balance-harness` and `pvp-harness`
   - public harness API preserved
5. New regression coverage for all three tranches:
   - content consistency + spawn profile + evaluator source tests
   - biome sandbox state/preview and entity animation helper tests
   - harness batch wrapper parity tests

References:
- `docs/AI_CONVERGENCE_MILESTONE_2026-02-28.md`
- `docs/NEXT_PHASES_MILESTONE_2026-02-28.md`

## Validation Snapshot (Current)

Engine:
- `npm --workspace @hop/engine run build` -> pass
- `npm --workspace @hop/engine run check-script-imports` -> pass
- `npm --workspace @hop/engine run test:ai-acceptance:strict` -> pass

Web:
- `npm --workspace @hop/web run test:run` -> pass
- `npm --workspace @hop/web run build` -> pass

## Current Risk Posture

1. No known blocking regressions in the strict AI acceptance gate.
2. Determinism/parity checks are active and should remain mandatory for AI-affecting and content-spawn-affecting PRs.
3. Deprecated constants (`ENEMY_STATS`, `FLOOR_ENEMY_*`) are retired from source ownership and blocked by static checks; runtime ownership remains catalog/profile-backed.
4. Diagnostics (`oracle/shadow` diff scripts/tests) are retained for investigation workflows.

## Next Documentation Focus

1. Keep architecture references aligned with grouped system directories (`ai`, `evaluation`, `combat`, `entities`, `tiles`).
2. Keep completed implementation plans under `docs/archive/`; keep only living trackers and runbooks at `docs/` root.
3. Keep generated/audit artifacts in `artifacts/upa/`; keep stable references in `docs/`.
