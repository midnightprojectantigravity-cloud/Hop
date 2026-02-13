# Turn Stack Audit Guide

## Purpose
`runTurnStackAudit.ts` validates turn-loop invariants across seeds and archetypes, then writes a structured diagnostics artifact.

It checks:
- timeline phase order monotonicity per actor step,
- missing `stepId` on actor timeline events,
- queue advance while intercept/pending is active,
- pending stack drain behavior on `RESOLVE_PENDING`,
- blocking-duration outliers per actor step,
- engine turn-stack warnings (`[TURN_STACK] ...`).

## Commands
- Baseline audit:
`npm run mvp:turn-stack:audit`
- Strict gate (fails on any violation):
`npm run mvp:turn-stack:audit:strict`
- Custom run:
`npx tsx packages/engine/scripts/runTurnStackAudit.ts <runsPerArchetype> <maxTurns> <outFile> <maxBlockingMsPerStep> <strict0or1> [LOADOUTS_CSV] [maxReducerSteps]`

Example:
`npx tsx packages/engine/scripts/runTurnStackAudit.ts 6 60 artifacts/upa/UPA_TURN_STACK_AUDIT_DEV.json 3000 0 VANGUARD,FIREMAGE 5000`

## Output
Default output:
`artifacts/upa/UPA_TURN_STACK_AUDIT.json`

Top-level sections:
- `summary`: aggregate metrics and violation breakdown.
- `runs[]`: per-seed diagnostics:
  - `reducerSteps`,
  - `actorSteps`,
  - `avgBlockingMsPerStep`,
  - `maxBlockingMsPerStep`,
  - `turnStackWarnings`,
  - `violations`.
- `violations[]`: every invariant breach with seed, turn, reducer step, and detail.

## Violation Types
- `phase_order`
- `missing_step_id`
- `pending_advance`
- `pending_stall`
- `lock_duration`
- `turn_stack_warning`

## CI/Gate Usage
- `mvp:gate` includes `mvp:turn-stack:audit:strict`.
- Any non-zero violation count in strict mode exits with code `2`.
