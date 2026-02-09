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

## Progress Snapshot (February 9, 2026)

### User Feedback Closure (`docs/User Feedback.md`)
- [x] **Unsafe lava traversal blocked for free move**
  - Scope:
    - [x] `BASIC_MOVE` now computes targets through hazard-safe pathing only (`packages/engine/src/skills/basic_move.ts`).
    - [x] Unsafe lava tiles are rejected both as path and destination unless actor is hazard-safe (`canPassHazard` / `canLandOnHazard`).
  - Acceptance:
    - [x] `Walk Into Lava` scenario updated to new contract and passes (`packages/engine/src/scenarios/hazards.ts`).
- [x] **Firewalk treated as teleport semantics**
  - Scope:
    - [x] `FIREWALK` displacement explicitly disables path simulation (`simulatePath: false`) in `packages/engine/src/skills/firewalk.ts`.
  - Acceptance:
    - [x] No path-based pass hooks are invoked for Firewalk execution.
- [x] **Bomb timer consistency**
  - Scope:
    - [x] Bomb actors now execute countdown/explosion logic each initiative turn via `resolveSingleEnemyTurn` path in `processNextTurn` (`packages/engine/src/logic.ts`).
  - Acceptance:
    - [x] Bombs decrement from `2 -> 1 -> explode` instead of remaining stuck at 2.
- [x] **Tile text click no longer selects tile**
  - Scope:
    - [x] Coordinate text now intercepts click (`stopPropagation`) in `apps/web/src/components/HexTile.tsx`.
  - Acceptance:
    - [x] Clicking tile label text no longer triggers move/target selection.
- [x] **Return to Command Center / Hub fixed**
  - Scope:
    - [x] `EXIT_TO_HUB` is now allowed through non-playing reducer guards (`packages/engine/src/logic.ts`).
  - Acceptance:
    - [x] Exit action works from end-of-run and other non-playing UI states.

### Verification (February 9, 2026)
- [x] `npm run build` passes for all workspaces.
- [x] `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts` passes.
- [x] `npx vitest run --silent` passes (`109 passed / 14 skipped`).

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
- Necromancer engine contract hardening landed:
  - Corpses now persist as tile trait state (`CORPSE`) and are consumed by necromancy skills (`packages/engine/src/systems/effect-engine.ts`, `packages/engine/src/skills/raise_dead.ts`, `packages/engine/src/skills/corpse_explosion.ts`).
  - Summoned allies linked by `companionOf` now migrate across floor transitions in `RESOLVE_PENDING` (`packages/engine/src/logic.ts`).
  - Raised skeletons now spawn with companion ownership and baseline combat loadout (`BASIC_MOVE`, `BASIC_ATTACK`, `AUTO_ATTACK`) and collision-safe deterministic IDs (`packages/engine/src/skills/raise_dead.ts`).
  - Exploration free-move now ignores friendly companions (hostile-only gating in `packages/engine/src/skills/basic_move.ts`), with scenario coverage.
  - Added scenario coverage in `packages/engine/src/scenarios/necromancer.ts`.
  - Added deterministic Necromancer telemetry artifact: `docs/UPA_OUTLIER_REPORT_NECROMANCER_2026-02-08.json`.
    - `random`: `998 lost / 2 timeout`, `avgFloor=1.001`, `avgHazardBreaches=0.625`, `UPA=0.207`.
    - `heuristic`: `215 lost / 785 timeout`, `avgFloor=3.78`, `avgHazardBreaches=0.049`, `UPA=0.0784`.
- Necromancer harness policy retuned to human-priority ordering in `packages/engine/src/systems/balance-harness.ts`:
  - opener locked to first kill objective (`state.kills === 0`), then `RAISE_DEAD` priority until cap 6.
  - `SOUL_SWAP` reduced to emergency-only trigger (low HP + real adjacent pressure/hazard).
  - post-opener behavior now prefers safe disengage and shrine pathing over melee loops.
- Retune telemetry sample (200 seeds, `maxTurns=100`, generated `2026-02-08T05:56:46.069Z`):
  - `random`: `200 lost`, `avgFloor=1.0`, `avgHazardBreaches=0.49`, `UPA=0.2102`.
  - `heuristic`: `15 lost / 185 timeout`, `avgFloor=1.62`, `avgHazardBreaches=0`, `UPA=0.0012`.
  - Conclusion: survivability improved but progression remains blocked by residual zero-effect `BASIC_ATTACK` loops.

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

## Phase 2.1 - Necromancer Archetype Refactor
Goal: stabilize corpse persistence and summon migration.

### P2.1.PR1 - Corpse as Tile Trait
- Scope:
  - [x] Death resolution writes persistent `CORPSE` tile trait.
  - [x] `RAISE_DEAD`/`CORPSE_EXPLOSION` validate and consume `CORPSE` tiles.
- Acceptance tests:
  - [x] New scenario `necromancer_corpse_persistence` passes (`packages/engine/src/scenarios/necromancer.ts`).

### P2.1.PR2 - Summon Persistence
- Scope:
  - [x] Summons are owner-linked through `companionOf` and migrated on floor transition.
  - [x] Transition rebuilds initiative/occupancy after migration.
- Acceptance tests:
  - [x] New scenario `summon_floor_transition` passes (`packages/engine/src/scenarios/necromancer.ts`).

### P2.1.PR3 - Decay Policy
- Scope:
  - [x] Corpse marker persists until explicitly consumed (`RemoveCorpse`).
- Acceptance tests:
  - [x] Corpse remains valid after waiting multiple turns before cast (`necromancer_corpse_persistence`).

### Phase 2.1 Exit Criteria
- [x] `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts --silent` passes with necromancer scenarios.
- [x] Full suite remains green (`npx vitest run --silent`).

---

## Phase 2.2 - Summoner QoL (Formation + Flow)
Goal: prevent ally clogging and enforce deterministic summon occupancy behavior.

### P2.2.PR1 - Occupancy Enforcement + Raise Dead Push
- Scope:
  - [x] `RAISE_DEAD` now enforces one-entity-per-hex at summon destination.
  - [x] If corpse tile is occupied by a pushable ally, ally is displaced to nearest valid neighbor before summon.
- Acceptance tests:
  - [x] New scenario `raise_dead_pushes_ally_from_target_hex` passes (`packages/engine/src/scenarios/necromancer.ts`).
  - [x] No skeleton overlap after summon resolution.

### P2.2.PR2 - Ally Phasing for Movement
- Scope:
  - [x] Movement pathing can traverse allied occupied tiles.
  - [x] Ending move on allied occupied tile remains invalid.
  - [x] Exploration free-move gating counts hostiles only.
- Acceptance tests:
  - [x] Existing scenario `companion_does_not_block_free_move` passes (`packages/engine/src/scenarios/necromancer.ts`).
  - [x] Full scenario suite remains green.

### P2.2.PR3 - Companion Visual Parity
- Scope:
  - [x] Skeleton companion visual configured as circle token with skull icon (falcon-like companion style).
- Acceptance tests:
  - [x] Visual registry contains dedicated `skeleton` companion mapping (`packages/engine/src/systems/visual-registry.ts`).

### Phase 2.2 Exit Criteria
- [x] `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts --silent` passes.
- [x] `npx vitest run --silent` passes.

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

### P4.1.PR2.1 - Firemage Priority Retune (Kill/Floor Progress)
- Scope:
  - [x] Fix harness run-loop classification bug: auto-resolve `choosing_upgrade` via deterministic `SELECT_UPGRADE` so shrine interactions continue run progression.
  - [x] Enforce stronger Firemage tactical ordering in harness policy:
    - direct-hit `FIREBALL` prioritized over setup casts,
    - `FIREWALL` gated to multi-target pressure only,
    - anti-backtrack movement penalty, shrine-before-stairs progression target.
- Acceptance tests:
  - [x] `npx vitest run packages/engine/src/__tests__/balance_harness.test.ts --silent` passes after policy updates.
  - [x] 200-seed Firemage batch (`maxTurns=100`) shows improved progression versus random:
    - `random`: `winRate=0`, `timeoutRate=0.31`, `avgFloor=1.11`
    - `heuristic`: `winRate=0.015`, `timeoutRate=0.64`, `avgFloor=6.29`

### P4.1.PR3 - Full outlier rerun with tuned heuristic
- Scope:
  - [ ] Re-run 1000+ Firemage simulations with tuned utility policy and publish refreshed report artifact.
- Acceptance tests:
  - [ ] New report committed under `docs/` with result histogram + strongest/weakest seed slices.

## Phase 4.2 - Necromancer Progression Bot (In Progress)
Goal: enforce kill -> raise -> expand army -> progress floor behavior without no-op loops.

### P4.2.PR1 - Eliminate zero-effect attack loops
- Scope:
  - [ ] Trace and close remaining `BASIC_ATTACK` zero-effect paths during harness simulation.
  - [ ] Ensure Necromancer action policy cannot stall on repeated non-advancing attack intents.
- Acceptance tests:
  - [ ] Fixed-seed message-log audit shows `playerZeroEffects=0` for Necromancer sample set.
  - [ ] 200-seed Necromancer run reduces timeout rate from `0.925` while keeping hazard deaths near zero.

### P4.2.PR2 - Generic utility weighting pass (non-archetype hardcoding)
- Scope:
  - [ ] Introduce role-level utility knobs (kill pressure, floor progression, shrine urgency, safety) reusable across archetypes.
  - [ ] Keep archetype-specific policy as thin overrides only where required by skill contracts.
- Acceptance tests:
  - [ ] Harness config can switch role profiles without branching in core selector flow.
  - [ ] Firemage and Necromancer both improve on timeout-heavy baseline under shared utility scaffolding.

## Phase 5 - Centralized Combat Logic System (Grand Calculator)
Goal: consolidate combat math into one deterministic calculation pipeline and stop logic leakage across skills/effects.

### P5.PR1 - CombatIntent Contract + Calculator Core
- Scope:
  - [x] Add `CombatIntent` contract with trinity stats, scaling terms, status multipliers, and tension/risk inputs.
  - [x] Add centralized deterministic calculator (`calculateCombat`) with formula stack:
    - Base -> Scaling -> Status Multipliers -> Risk Multiplier -> Final Power.
  - [x] Emit score telemetry payload (`efficiency`, `riskBonusApplied`) from the same calculation result.
- Acceptance tests:
  - [x] `npx vitest run packages/engine/src/__tests__/combat_calculator.test.ts --silent` passes.
  - [x] Test covers deterministic output and non-negative final power.
  - [x] Module exported through public engine index.

### P5.PR2 - Skill Adoption Gate (No Direct Damage Math in Skill Files)
- Scope:
  - [x] Migrate first slice (`BASIC_ATTACK`, `FIREBALL`, `CORPSE_EXPLOSION`) to use `calculateCombat`.
  - [x] Replace direct skill-local damage arithmetic with calculator inputs.
  - [x] Add guard test that scans changed skill files for direct `Damage amount` arithmetic bypass patterns.
- Acceptance tests:
  - [x] Scenario parity remains green for migrated skills (`npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts --silent`).
  - [x] Guard test enforces calculator usage in migrated skills (`packages/engine/src/__tests__/combat_calculator_adoption.test.ts`).

### P5.PR3 - Attribute Lever Wiring
- Scope:
  - [x] Define canonical Body/Mind/Instinct storage in actor components and map into calculator inputs.
  - [x] Wire Body to raw damage leverage, Mind to status-duration leverage, Instinct to initiative/crit leverage.
- Acceptance tests:
  - [x] Headless tests show stat delta propagates through all migrated skills from one source of truth (`packages/engine/src/__tests__/trinity_integration.test.ts`).
  - [x] Deterministic replay behavior remains unchanged for fixed seeds (`npx vitest run --silent` remains green).

### P5.PR4 - Score/Tension Integration
- Scope:
  - [x] Feed calculator `scoreEvent` into run scoring pipeline as telemetry-only signal first.
  - [x] Inject risk bonus whenever action resolves from an `intentPreview` danger tile.
- Acceptance tests:
  - [x] Objective/score tests confirm deterministic score-event emission (`packages/engine/src/__tests__/daily_run.test.ts`).
  - [x] No gameplay branch hard-gates on UPA/efficiency at this phase (telemetry remains summary-only).

### Phase 5 Formula Contract (Locked)
- Combat (Body): `FinalDamage = SkillBase * (1 + Body / 20)` plus optional skill scaling + status/risk/crit multipliers in calculator.
- Status (Mind): `FinalTurns = StatusBase + floor(Mind / 15)`.
- Movement Economy (Instinct): `SparkCost = Fibonacci(MoveIndex) * (1 - Instinct / 100)` via `GrandCalculator.resolveSparkCost`.

### Phase 5 Exit Criteria
- [x] Grand Calculator contract exists and is exported (`packages/engine/src/systems/combat-calculator.ts`).
- [x] First migrated skills route damage through calculator (`BASIC_ATTACK`, `FIREBALL`, `CORPSE_EXPLOSION`).
- [x] Trinity levers wired to combat/status/initiative and covered by tests.
- [x] Score/tension telemetry emitted without gameplay gating.
- [x] Full suite remains green (`npx vitest run --silent`).

## Phase J - Juice Sequencing (Event-Driven)
Goal: enforce choreographed, deterministic visual sequencing so movement resolves before hazard consequence beats.

### PR-J1 - Engine Timeline Queue Contract
- Scope:
  - [x] Add deterministic `timelineEvents` to `GameState`.
  - [x] Emit ordered phases in effect execution (`MOVE_START`, `MOVE_END`, `ON_PASS`, `ON_ENTER`, `HAZARD_CHECK`, `DAMAGE_APPLY`, `STATUS_APPLY`, `DEATH_RESOLVE`).
  - [x] Add suggested durations and blocking hints for client playback.
- Acceptance tests:
  - [x] `packages/engine/src/__tests__/timeline_sequence.test.ts` ensures move phases complete before hazard/damage on lava entry.

### PR-J2 - Client Timeline Runner
- Scope:
  - [x] Extend `JuiceManager` to process `timelineEvents` sequentially with blocking delays.
  - [x] Keep legacy visual-event mode as fallback when no timeline events are present.
  - [x] Feed busy-state from timeline runner to input gating in `App.tsx`.
- Acceptance tests:
  - [x] Engine + web tests remain green with timeline runner active (`npx vitest run --silent`).

### PR-J3 - Hazard Sequence Baseline
- Scope:
  - [x] Wire hazard checks and damage/death beats into timeline phases from engine.
  - [x] Ensure sink/disaster cues are emitted after movement completion in timeline order.
- Acceptance tests:
  - [x] Timeline ordering test covers `MOVE -> HAZARD_CHECK -> DAMAGE_APPLY` on lava entry.

### PR-J4 - Tween/Visual Language Expansion
- Scope:
  - [ ] Replace generic phase effects with full style language per channel (`body`, `mind`, `instinct`) and easing presets.
  - [x] Add reduced-motion profile preserving order with shortened timing.
- Acceptance tests:
  - [ ] Add UI integration test for input lock until timeline drain.

### Juice Progress Snapshot (Current)
- Added deterministic timeline sequencing contract to engine state and effect resolution (`packages/engine/src/types.ts`, `packages/engine/src/systems/effect-engine.ts`).
- Added client-side sequential timeline runner with blocking playback in `apps/web/src/components/JuiceManager.tsx`.
- Added reduced-motion timing compression in timeline runner (`prefers-reduced-motion` support).
- Upgraded entity movement easing toward non-linear kinetic feel in `apps/web/src/components/Entity.tsx`.
- Added timeline ordering regression test `packages/engine/src/__tests__/timeline_sequence.test.ts`.

### Phase J Exit Criteria
- [x] Deterministic timeline queue exists in engine.
- [x] Client consumes timeline sequentially and exposes busy/input lock behavior.
- [x] Lava entry no longer presents consequence beats before movement completion in event order.
- [ ] Full polish library/easing presets complete.

---

## Phase 6 - Agnostic UPA + Numeric Skill Grading
Goal: replace archetype-specific heuristics with a generic intent framework and assign every skill an unbounded numeric grade.

### P6.PR1 - `SkillIntentProfile` contract (all skills)
- Scope:
  - [x] Add `SkillIntentProfile` type alongside `SkillDefinition`.
  - [x] Include profile fields needed for generic scoring only (`intentTags`, range/shape, damage/heal/protect/move/control descriptors, hazard affinity, economy metadata).
  - [x] Add schema validation and CI enforcement for missing/invalid profiles.
- Acceptance tests:
  - [x] `npx vitest run packages/engine/src/__tests__/skill_intent_profile.test.ts --silent` passes.
  - [x] Registry bootstrap fails if any registered skill has no valid profile.

### P6.PR2 - Static numeric grade engine (unbounded)
- Scope:
  - [x] Add `computeSkillNumericGrade(profile)` that returns a pure number with no ceiling and no bands.
  - [x] Expose sub-scores (`power`, `reach`, `safety`, `tempo`, `complexity`) plus final weighted numeric grade.
  - [x] Generate artifact (for example `docs/UPA_SKILL_GRADES_STATIC.json`) keyed by skill id and version.
- Acceptance tests:
  - [x] Determinism: same inputs produce the same numeric output across runs.
  - [x] Monotonic sanity checks: increasing base power or reach increases grade when all else is equal.
  - [x] No stars/metals/enums appear in grade output.

### P6.PR3 - Full skill migration to profile + numeric grade
- Scope:
  - [x] Refactor all existing skills to include `SkillIntentProfile` (registry hydration + overrides for all registered skills).
  - [x] Ensure grade generation runs across the full registry.
- Acceptance tests:
  - [x] `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts --silent` remains green after migration.
  - [x] Grade artifact includes 100% of registered skills.

### P6.PR4 - Generic intent scorer (remove archetype branches)
- Scope:
  - [x] Replace archetype-specific heuristic branches in `packages/engine/src/systems/balance-harness.ts` with one generic intent scoring pipeline.
  - [x] Generate intents from legal targets only (`getValidTargets`) and score with shared utility terms (survival, lethality, position, objective, tempo, resources).
- Acceptance tests:
  - [x] Harness can run loadouts including `VANGUARD` and `HUNTER` under one selector path with no archetype-specific decision branch.
  - [x] Existing balance harness tests remain green.

### P6.PR5 - Top-K one-ply simulation + memoization
- Scope:
  - [x] Pre-rank intents, then simulate top K for final selection.
  - [x] Add turn-local memoization on `(stateHash, actorId, skillId, target)` to avoid duplicate evaluations.
- Acceptance tests:
  - [x] Deterministic selected intent for fixed seed/state.
  - [x] Runtime bounded through candidate fanout + top-K simulation.

### P6.PR6 - Dynamic numeric grade from UPA telemetry
- Scope:
  - [x] Compute simulation-backed numeric skill grades from telemetry (`castRate`, `damagePerCast`, `killContribution`, `survivalDelta`, `objectiveDelta`, `winImpact`).
  - [x] Emit artifact (for example `docs/UPA_SKILL_GRADES_DYNAMIC.json`) with same unbounded numeric format.
  - [x] Add drift report between static and dynamic numeric grades.
- Acceptance tests:
  - [x] `runUpaOutlierAnalysis` output includes per-skill dynamic numeric grade fields.
  - [x] Drift report generation is available (`docs/UPA_SKILL_GRADE_DRIFT.json`).

### P6.PR7 - Continuous automation
- Scope:
  - [x] Add scripts for static grades, dynamic grades, and drift report generation.
  - [x] Add CI/nightly job for dynamic grade refresh and PR diff for static grade changes.
- Acceptance tests:
  - [x] One-command local flow generates all grade artifacts.
  - [x] CI publishes grade deltas in pull request output.

### P6.PR8 - Documentation + policy enforcement
- Scope:
  - [x] Update `docs/UPA_GUIDE.md` with numeric-grade workflow and commands.
  - [x] Add contribution rule: any skill stat change requires updated static grade artifact; major behavior change requires dynamic rerun.
- Acceptance tests:
  - [x] Docs include end-to-end runbook for grade generation and interpretation.
  - [x] PR checklist includes grade-update gate.

### Phase 6 Exit Criteria
- [x] All skills have a validated `SkillIntentProfile`.
- [x] Static and dynamic skill grades are numeric-only and unbounded.
- [x] Generic intent policy runs all archetypes without archetype-specific branches.
- [x] UPA workflow is automated enough to avoid manual one-by-one balancing loops.

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
