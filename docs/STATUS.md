# Codebase Review - February 8, 2026

## Scope
- Full-engine review pass focused on deterministic contracts, regression risk, and milestone/doc alignment.
- Validation included:
  - `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts --silent`
  - `npx vitest run packages/engine/src/__tests__/daily_run.test.ts packages/engine/src/__tests__/balance_harness.test.ts packages/engine/src/__tests__/upa.test.ts --silent`
  - `npx vitest run --silent`

## Test Health Snapshot
- `scenarios_runner`: pass (`60 passed / 0 failed`)
- New Phase 3/4 tests: pass
  - `packages/engine/src/__tests__/daily_run.test.ts`
  - `packages/engine/src/__tests__/balance_harness.test.ts`
  - `packages/engine/src/__tests__/upa.test.ts`
- Full suite: **not green**
  - Failing: `packages/engine/src/__tests__/agency_swap.test.ts`
  - Failure point: replay parity assertion mismatch (`turnNumber` divergence)

## Findings (Ordered by Severity)

1. High - Full-suite determinism regression in agency replay parity
- Symptom: `agency_swap.test.ts` fails (`state2.turnNumber !== state1.turnNumber`).
- Impact: replay/ghost parity contract is currently not guaranteed at suite level.
- Reference: `packages/engine/src/__tests__/agency_swap.test.ts:109`
- Recommendation: triage before release if full-suite green is required; isolate whether intent capture/replay no longer matches post-Phase updates.

2. Medium - Milestone acceptance mismatch for objective scoring impact
- Current state: turn-limit objective pass/fail boundaries are tested, but objective results are not yet wired into score computation.
- Reference:
  - objective evaluation only: `packages/engine/src/systems/run-objectives.ts`
  - score remains independent: `packages/engine/src/systems/score.ts`
- Action taken: `docs/NEXT_LEVEL.md` updated to uncheck the “scoring impact” part of `P3.PR2` acceptance.

3. Medium - Runtime mode default changed to daily-only start path in web app
- Current behavior: `START_RUN` dispatch from UI always passes `mode: 'daily'`.
- Reference: `apps/web/src/App.tsx:352`, `apps/web/src/App.tsx:361`
- Impact: normal/non-daily run entry path is no longer reachable from current UI flow.
- Recommendation: confirm this is intentional; if not, add explicit mode selection in Hub.

4. Low - Status typing drift remains in actor status API
- Current state: engine applies statuses beyond the strict `addStatus` signature and relies on casts.
- Reference:
  - narrow signature: `packages/engine/src/systems/actor.ts`
  - broader runtime status IDs: `packages/engine/src/types/registry.ts`
- Recommendation: widen `addStatus` type to `StatusID` to reduce future type-safety regressions.

## Documentation Alignment Updates Made
- Updated `docs/NEXT_LEVEL.md`:
  - kept milestone progress history intact.
  - corrected `P3.PR2` acceptance check to reflect implementation reality.

## Recommended Next Actions
1. Fix `agency_swap.test.ts` parity regression and re-run full suite.
2. Decide whether objective outcomes should modify score; if yes, update `computeScore` + tests + checklist.
3. Confirm intended run-mode UX (daily-only vs selectable).
