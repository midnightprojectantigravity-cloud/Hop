# NEXT_LEVEL Active Tracker

## Status (February 9, 2026)
- Completed phases are archived in `docs/ROADMAP_HISTORY.md`.
- UPA operations and commands are documented in `docs/UPA_GUIDE.md`.
- Active tuning queue is tracked in `docs/BALANCE_BACKLOG.md`.
- Architecture rules and terminology are defined in `docs/GOLD_STANDARD_MANIFESTO.md`.

## Execution Posture (Current)
- 80/20 over perfection: prioritize speed of instrumentation and feedback loops.
- Observability-first: improve measurement quality before deep balance tuning.
- Temporary imbalance is acceptable during framework buildout.
- Balance strategy: reinforce weak archetypes/skills before nerfing strong ones.
- Current balancing baseline: `FIREMAGE` performance envelope.

## Current Phase: Trinity Runtime Contract (Top Priority)
Goal: fully align runtime combat behavior with the Body/Instinct/Mind GDD contract using one deterministic resolver.

### Now
- [x] Add a centralized Trinity resolver module that computes canonical runtime levers from `{body, mind, instinct}`.
- [x] Route Grand Calculator helper methods through the resolver (damage multiplier, status duration bonus, initiative bonus, critical multiplier, spark discount).
- [x] Add deterministic unit tests for resolver outputs and clamps.
- [x] Hook deterministic trinity defaults into entity creation for player/enemy/companion paths.
- [x] Add profile-based trinity activation (`neutral` default, `live` opt-in) for safe A/B calibration runs.

### PR Plan (Execution Order)

#### TRT.PR1 - Trinity Resolver + Calculator Wiring
- Scope:
  - [x] Add `trinity-resolver.ts` with canonical formulas and clamps.
  - [x] Wire `combat-calculator.ts` to use resolver outputs for runtime helper functions.
  - [x] Export resolver from engine public index.
- Acceptance:
  - [x] Existing combat calculator tests stay green (no unintended drift).
  - [x] New resolver tests verify deterministic values and clamp behavior.

#### TRT.PR2 - Full Skill Damage Path Migration
- Scope:
  - [x] Migrate all direct skill damage/status math to Grand Calculator/Trinity resolver path.
  - [x] Remove ad hoc per-skill stat math that bypasses centralized formulas.
- Acceptance:
  - [x] Skill audit report shows no direct inline trinity math in `packages/engine/src/skills`.
  - [x] Scenario suite remains green after migration.

#### TRT.PR3 - Triangle of Strength Runtime Rule
- Scope:
  - [x] Implement attacker-vs-defender formula interactions so `Body > Instinct > Mind > Body` emerges from stat equations rather than explicit rock-paper-scissors multipliers.
  - [x] Add mixed-stat combat resolution (units are not single-classed by one stat): all three trinity stats contribute simultaneously to offense and defense checks.
  - [x] Encode these interaction expectations in formulas:
  physical offense (`Body + Instinct`) vs physical defense (`Body + Instinct` mitigation), magical offense (`Mind + Instinct` accuracy/potency) vs magical defense (`Mind + Instinct` resistance), and crit pressure (`Instinct` attack) vs crit resilience (`Body`/`Mind` defense by damage class).
  - [x] Add trinity interaction telemetry terms from equation outputs (not forced multipliers), e.g. effective hit pressure, mitigation pressure, crit pressure, and resistance pressure.
- Acceptance:
  - [x] Unit tests validate emergent advantage across all three arcs plus neutral mixed-stat cases.
  - [x] UPA artifacts include triangle-effect signal per matchup.

#### TRT.PR3.5 - Entity Trinity Hookup
- Scope:
  - [x] Ensure all newly created entities receive a canonical `trinity` component in `entity-factory`.
  - [x] Add deterministic trinity defaults by archetype, enemy subtype, and companion subtype (currently neutral baseline `0/0/0` to avoid unintended balance drift).
  - [x] Preserve explicit trinity overrides for scripted/test actors.
- Acceptance:
  - [x] Unit tests cover player/enemy/companion trinity assignment and override behavior.
  - [x] `generateInitialState(...)` creates player and spawned enemies with trinity stats.

#### TRT.PR4 - Telemetry + UPA Lever Surfacing
- Scope:
  - [x] Emit per-run trinity leverage metrics (`bodyContribution`, `instinctContribution`, `mindContribution`).
  - [x] Add UPA report outputs for trinity contribution by archetype and matchup.
- Acceptance:
  - [x] `docs/` telemetry artifacts include trinity contribution tables.
  - [x] At least one CI check validates deterministic trinity telemetry generation.
  - [x] Neutral-vs-live profile comparison artifacts generated for trinity, matchup matrix, and skill health telemetry.

#### TRT.PR5 - Entity Runtime Enforcement
- Scope:
  - [x] Add `ensureActorTrinity(...)` normalization helper for externally created/loaded actors.
  - [x] Normalize actors on `LOAD_STATE` hydration to backfill missing trinity components.
  - [x] Normalize `SpawnActor` effects before queue insertion and companion registration.
- Acceptance:
  - [x] Unit tests cover manual actor backfill behavior.
  - [x] Continue replacing non-factory actor construction in remaining runtime paths.

#### TRT.PR6 - Skill Migration Gate
- Scope:
  - [x] Add deterministic migration audit for skills (`Damage` effects must route through `calculateCombat`).
  - [x] Add static check for direct trinity math pattern leakage in `packages/engine/src/skills`.
  - [x] Wire migration audit as a runnable UPA command.
- Acceptance:
  - [x] `docs/UPA_SKILL_MIGRATION_AUDIT.json` generated from repository root.
  - [x] Migration audit returns non-zero exit on violations.

## Current Phase: Strategic Intent Contract (Top Priority)
Goal: separate strategic decision intent (offense/defense/positioning/control) from low-level calculator payloads.

### Now
- [x] Add `StrategicIntent` policy dimension to heuristic runtime (`offense`, `defense`, `positioning`, `control`).
- [x] Add strategic-intent telemetry counters to UPA run summaries.
- [x] Add explicit `StrategicIntent -> ActionIntent` policy profile configs in calibration surfaces.

### PR Plan (Execution Order)

#### SIC.PR1 - Heuristic Intent Layer + Telemetry
- Scope:
  - [x] Introduce deterministic strategic intent selection in balance harness.
  - [x] Keep `CombatIntent` as math payload only; no strategy coupling.
  - [x] Emit strategic intent usage totals per run/batch.
- Acceptance:
  - [x] Balance harness tests remain deterministic.
  - [x] Matchup output includes strategic intent usage metrics.

#### SIC.PR2 - Policy Profiles by Intent
- Scope:
  - [x] Move intent-weight tuning into versioned profile config.
  - [x] Enable per-archetype/preset policy comparison without branching logic.
- Acceptance:
  - [x] One command can compare at least two intent-policy profiles on fixed seeds.
  - [x] No regression in loop-risk / no-progress guard metrics.

## Current Phase: Unified Evaluation Layer (Top Priority)
Goal: create a single numeric grading framework for skills, entities, tiles, maps, and encounters so challenge balance can be designed before manual tuning.

### Now
- [x] Define `GradeEnvelope` and evaluation contracts shared across object types (`power`, `survivability`, `control`, `mobility`, `economy`, `risk`, `complexity`, `objectivePressure`).
- [x] Implement `evaluateTile(...)` and `evaluateEntity(...)` as first-class evaluators.
- [x] Add deterministic artifact output for evaluator baselines under `docs/` (tile and entity grade snapshots).
- [x] Add tests proving determinism and monotonic sanity for tile/entity evaluators.

### PR Plan (Execution Order)

#### UEL.PR1 - Grade Contract + Registry
- Scope:
  - [x] Add shared `GradeEnvelope` type and evaluator interface.
  - [x] Add evaluator registry with deterministic output contract.
- Acceptance:
  - [x] Unit tests confirm deterministic output for identical inputs.
  - [x] Contract supports `skill`, `entity`, `tile`, `map`, `encounter`.

#### UEL.PR2 - Tile + Entity Evaluators
- Scope:
  - [x] Implement `evaluateTile(...)` and `evaluateEntity(...)`.
  - [x] Add baseline grade snapshots in `docs/` for both.
- Acceptance:
  - [x] Monotonic sanity tests pass (stronger inputs increase expected dimensions).
  - [x] Snapshot artifacts regenerate deterministically.

#### UEL.PR3 - Map + Encounter Evaluators
- Scope:
  - [x] Implement `evaluateMap(...)` (topology, hazard density, path friction).
  - [x] Implement `evaluateEncounter(...)` (map + spawn + objective pressure).
- Acceptance:
  - [x] Encounter output includes explicit difficulty band field.
  - [x] Deterministic test suite covers fixed seed/map inputs.

#### UEL.PR4 - UPA Integration + Artifacts
- Scope:
  - [x] Link evaluator outputs into UPA scripts/workflow.
  - [x] Emit unified evaluator artifacts for all object classes.
- Acceptance:
  - [x] One command regenerates all evaluator artifacts.
  - [x] `docs/UPA_GUIDE.md` includes evaluator runbook.

#### CAL.PR1 - Calibration Surfaces (Entity/Skill/Policy/Encounter)
- Scope:
  - [x] Create versioned calibration configs for all four lever groups.
  - [x] Add before/after diff generator for lever changes.
- Acceptance:
  - [x] Any lever change produces comparable artifact deltas.
  - [x] No non-deterministic drift in repeated runs.

#### CAL.PR2 - Difficulty-Targeted Challenge Design
- Scope:
  - [x] Add workflow to design/validate encounters by target difficulty band.
  - [x] Add reinforce-first recommendations against `FIREMAGE` baseline.
- Acceptance:
  - [x] New encounter can be generated and validated to a chosen numeric band.
  - [x] Weaker archetype uplift report is produced without mandatory firemage nerf.

#### CAL.PR3 - CI Gate Promotion
- Scope:
  - [x] Promote at least one stable calibration threshold from warn-only to fail-gate.
  - [x] Keep existing health gates green.
- Acceptance:
  - [x] CI fails on threshold breach for promoted rule.
  - [x] Threshold stability shown across 3 consecutive runs.

## Next Top Priority: Calibration Framework (Post-Evaluator)
Goal: apply evaluator outputs to a deterministic calibration loop with explicit lever ownership and measurable target bands.

### Lever Ownership (Unlocked)
- [x] Entity formulas and coefficients are in-scope for iteration.
- [x] Skill coefficients and scaling factors are in-scope for iteration.
- [x] AI policy weights and ranking formulas are in-scope for iteration.
- [x] Map/encounter generation parameters are in-scope for iteration.

### Calibration Lever A: Entity
- [x] Define canonical calibration surface for entities (`Body`, `Mind`, `Instinct` + formula coefficients).
- [x] Add baseline archetype/entity calibration tables and versioned config.
- [x] Add tests for formula monotonicity and non-regression across key combat/mobility/status outputs.

### Calibration Lever B: Skill
- [x] Define per-skill calibration surface (base values, multipliers, scaling coefficients, cooldown/cost, targeting constraints).
- [x] Add skill tuning profiles that can be applied in simulation without changing engine contracts.
- [x] Add artifact diff report for skill coefficient changes vs resulting grade/outcome deltas.

### Calibration Lever C: Policy (AI)
- [x] Formalize layered policy scoring (`offense`, `defense`, `positioning`, `control/status`) with deterministic weights.
- [x] Add policy profile presets and side-by-side simulation comparison tooling.
- [x] Add guard tests preventing policy regressions (loop-risk spikes, no-progress action inflation).

### Calibration Lever D: Encounter/Map
- [x] Define encounter/map calibration surface (hazard density, spawn pressure, objective pressure, path friction).
- [x] Add map/encounter target difficulty bands and generator constraints.
- [x] Validate calibrated encounter outputs against evaluator + simulation outcomes.

### Exit Criteria
- [x] Calibration runs can adjust entity/skill/policy/encounter levers independently with deterministic outputs.
- [x] Every calibration change produces comparable artifacts (before/after grades + outcome metrics).
- [x] At least one calibration threshold is promoted to fail-gate in CI based on stable signal.

## Secondary Phase: Balance Execution
Goal: apply evaluator-guided tuning to matchup dominance and hazard-discipline issues.

### Progress Checkpoint (February 9, 2026)
- [x] Firemage vs Vanguard reinforcement slice executed on live trinity profile.
- [x] Baseline matchup measured at `58-2` (Firemage-Vanguard over 60 seeds, 40 turns).
- [x] Applied weak-side reinforcement levers:
  - `VANGUARD` live trinity adjusted to `{ body: 9, mind: 6, instinct: 5 }`.
  - Generic heuristic hazard tag pre-rank sign corrected (no high-HP bonus for hazard-tagged actions).
  - Added no-progress `DASH` penalty in one-ply evaluator.
- [x] Post-change matchup measured at `55-5` (Firemage still dominant; Vanguard uplift confirmed).
- [x] Added quick behavior review tooling:
  - `packages/engine/scripts/runQuickAiReview.ts`
  - `npm run upa:quick:ai`
- [x] Behavior-first AI fixes applied after short-seed review:
  - Suppressed default engine noise in quick review output (verbose opt-in via `HOP_AI_REVIEW_VERBOSE=1`).
  - Tightened strategic `control` intent activation to tactical-range situations.
  - Added stronger dead-cast penalties for zero-progress skill actions.
  - Added `SHIELD_BASH` no-target pre-rank penalty.
- [x] Post-review matchup measured at `50-10` (Firemage-Vanguard, 60 seeds, 40 turns, live profile).
- [x] Heuristic architecture refactor: default scorer + skill-profile overrides.
  - Removed remaining hardcoded skill-ID branches from evaluator path.
  - Added profile-driven risk controls:
    - `noProgressCastPenalty`
    - `requireEnemyContact`
    - `noContactPenalty`
  - Wired first overrides for `DASH`, `JUMP`, `SHIELD_BASH`, `SPEAR_THROW`, `FIREWALK`.
- [x] 6-archetype quick smoke run (4 seeds x 20 turns, live profile) confirms shared logic path is stable and highlights next tuning targets:
  - `VANGUARD`: `JUMP` over-selected.
  - `HUNTER`: `FALCON_COMMAND` over-selected.
  - `NECROMANCER`: weak opening pressure / low floor progression.

### Queue
- [x] Add cross-archetype message consistency audit and artifact (`artifacts/upa/UPA_MESSAGE_AUDIT.json`).
- [ ] Firemage dominance reduction across top 3 pairings from `docs/UPA_PVP_MATCHUP_MATRIX.json`.
- [ ] Hazard-breach reduction for `NECROMANCER`, `HUNTER`, `ASSASSIN`, `VANGUARD`.
- [ ] Keep skill-health gates green (`loop-risk=0`, `failures=0`, player-facing policy-blocked <= 2).
- [x] Fix message consistency blockers from audit:
  - duplicate movement/system message bursts (`no_consecutive_duplicate_messages`) resolved
  - stun/attack same-step regressions in Skirmisher control flows (`stunned_actor_does_not_attack_same_step`) resolved
  - verification: `npm run upa:messages:audit` => `totalViolations: 0`

## MVP Closeout Plan (Arcade)
Goal: lock a stable, replay-safe, calibration-ready Arcade v1.
Status: complete; next iterations are calibration/tuning-only unless a release blocker appears.

### ARC.MVP.PR1 - Lock `mvp-v1` Balance Target
- Scope:
  - [x] Define target envelope for 80-turn Arcade loop (floor progression, death rate, objective completion).
  - [x] Freeze trinity + combat-profile configs as `mvp-v1`.
  - [x] Add seed set for repeatable calibration checks.
- Acceptance:
  - [x] One command reproduces `mvp-v1` baseline metrics from fixed seeds.
  - [x] Baseline artifact saved under `docs/` with timestamp and config version.

### ARC.MVP.PR2 - Complete Combat-Profile Rollout
- Scope:
  - [x] Route all damage-dealing skills through combat-profile multipliers (not just `BASIC_ATTACK` / `AUTO_ATTACK`).
  - [x] Keep trait logic data-driven (`combat_profile` component), no ad hoc per-skill hacks.
  - [x] Add per-hit telemetry terms for outgoing/incoming trait multipliers.
- Acceptance:
  - [x] Skill migration audit remains green.
  - [x] UPA telemetry includes trait contribution fields per skill/event batch.

### ARC.MVP.PR3 - Arcade Readability + Sequence Integrity
- Scope:
  - [x] Enforce full action sequencing in client timeline (`move -> hazard check -> sink/damage -> death`).
  - [x] Ensure objective/shrine/stairs cues are visible and deterministic in flow.
  - [x] Keep input lock until blocking timeline events complete.
- Acceptance:
  - [x] Sequence tests verify no hazard resolution before move completion.
  - [x] Automated build/smoke checks confirm stable timeline-driven action consequences.

### ARC.MVP.PR4 - Determinism + Replay Gate
- Scope:
  - [x] Add one CI-friendly command that runs: `scenarios_runner` + replay validation + core UPA smoke.
  - [x] Ensure hydrated/load-state normalization preserves trinity/combat-profile parity.
  - [x] Fail fast on parity drift.
- Acceptance:
  - [x] Gate command passes locally and in CI.
  - [x] Seeded run replay hashes match across two consecutive executions.

### ARC.MVP.PR5 - MVP Content Lock + Post-Lock Rules
- Scope:
  - [x] Lock Arcade v1 scope (archetypes, enemy set, terrain pack, relic set, objectives).
  - [x] Declare post-lock policy: no new systems, only telemetry-driven tuning and bug fixes.
  - [x] Move residual ideas to backlog with explicit non-MVP label.
- Acceptance:
  - [x] `docs/BALANCE_BACKLOG.md` and `docs/UPA_GUIDE.md` updated for v1 lock.
  - [x] `docs/NEXT_LEVEL.md` marks MVP Closeout complete and opens calibration-only phase.

### ARC.MVP.PR6 - Replay + Smoothness Hardening
- Scope:
  - [x] Preserve replay action history across floor transitions.
  - [x] Add replay action normalization and diagnostics metadata on save/load.
  - [x] Surface replay integrity flags in Replay UI (`legacy`, `truncated`, `invalid`).
  - [x] Reduce board/render churn (`GameBoard` precomputed highlights, memoized `HexTile`/`Entity`).
  - [x] Reduce VFX cleanup churn in `JuiceManager`.
  - [x] Add optional FPS/frame-time debug probe (`window.__HOP_DEBUG_PERF = true`).
- Acceptance:
  - [x] Long runs replay with full action history (not last-floor only).
  - [x] Web build passes and replay-related tests pass.
  - [x] `scenarios_runner` remains green.

## Working Rules
- One mechanic slice per PR: rule change + test coverage + telemetry rerun.
- No new large systems while imbalance backlog is open.
- `scenarios_runner` + UPA health checks are merge gates.
