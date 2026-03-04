# Codebase Status - March 3, 2026

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

## Latest Balance Milestone
UPA multi-archetype success tuning is complete and strict-gated.

Delivered outcomes:
1. Deterministic policy/intent/selector tuning for weak archetypes.
2. Targeted trinity and skill-constant adjustments with no-regress gate checks.
3. Automated baseline/candidate/gate scripts and artifact workflow.
4. Strict-suite-aligned baseline fixture updates (golden + regression envelopes).

Reference:
- `docs/UPA_SUCCESS_TUNING.md`

## Capability Rollout Milestone
Capability rollout completion is merged and validated with staged production safety.

Delivered outcomes:
1. Engine ruleset control plane finalized for capability passives and movement runtime toggles.
2. Movement capability passive content shipped (`FLIGHT`, `PHASE_STEP`, `BURROW`) with deterministic loadout mapping.
3. Web rollout bridge finalized (hub + URL + env precedence) with compatibility-safe intel reveal defaults.
4. Full engine/web suites and parity/fallback gates validated at merge.
5. Non-prod defaults enabled (`development`), production defaults retained off (`production`) for staged promotion.

Reference:
- `docs/CAPABILITY_ROLLOUT.md`
- `docs/NEXT_LEVEL.md` (Deferred Backlog `D4`)

## Replay V3 + Stability Milestone
Replay contract migration and deterministic runtime hardening are merged and validated.

Delivered outcomes:
1. Replay contract migration:
   - canonical `ReplayEnvelopeV3` adopted across engine/web/server
   - legacy replay payload acceptance removed from runtime validation paths
   - reducer replay logging restricted to in-run recordable actions only
2. Server verification hardening:
   - strict v3 schema + action/payload validation
   - fingerprint match required for submissions
   - server-computed score/floor persisted as authoritative values
3. Engine correctness + determinism hardening:
   - pure load hydration (no input mutation)
   - turn loop state updates kept immutable
   - centralized tactical target validation with deterministic failure paths
4. Hotspot optimization with parity safety:
   - tile tick processing reduced from tile x actor scans while preserving ordering semantics
   - repeated actor lookups in turn loop reduced via per-iteration index map
5. Repo hygiene:
   - tracked `%TEMP%/hop_upa_baseline_worktree` mirror removed
   - `%TEMP%/` ignored to prevent duplicate test discovery

Reference:
- `docs/REPLAY_V3_STABILITY_WRAPUP_2026-03-03.md`

## UI/UX Great Refactor Milestone
Mobile-first parchment productization for web UI is merged and validated.

Delivered outcomes:
1. Theme and preferences foundation:
   - tokenized parchment-first light theme with secondary medieval-apocalypse dark theme
   - canonical `UiPreferencesV1` with persisted `colorMode`, `motionMode`, `hudDensity`, and `mobileLayout`
2. Core flow overhaul priority delivered:
   - Hub two-tap start journey
   - portrait one-handed in-run HUD with bottom action dock
   - defeat/replay loop with `Quick Restart` and `View Replay`
3. Quick restart and context persistence:
   - `RunResumeContext` persisted for normal/daily restart routing
   - Hub bypass on defeat restart with mode-correct seed/date handling
4. Synapse and layout integration:
   - synapse tray shares bottom interaction footprint with skills tray on mobile
   - desktop command-center panes remain always visible
5. Web shell performance hardening:
   - route-level lazy screen modules + idle-time prefetch
   - manual chunk splitting to remove monolithic app bundle shape
6. Regression coverage:
   - UI preference persistence
   - run-resume context and quick restart routing
   - hub start CTA wiring
   - run lost overlay action wiring
   - layout breakpoint contract tests
   - replay control overlay placement contract

Reference:
- `docs/UI_UX_GREAT_REFACTOR_WRAPUP_2026-03-03.md`

## Validation Snapshot (Current)

Engine:
- `npm --workspace @hop/engine run build` -> pass
- `npm --workspace @hop/engine test` -> pass
- `npm --workspace @hop/engine run bench:runtime:candidate` -> pass (5% regression gate)

Web:
- `npm --workspace @hop/web run test:run` -> pass
- `npm --workspace @hop/web run build` -> pass

Server:
- `npm --workspace @hop/server run test` -> pass

## Current Risk Posture

1. No known blocking regressions in the strict AI acceptance gate.
2. Determinism/parity checks are active and should remain mandatory for AI-affecting and content-spawn-affecting PRs.
3. Deprecated constants (`ENEMY_STATS`, `FLOOR_ENEMY_*`) are retired from source ownership and blocked by static checks; runtime ownership remains catalog/profile-backed.
4. Diagnostics (`oracle/shadow` diff scripts/tests) are retained for investigation workflows.

## Next Documentation Focus

1. Keep architecture references aligned with grouped system directories (`ai`, `evaluation`, `combat`, `entities`, `tiles`).
2. Keep completed implementation plans under `docs/archive/`; keep only living trackers and runbooks at `docs/` root.
3. Keep generated/audit artifacts in `artifacts/upa/`; keep stable references in `docs/`.
