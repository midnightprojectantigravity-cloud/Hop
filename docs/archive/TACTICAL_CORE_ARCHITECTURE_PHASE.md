# Tactical Core Architecture Phase (Authoritative)

## Purpose
Freeze the implementation contract for the "Foundation Refactor - Tactical Core" PR so all engine and UI work ship against one source of truth.

This document is the authoritative scope and acceptance criteria for this PR.

## MVP Boundaries (Frozen)

1. Grid math
- Full cube/axial contract (`q/r/s`) across targeting, movement, physics, and preview.
- No alternate coordinate formats introduced in engine runtime.

2. RNG determinism
- All random rolls are derived from engine RNG (`rngSeed` + `rngCounter`).
- Unit stat instantiation must be reproducible from seed + draw order.
- No `Math.random` in engine logic paths.

3. Stat propensity layer
- Runtime unit stats are instantiated from data-defined propensity distributions.
- Instantiation is deterministic and logged as needed for replay/debug.
- Entity creation still routes through `EntityFactory`.

4. Resolution stack
- Engine resolves queued items in strict LIFO order.
- Reactions are automated only (no player priority windows in MVP).
- Stack resolution emits per-tick traceable events for debug/replay.

5. Physics engine
- MVP supports push/pull and collision-to-crush conversion only.
- Catch/attach/release mechanics are explicitly out of scope for this PR.
- All movement side effects continue to respect tile `onPass`/`onEnter`.

6. Composite skill model
- Skill runtime supports `BaseAction + Upgrades[]` composition.
- Effects are atomic and data-driven.
- Inhibit/silence is implemented through tag-based effect filtering.

7. UI/engine sync
- Engine is source of truth for outcomes.
- UI consumes emitted simulation events (`UnitMoved`, `DamageTaken`, etc.).
- Action preview uses engine dry-run and does not mutate live state.

## Non-MVP / Explicitly Deferred

- Catch/carry/release attached-vector interactions.
- Player priority/counter-window stack interaction model.
- New balance systems outside deterministic simulation and telemetry.
- Broad content migrations beyond representative skills needed to validate architecture.

## Compatibility Contract

- Legacy skill/runtime behavior must remain functional during migration.
- Data-driven path can coexist with existing `SkillDefinition` path until migration completes.
- Existing scenario harness and replay validation must remain green.

## Acceptance Criteria

1. Determinism
- Same seed + same input action log => identical state fingerprints and event traces.

2. Stack sequencing
- LIFO behavior is verifiable in tests with intermediate tick snapshots.

3. Physics correctness
- Push/pull collisions produce deterministic displacement or crush outcomes.
- Tile hooks are applied consistently during forced movement.

4. Skill composition
- At least one representative composite skill executes entirely data-driven with upgrade modifiers and inhibit filtering.

5. Preview parity
- Dry-run preview output matches committed execution outcome for identical input.

6. UI sync
- State mirror test confirms UI position tracking matches engine positions at stack boundaries.

## Required Validation Gates

- `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts`
- `npx vitest run packages/engine/src/__tests__/balance_harness.test.ts`
- `npx tsx packages/engine/scripts/validateReplay.ts`

## Implementation Order

1. Data parser/validator
2. Deterministic propensity instantiation
3. LIFO stack runtime
4. Vectorized push/pull + collision/crush
5. Composite skill factory + inhibit
6. Legacy bridge + migration path
7. Event bus + preview + mirror validation
8. Full regression + docs closeout

## Current PR Status

- [x] Data parser/validator
- [x] Deterministic propensity instantiation
- [x] LIFO stack runtime
- [x] Vectorized push/pull + collision/crush
- [x] Composite skill factory + inhibit
- [x] Legacy bridge + migration path
- [x] Event bus + preview + mirror validation
- [x] Regression pass + docs update
