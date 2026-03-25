# Replay V3 Stability Wrap-Up (March 3, 2026)

## Scope Closed
Single-PR refactor/optimization plan completed across:
1. Engine replay contract + deterministic runtime
2. Web replay recording/playback contract
3. Server submission verification path
4. Runtime benchmark harness + gate
5. Repo hygiene affecting test/runtime behavior

## Contract Outcomes
1. Replay envelope is now strict `version: 3` (`ReplayEnvelopeV3`) across engine/web/server.
2. Replay logging excludes lifecycle actions and captures replay-recordable in-run actions only.
3. Web persistence moved to v3-only storage keys:
   - `hop_replays_v3`
   - `hop_leaderboard_v3`
4. Server `/submit` validation is strict v3 with mandatory fingerprint match.
5. Server persists authoritative computed `score`/`floor` (client values are non-authoritative).

## Runtime/Determinism Outcomes
1. Load hydration now returns fresh hydrated state without mutating loaded input.
2. Turn-loop occupancy updates remain immutable.
3. Tactical target validity is centralized with deterministic failure behavior:
   - invalid player intent: fail/no turn consumption
   - invalid enemy intent: deterministic wait-consume behavior
4. Self-pattern skills with empty explicit target sets are supported via self-target fallback.
5. `GRAPPLE_HOOK` targeting now preserves both:
   - enemy hazard-avoidance behavior
   - player wall/hazard zip scenario semantics

## Optimization Outcomes
1. `tickTileEffects` optimization shipped with ordering parity preserved (tile-first semantics retained).
2. Turn-loop repeated actor lookups reduced via per-iteration actor index map.
3. Benchmark gate is active and passing with current candidate artifact.

## Hygiene Outcomes
1. `%TEMP%/hop_upa_baseline_worktree` tracked mirror removed from git history tip.
2. `%TEMP%/` ignore rule added to avoid duplicate discovery noise.
3. Root architecture references align with live docs and monorepo paths.

## Validation Snapshot
1. `npm run build` -> pass
2. `npm --workspace @hop/web run test:run` -> pass
3. `npm --workspace @hop/server run test` -> pass
4. `npm --workspace @hop/engine test` -> pass
5. `npm --workspace @hop/engine run bench:runtime:candidate` -> pass (5% regression gate)

## Known Intentional Breaks
1. Legacy replay/save compatibility is intentionally removed (v3-only path).
2. No legacy adapter is included by design.

## Follow-Up Guardrails
1. Any future targeting validation changes must preserve parity between:
   - `getValidTargets`
   - `execute` acceptance semantics
2. Any tile processing optimization must maintain deterministic event ordering before merge.
3. Replay/server contracts should be version-bumped explicitly for any future payload shape changes.
