# Codebase Assessment - March 23, 2026

Assessment refreshed against current repo state after the fast-engine-loop remediation pass.

Status note: this is a living assessment, not a frozen historical snapshot. Some of the "outstanding" items below have since been partially or fully addressed by later runtime migration and docs cleanup work, so the actionable sections should be read as a maintenance backlog rather than a precise list of current blockers.

Biome note: the current arcade proof now uses a split contract. `themeId` selects the applied biome/render hazard flavor, while `contentThemeId` keeps the authored 10-floor arcade content family stable so Vanguard and Hunter can share the same floor structure with different hazard materialization.

## Current Validation State

Engine:
- `npm --workspace @hop/engine run build` passes
- `npm --workspace @hop/engine run test` is now the smoke-tier loop
- `npm --workspace @hop/engine run test:targeting` passes
- `npm --workspace @hop/engine run test:scenarios` passes
- `npm --workspace @hop/engine run test:combat-smoke` passes
- `npm --workspace @hop/engine run test:full` passes
- `npm --workspace @hop/engine run test:worldgen` passes
- `npm run engine:fast` passes

Practical meaning:
- the previous highest-signal failures were in scenario/targeting setup drift and stale expectations
- the practical full-suite command is now actionable and green
- the remaining slow validation work is the acceptance-heavy tier kept outside `test:full`

Current repo context:
- the runtime skill bridge has expanded significantly beyond the state described in the original remediation pass
- generated runtime metadata and coverage manifests are now part of the standard maintenance loop
- docs and legacy compatibility cleanup are the main wrap-up focus rather than a new migration phase

## Actions Already Completed

Fast-loop and scenario repair:
- added layered engine scripts in `packages/engine/package.json`
- added root `engine:fast`
- fixed workspace-relative import-guard path handling
- fixed scenario/test setup visibility drift by adding a scratch recompute path
- corrected scenario harnesses so authored scenarios start from a player decision point
- restored scenario, targeting, combat-smoke, and worldgen slices to green

Script and artifact cleanup:
- deleted `packages/engine/scripts/checkRngParity.js`
- updated `@hop/engine` script `check-rng-parity` to `npx tsx ./scripts/checkRngParity.ts`
- removed `any` casts from `packages/engine/scripts/checkRngParity.ts`
- narrowed RNG helper typing in `packages/engine/src/systems/rng.ts`
- deleted:
  - `skill_test_results.txt`
  - `packages/engine/skill_test_results.txt`
  - `docs/UPA_SKILL_HEALTH.tmp.json`

Live command/document cleanup:
- updated live UPA calibration/health command paths to `artifacts/upa/...`
- updated active references in:
  - `package.json`
  - `packages/engine/scripts/runUpaCalibration.ts`
  - `docs/BALANCE_BACKLOG.md`
  - `docs/UPA_GUIDE.md`
  - `docs/archive/TRINITY_V2_INTEGRATION_SIGNOFF.md`
- updated `docs/STATUS.md` to the current March 23, 2026 validation state

## Outstanding High-Signal Items

### 1. Acceptance-heavy suite posture

Current fact:
- `npm --workspace @hop/engine run test:full` now passes in the practical split configuration
- the acceptance-heavy tier remains separated under dedicated scripts because it is materially slower

Likely next step:
- decide whether the acceptance-heavy tier needs more decomposition or should remain as the slow final confidence gate

### 2. Deprecated / compatibility code decisions

Resolved in the wrap-up pass:
- `packages/engine/src/skills/targeting.ts`
  - retired; `SpatialSystem.getAxialTargets` is the live replacement
- `packages/engine/src/systems/movement/movement.ts`
  - retired as a deprecated module after confirming no live imports remained
  - kinetic behavior remains owned by `systems/movement/kinetic-kernel.ts` and `systems/movement/hex-bridge.ts`

### 3. Doc and archive hygiene

Still pending:
- move completed milestone docs from `docs/` root into `docs/archive/`
- normalize remaining live references to archived docs and generated artifact locations
- keep `docs/STATUS.md` as the only current-law runtime document and label `docs/NEXT_LEVEL.md` as historical only

### 4. Runtime logging policy

Still pending:
- add scoped `no-console` lint coverage for runtime source
- remove or gate any remaining runtime `console` usage after the movement bridge cleanup

## Reclassified / Corrected Assessment Notes

- The earlier scenario/targeting failure cluster is no longer active; those gates are green.
- `checkRngParity.ts` no longer has the previously noted `any` casts.
- The duplicate `.js` RNG parity implementation has been removed.
- The temporary UPA health artifact and zero-byte skill result files have been removed.
- Live UPA health/calibration commands now point at `artifacts/upa/...` rather than `docs/...`.

## Recommended Next Sprint

1. Finish doc/archive cleanup and keep living references aligned with the new archive layout.
2. Continue doc/archive cleanup now that the fast engine loop is stable.
3. Remove or isolate remaining legacy/deprecated runtime code with tests guarding intended compatibility behavior.
4. Add scoped lint protection for runtime `console` usage.
