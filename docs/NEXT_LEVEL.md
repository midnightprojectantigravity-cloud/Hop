# NEXT_LEVEL Milestone Checklist

## Debt Triage Snapshot (February 8, 2026)

### Priority 1 - Critical Regressions
- [x] **Fix Agency Parity Regression** (`packages/engine/src/__tests__/agency_swap.test.ts`)
  - Acceptance:
    - [x] `npx vitest run packages/engine/src/__tests__/agency_swap.test.ts --silent` passes.
    - [x] Ghost replay intent queue initializes from recorded intents and consumes actor-matched intents deterministically (`packages/engine/src/strategy/ghost.ts`).
- [x] **Widen `addStatus` Signature** (`packages/engine/src/systems/actor.ts`)
  - Acceptance:
    - [x] `addStatus` now accepts `StatusID` from registry types.
    - [x] TypeScript build remains green after signature change.
- [x] **Restore Run Mode Selection** (`apps/web/src/App.tsx`, `apps/web/src/components/Hub.tsx`)
  - Acceptance:
    - [x] Hub can start a normal run and a daily run explicitly (`onStartRun('normal' | 'daily')`).
    - [x] `START_RUN` dispatch receives selected mode.

### Priority 2 - ECS Lite Consistency Review (against `docs/ECS_REFACTOR_PLAN.md`)
- [x] **Entity Factory Coverage**
  - Acceptance:
    - [x] `createPlayer` and `createEnemy` exist in `packages/engine/src/systems/entity-factory.ts`.
    - [x] `createCompanion` abstraction exists (`packages/engine/src/systems/entity-factory.ts`).
- [x] **Unify Stats/Loadouts**
  - Acceptance:
    - [x] Enemy creation in map flow uses factory + skill loadouts (`packages/engine/src/systems/map.ts`).
    - [x] Falcon and companion mode transitions are represented through loadout + skill effects (including `FALCON_AUTO_ROOST`) without logic-loop special casing.
- [x] **Falcon Refactor Completion**
  - Acceptance:
    - [x] Remove falcon-specific turn branch from combat loop (`packages/engine/src/systems/combat.ts`).
    - [x] Drive falcon behavior through generic skill execution pipeline only.
- [x] **Skill Injection Everywhere**
  - Acceptance:
    - [x] Main runtime entity creation uses factory loadouts.
    - [x] Scenario helper enemy/companion spawning uses factory creation (`packages/engine/src/skillTests.ts`).
    - [x] Tutorial/test helper paths standardized to factory creation + `buildSkillLoadout()` usage.

### Priority 3 - Arcade Loop Polish
- [x] **Objective-Score Wiring**
  - Acceptance:
    - [x] `run-objectives` computes objective outcomes for run summary.
    - [x] `computeScore` in `packages/engine/src/systems/score.ts` includes objective contribution.
- [x] **Objective Scenario Pass (Turn Limit boundaries)**
  - Acceptance:
    - [x] Boundary scenario exists in `packages/engine/src/scenarios/objectives.ts`.

### Priority 4 - Design/Balance Continuation
- [x] **Bot Strategy Tuning**
  - Acceptance:
    - [x] Heuristic bot improvements validated by harness deltas (`packages/engine/src/__tests__/balance_harness.test.ts`).
- [x] **UPA Outlier Analysis (1000+ sims)**
  - Acceptance:
    - [x] Ran and documented 1000 deterministic simulation outcomes (`docs/UPA_OUTLIER_REPORT_2026-02-08.json`).
  - Snapshot:
    - `random`: `944 lost / 56 timeout`, `avgHazardBreaches=0.944`, `UPA=0.4811`.
    - `heuristic`: `81 lost / 919 timeout`, `avgHazardBreaches=0.019`, `UPA=0.4996`.

## Baseline (as of February 7, 2026)
- [x] `scenarios_runner` baseline captured: `31 passed / 11 failed`.
- [x] High-risk regression list confirmed in code and tests:
  - `packages/engine/src/logic.ts` (`MOVE` routing/flow regressions)
  - `packages/engine/src/skills/falcon_command.ts` (`state.player.id` crash path)
  - `packages/engine/src/skills/spear_throw.ts` + `packages/engine/src/scenarios/spear_throw.ts` (contract mismatch)
  - `packages/engine/src/scenarios/absorb_fire.ts` + `packages/engine/src/systems/validation.ts` (hazard pass/land mismatch)
  - `packages/engine/src/scenarios/jump.ts` (stun/event expectation drift)

### Progress Snapshot (February 7, 2026)
- `scenarios_runner` current state: `60 passed / 0 failed`.
- Phase 0 stabilization fixes landed across `logic.ts`, `falcon_command.ts`, `spear_throw` scenarios, hazard movement behavior, and scenario harness loadouts.
- Added targeted regression scenarios for move-intent validation and turn-integrity checks in `packages/engine/src/scenarios/basic_move.ts`.
- Added remapped-player null-safety scenario for Falcon command in `packages/engine/src/scenarios/falcon_command.ts`.
- Added deterministic telegraph projection output on `GameState.intentPreview` with scenario coverage in `packages/engine/src/scenarios/telegraph_projection.ts`.
- Added one data-driven boss playlist (`SENTINEL_TELEGRAPH` -> `SENTINEL_BLAST`) with timing and interruption scenarios in `packages/engine/src/scenarios/sentinel_blast.ts`.
- Added `raider` archetype reuse slice (enemy `DASH` loadout + AI + intent mapping) with parity scenarios in `packages/engine/src/scenarios/raider_dash.ts`.
- Added `pouncer` archetype reuse slice (enemy `GRAPPLE_HOOK` loadout + AI + intent mapping) with deterministic scenario coverage in `packages/engine/src/scenarios/pouncer_hook.ts`.
- Added `ice` terrain scenarios for pass-through momentum and landing slide behavior in `packages/engine/src/scenarios/ice.ts`.
- Added `snare` terrain effect with movement interruption/rooting behavior and scenario coverage in `packages/engine/src/scenarios/snare.ts`.
- Added three passive relic slices (`RELIC_EMBER_WARD`, `RELIC_CINDER_ORB`, `RELIC_STEADY_PLATES`) with scenario coverage in `packages/engine/src/scenarios/relics.ts`.
- Added daily-run seed/objective plumbing and run summary payload (`packages/engine/src/systems/run-objectives.ts`) with test coverage in `packages/engine/src/__tests__/daily_run.test.ts` and scenario coverage in `packages/engine/src/scenarios/objectives.ts`.
- Added deterministic balance harness (`packages/engine/src/systems/balance-harness.ts`) plus script entrypoint (`packages/engine/scripts/runBalanceHarness.ts`) and UPA telemetry module (`packages/engine/src/systems/upa.ts`) with tests.

### Progress Snapshot (February 8, 2026)
- Removed remaining falcon turn special-case orchestration from `processNextTurn`; predator fallback now resolves through `FALCON_AUTO_ROOST` skill execution.
- Added `createCompanion` + `buildSkillLoadout` in `packages/engine/src/systems/entity-factory.ts` and standardized scenario helper actor creation to factories.
- Extended objective scenario coverage to include score-impact validation for turn-limit failures in `packages/engine/src/scenarios/objectives.ts`.
- Tuned heuristic bot pathing in `packages/engine/src/systems/balance-harness.ts` (hazard-aware movement + stair-seeking fallback).
- Added 1000-run deterministic outlier analysis artifact: `docs/UPA_OUTLIER_REPORT_2026-02-08.json`.
- Firemage heuristic switched to one-ply utility simulation in `packages/engine/src/systems/balance-harness.ts` with explicit stairs/floor progress rewards and `WAIT` penalty.
- Firemage harness delta on fixed 200-seed sample (`maxTurns=100`):
  - Before utility score fix: `winRate=0`, `timeoutRate=1.0`, `avgFloor=1.0`.
  - After utility score fix: `winRate=0.09`, `timeoutRate=0.355`, `avgFloor=6.53`.
- Message-log audit sample (`80` seeds, `maxTurns=80`) now shows no player no-op spam:
  - `playerZeroEffects=0`
  - Player intent mix includes `FIREBALL`, `FIREWALL`, and `FIREWALK` (not only `BASIC_ATTACK`).

---

## Phase 0 - Stability Gate (Release Blocker)
Goal: restore core tactical contract and trust in scenario tests before feature work.

### P0.PR1 - `falcon_command` null-safe actor resolution
- Scope:
  - [x] Remove unsafe `state.player.id` dependency in non-player scenario contexts.
  - [x] Make name/description resolution null-safe for harness-owned actors.
- Acceptance tests:
  - [x] `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts` no longer throws runtime reference/type errors tied to `falcon_command`.
  - [x] Add/adjust a targeted scenario test proving `falcon_command` works when player actor is absent or remapped.
- Done when:
  - [x] No crash path remains from `falcon_command` under scenario harness execution.

### P0.PR2 - Reconcile `MOVE` intent routing with passive skill scanning
- Scope:
  - [x] Restore expected movement action flow for `MOVE` without breaking passive valid-target checks.
  - [x] Preserve `BASIC_MOVE` behavior/log contracts.
  - [x] Ensure legal move intents do not silently die between AI intent and execution.
- Acceptance tests:
  - [x] `BASIC_MOVE` scenarios pass with expected logs/events.
  - [x] Add/adjust regression scenario: legal `MOVE` intent generated by AI executes successfully.
  - [x] Add/adjust regression scenario: invalid move intent is rejected at validation (not execution crash).
- Done when:
  - [x] No "intent succeeded in AI, failed in execution" for legal movement targets.

### P0.PR3 - Lock Spear contract and align skill + scenarios
- Decision (must be explicit in PR description):
  - [x] Choose one contract and freeze it:
    - `enemy-only axial + LoS` (selected)
    - `allow miss/ground throw`.
- Scope:
  - [x] Align `packages/engine/src/skills/spear_throw.ts` to chosen contract.
  - [x] Align `packages/engine/src/scenarios/spear_throw.ts` to same contract.
  - [x] Remove contradictory expectations (wall/miss/enemy-only conflict).
- Acceptance tests:
  - [x] Scenario coverage includes at least: clear LoS hit, blocked LoS, non-enemy target behavior.
  - [x] No test asserts behavior outside the chosen contract.
- Done when:
  - [x] Spear targeting/execution behavior is single-source-of-truth across skill + scenarios.

### P0.PR4 - Hazard pass/land consistency across movement skills
- Scope:
  - [x] Normalize hazard policy for `BASIC_MOVE`, `JUMP`, `VAULT`, `DASH`, `GRAPPLE_HOOK`, `ABSORB_FIRE`.
  - [x] Ensure pass-through and landing checks match `TileResolver` + validation contracts.
- Acceptance tests:
  - [x] Add/adjust scenario matrix covering pass-vs-land outcomes for each movement type.
  - [x] `absorb_fire` scenario expectations match enforced hazard policy.
  - [x] No movement skill bypasses required `onPass`/`onEnter` hooks.
- Done when:
  - [x] Hazard outcomes are deterministic and consistent regardless of movement source.

### P0.PR5 - Turn integrity and no-op loop guards
- Scope:
  - [x] Verify occupancy mask refresh timing at execution-phase start.
  - [x] Prevent extra actor actions per turn from loop/routing regressions.
  - [x] Reject invalid zero-effect loops for legal intents unless explicitly allowed as no-op.
- Acceptance tests:
  - [x] Add/adjust scenario asserting exactly one action resolution per actor per turn under normal flow.
  - [x] Add/adjust scenario asserting legal intents produce meaningful effects or explicit, validated no-op events.
- Done when:
  - [x] Turn loop contract is stable with no accidental action duplication.

### Phase 0 Exit Criteria
- [x] `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts` is fully green.
- [x] No runtime reference errors in scenario harness execution.
- [x] No AI-valid intent fails execution for legal targets.

---

## Phase 1 - Combat Readability Gate
Goal: improve decision clarity with deterministic previews, minimal scope increase.

### P1.PR1 - Deterministic telegraph projection output
- Scope:
  - [x] Add intent preview output for next-turn danger tiles.
  - [x] Keep projection deterministic and replay-safe.
- Acceptance tests:
  - [x] Scenario proving projection tiles are deterministic for fixed seed/state.
  - [x] Scenario proving projection mirrors actual execute turn footprint.
- Done when:
  - [x] Engine emits stable telegraph projection consumable by UI.

### P1.PR2 - Boss skill playlist (2-turn telegraph -> execute)
- Scope:
  - [x] Implement one boss behavior as skill-definition playlist, no hardcoded AI branch tree.
  - [x] Turn 1 telegraph, turn 2 execute via same skill pipeline.
- Acceptance tests:
  - [x] Scenario verifies exact two-turn pattern timing.
  - [x] Scenario verifies interruption/cancel rules.
- Done when:
  - [x] Boss flow is data-driven through skills and fully scenario-covered.

### Phase 1 Exit Criteria
- [x] Player-visible next-turn danger tiles are available via deterministic projection.
- [x] Boss playlist behavior is scenario-tested end-to-end.

---

## Phase 2 - Content Through Reuse (Parity-First)
Goal: add challenge by recombining existing mechanics only.

### P2.PR1 - Enemy archetype A using existing player skills
- Scope:
  - [x] Add enemy loadout using only existing player skills.
  - [x] No new core combat subsystem.
- Acceptance tests:
  - [x] Scenario verifies targeting + execution parity against player-owned version of same skill.

### P2.PR2 - Enemy archetype B using existing player skills
- Scope:
  - [x] Add second enemy archetype with distinct tactical role via loadout/AI config only.
- Acceptance tests:
  - [x] Scenario verifies deterministic behavior and no special-case engine path.

### P2.PR3 - Terrain pack: `ice` trait
- Scope:
  - [x] Add `ice` tile trait/effects via existing tile systems.
- Acceptance tests:
  - [x] Scenario covers pass behavior.
  - [x] Scenario covers land behavior.

### P2.PR4 - Terrain pack: `snare` trait
- Scope:
  - [x] Add `snare` tile trait/effects via existing tile systems.
- Acceptance tests:
  - [x] Scenario covers movement restriction/interaction rules.

### P2.PR5 - Relic 1 (passive-only)
- Scope:
  - [x] Add passive relic with no new subsystem.
- Acceptance tests:
  - [x] Scenario validates trigger conditions and deterministic effect output.

### P2.PR6 - Relic 2 (passive-only)
- Scope:
  - [x] Add second passive relic.
- Acceptance tests:
  - [x] Scenario validates stacking/conflict behavior with existing effects.

### P2.PR7 - Relic 3 (passive-only)
- Scope:
  - [x] Add third passive relic.
- Acceptance tests:
  - [x] Scenario validates end-to-end equip -> trigger -> resolution path.

### Phase 2 Exit Criteria
- [x] 2 enemy archetypes shipped using existing skills only.
- [x] `ice` + `snare` terrain traits scenario-covered.
- [x] 3 passive relics scenario-covered.
- [x] No new engine architecture introduced.

---

## Phase 3 - Arcade Loop Layer
Goal: ship a replayable daily loop with minimal backend coupling.

### P3.PR1 - Local daily seed loop
- Scope:
  - [x] Implement local daily seed generation/selection.
  - [x] Preserve determinism and replay compatibility.
- Acceptance tests:
  - [x] Scenario/test proving same date -> same seed -> same deterministic outcomes.

### P3.PR2 - Objective type 1: turn limit
- Scope:
  - [x] Add turn-limit objective evaluation.
- Acceptance tests:
  - [x] Scenario validates pass/fail boundaries and scoring impact.

### P3.PR3 - Objective type 2: hazard constraint
- Scope:
  - [x] Add hazard-constraint objective evaluation.
- Acceptance tests:
  - [x] Scenario validates failure on prohibited hazard interaction.

### P3.PR4 - End-run summary payload
- Scope:
  - [x] Emit end-run summary containing seed, score, and objective outcomes.
- Acceptance tests:
  - [x] Scenario/test validates summary payload schema and deterministic values.

### Phase 3 Exit Criteria
- [x] One deterministic ~5-minute local daily loop is playable.
- [x] Replay validation remains deterministic.

---

## Phase 4 - Balance Automation
Goal: tune difficulty using measurable simulation outputs.

### P4.PR1 - Bot harness: random vs heuristic
- Scope:
  - [x] Build headless harness to run random bot vs heuristic bot.
  - [x] Output repeatable metrics per seed batch.
- Acceptance tests:
  - [x] Harness run is deterministic for same seed set.
  - [x] Metrics include win rate, turns-to-win/loss, and hazard deaths.

### P4.PR2 - Initial UPA telemetry formula (non-gating)
- Scope:
  - [x] Implement first UPA calculation for telemetry/tuning only.
  - [x] Explicitly avoid gameplay gating with UPA at this stage.
- Acceptance tests:
  - [x] Test validates UPA output stability for fixed simulated inputs.
  - [x] Test validates no runtime branch uses UPA as a hard gate.

### Phase 4 Exit Criteria
- [x] Stable difficulty signals available from simulation runs.
- [x] Balance changes can be justified by measurable harness outcomes.

---

## Phase 4.1 - Aggressive AI Pilot (Firemage)
Goal: validate Firemage power ceiling with deterministic, simulation-aware policy.

### P4.1.PR1 - Virtual step scoring in harness
- Scope:
  - [x] Add one-ply virtual execution path for heuristic Firemage policy in `packages/engine/src/systems/balance-harness.ts`.
  - [x] Score simulated next-state utility from HP delta, enemy damage, kills, distance pressure, stairs progress, and floor progress.
  - [x] Penalize `WAIT` to reduce idle loops.
- Acceptance tests:
  - [x] `npx vitest run packages/engine/src/__tests__/balance_harness.test.ts --silent` remains green.
  - [x] Deterministic 200-seed Firemage harness run improves over pre-fix timeout trap.

### P4.1.PR2 - Message-log quality audit
- Scope:
  - [x] Use engine message logs to verify player action quality (skill mix and no-op warnings).
- Acceptance tests:
  - [x] Fixed-seed audit confirms `playerZeroEffects=0`.
  - [x] Intent distribution shows regular use of Firemage kit (`FIREBALL`, `FIREWALL`, `FIREWALK`) rather than melee-only fallback.

### P4.1.PR3 - Full outlier rerun with tuned heuristic
- Scope:
  - [ ] Re-run 1000+ Firemage simulations with tuned utility policy and publish refreshed report artifact.
- Acceptance tests:
  - [ ] New report committed under `docs/` with result histogram + strongest/weakest seed slices.

---

## Deferred (Intentionally Out of Scope)
- [ ] MMO layer
- [ ] Guild systems
- [ ] Persistent economy
- [ ] Legacy ghosts as progression systems

Reason: high coupling, lower leverage before core arcade loop is stable, deterministic, and balanced.

---

## Execution Rules (Per PR)
- [ ] One mechanic slice per PR: engine rule + scenario(s) + minimal UI reflection.
- [ ] No new large system before current phase exit criteria are green.
- [ ] Prefer data-driven additions (`skills`, `tile traits`, `loadouts`) over core abstractions.
- [ ] Treat `scenarios_runner` as release gate for each milestone.
