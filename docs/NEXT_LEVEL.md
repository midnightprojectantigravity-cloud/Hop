# NEXT_LEVEL Active Tracker

## Status

As of March 27, 2026:

- Trinity v2 and IRES are fully integrated live runtime.
- ACAE is merged into the live path.
- Shared-vector carry, loadout passive capability content, and movement capability runtime are live-only behavior.
- Worldgen worker transport is artifact-only and integrated.
- Shared AI now runs on behavior overlays plus Spark doctrine.

Current repo law is documented in `docs/STATUS.md`.

## Operating Mode

- Determinism and replay parity remain non-negotiable.
- Default work should improve or harden the live runtime, not preserve retired rollout postures.
- New gameplay systems should land only as explicit, test-backed tranches.
- Active balance/tuning intake remains tracked in `docs/BALANCE_BACKLOG.md`.

## Current Priorities

### P1. Shared AI tuning and observability

Goal: improve live tactical pressure, Spark pacing, and evaluation visibility on the shared AI stack.

- [ ] Reduce visible-hostile idle behavior without reintroducing crash-spend pacing.
- [ ] Continue tightening Spark doctrine weights around rested/stable preservation versus productive aggression.
- [ ] Keep behavior-overlay telemetry and review tooling understandable during tuning.

Acceptance:

- [ ] `npm run upa:quick:ai` remains explainable and stable enough for iterative tuning.
- [ ] Runtime and harness selectors remain on the same shared decision core.

### P2. Documentation and runtime hygiene

Goal: keep current-law docs and runtime contracts aligned after the live-only cleanup.

- [ ] Keep `docs/STATUS.md` aligned with the actual runtime contract.
- [ ] Keep retired rollout guidance in `docs/archive/` only.
- [ ] Continue pruning stale compatibility code after load-time normalization windows expire.

Acceptance:

- [ ] Live source/docs stay free of retired rollout instructions.
- [ ] Historical docs remain clearly marked as historical snapshots.

### P3. Evaluation and performance maintenance

Goal: keep shared evaluation infrastructure fast, readable, and stable.

- [ ] Keep harness telemetry aligned with live AI doctrine.
- [ ] Keep review scripts readable for balance/tuning work.
- [ ] Watch worker/runtime performance after AI telemetry growth.

Acceptance:

- [ ] `npm --workspace @hop/engine run test:full` passes.
- [ ] `npm --workspace @hop/web run test:run` passes.
- [ ] `npm run engine:fast` stays practical as the default repair loop.

## Merge Gate

```powershell
npm run build
npm --workspace @hop/engine run test:full
npm --workspace @hop/web run test:run
npm run engine:fast
npm run upa:quick:ai
```

## History and Archives

- Historical roadmap log: `docs/ROADMAP_HISTORY.md`
- Archived milestone and rollout documents: `docs/archive/`
