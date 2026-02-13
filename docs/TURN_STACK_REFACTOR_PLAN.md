# Turn Stack Refactor Plan

## Objective
Refactor engine + web turn orchestration to fully conform to `docs/TURN_STACK_CONTRACT.md`.

## Why This Refactor Is Needed
Current behavior has known drift points:
- queue can advance while pending intercept state exists,
- telegraph resolution is duplicated in one actor cycle,
- playback/lock logic is distributed and can desync under load,
- replay accepts filtered action sets with silent drops.

## Delivery Strategy
One PR slice at a time, each with deterministic acceptance tests.

## Progress
- [x] PR1 - Engine Guard Rails
- [x] PR2 - Engine Step Envelope
- [x] PR3 - Web Turn Driver State Machine
- [x] PR4 - Intercept Stack Formalization
- [x] PR5 - Replay Hardening
- [x] PR6 - Observability and Audit Tooling

## Completion Snapshot
- `npm run build` passes for engine + web.
- `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts packages/engine/src/__tests__/turn_stack_guards.test.ts packages/engine/src/__tests__/replay_validation.test.ts apps/web/src/__tests__/turn_driver.test.ts apps/web/src/__tests__/replay.test.ts` passes.
- `npm run mvp:turn-stack:audit:strict` passes with `totalViolations: 0`.
- Turn stack audit documentation: `docs/TURN_STACK_AUDIT.md`.

---

## PR1 - Engine Guard Rails (Must Land First)
### Scope
- Add hard gate in reducer: ignore/reject `ADVANCE_TURN` while `pendingStatus` exists.
- Allow only `RESOLVE_PENDING` to clear pending state.
- Remove duplicate telegraph resolution call from actor loop.
- Add invariant logging for illegal queue advance attempts.

### Acceptance Tests
- New engine test: `ADVANCE_TURN` during pending does not mutate initiative/turn.
- Existing timeline/scenario tests remain green.
- No duplicate telegraph damage/messages in targeted scenario.

### Exit Criteria
- Pending states are queue-blocking by contract.

---

## PR2 - Engine Step Envelope
### Scope
- Introduce explicit actor-step envelope metadata:
  - `stepId`,
  - `actorId`,
  - phase ordering constraints.
- Ensure timeline events emitted by effects are attached to current actor step.
- Enforce deterministic phase order at emission time.

### Acceptance Tests
- New test: all phases in one actor step are monotonic and ordered.
- New test: no cross-actor phase interleaving in a single dispatch cycle.

### Exit Criteria
- Engine timeline is a reliable playback source of truth.

---

## PR3 - Web Turn Driver State Machine
### Scope
- Centralize turn lock/unlock and queue progression in one state machine hook/module.
- Replace ad hoc interval/lock interactions with explicit transitions:
  - `INPUT_OPEN -> COMMIT -> RESOLVE -> PLAYBACK -> INTERCEPT -> HANDOFF`.
- Keep a deterministic `busy` source (`timeline + visual + pending`), not scattered booleans.

### Acceptance Tests
- New web test: player input relocks immediately on commit and never unlocks before playback complete.
- New web test: no permanent lock when queue resolves normally.
- New web test: queue progresses actor-by-actor (not by frame race).

### Exit Criteria
- Single source of truth for `canPlayerInput`.

---

## PR4 - Intercept Stack Formalization
### Scope
- Add explicit intercept queue/frame handling for:
  - stairs transition,
  - shrine choice,
  - win/loss.
- Block queue shift until intercept frames are drained.
- Ensure UI animates move completion before intercept UI/transition.

### Acceptance Tests
- New scenario/web integration: stepping on stairs waits for movement playback before transition.
- New scenario/web integration: shrine triggers after movement completion, before next actor handoff.
- New test: no `ADVANCE_TURN` while intercept queue non-empty.

### Exit Criteria
- Post-action hooks behave as deterministic blocking stack frames.

---

## PR5 - Replay Hardening
### Scope
- Replace local replay action allowlist with shared action validation contract.
- Disallow silent action drops; surface explicit replay validation errors.
- Ensure replay timeline follows same turn driver as live run.

### Acceptance Tests
- Replay roundtrip parity test with mixed actions (including pending resolution cases).
- Replay rejects unsupported actions with explicit error.
- Existing replay tests remain green.

### Exit Criteria
- Replay path equals live path semantics.

---

## PR6 - Observability and Audit Tooling
### Scope
- Add structured turn-cycle diagnostics artifact per run:
  - step count,
  - phase ordering violations,
  - pending/advance violations,
  - lock duration anomalies.
- Add automated audit script over multiple seeds/archetypes.
- Add docs for reading diagnostics.

### Acceptance Tests
- Audit script returns zero violations on baseline seeds.
- CI check can fail on invariant breach classes.

### Exit Criteria
- Turn-loop correctness is measurable, not inferred.

---

## Validation Gate (Before Runtime Refactor Starts)
Must be explicitly validated by product/design:
1. Confirm strict blocking semantics are desired for all intercepts.
2. Confirm no reactive response window is needed.
3. Confirm replay should fail loudly on invalid actions (no silent salvage).
4. Confirm initiative visualization should advance only on actor-step completion.

After validation, implementation proceeds in PR1 -> PR6 order.
