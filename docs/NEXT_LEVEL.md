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

## Current Phase: Unified Evaluation Layer (Top Priority)
Goal: create a single numeric grading framework for skills, entities, tiles, maps, and encounters so challenge balance can be designed before manual tuning.

### Now
- [ ] Define `GradeEnvelope` and evaluation contracts shared across object types (`power`, `survivability`, `control`, `mobility`, `economy`, `risk`, `complexity`, `objectivePressure`).
- [ ] Implement `evaluateTile(...)` and `evaluateEntity(...)` as first-class evaluators.
- [ ] Add deterministic artifact output for evaluator baselines under `docs/` (tile and entity grade snapshots).
- [ ] Add tests proving determinism and monotonic sanity for tile/entity evaluators.

### PR Plan (Execution Order)

#### UEL.PR1 - Grade Contract + Registry
- Scope:
  - [ ] Add shared `GradeEnvelope` type and evaluator interface.
  - [ ] Add evaluator registry with deterministic output contract.
- Acceptance:
  - [ ] Unit tests confirm deterministic output for identical inputs.
  - [ ] Contract supports `skill`, `entity`, `tile`, `map`, `encounter`.

#### UEL.PR2 - Tile + Entity Evaluators
- Scope:
  - [ ] Implement `evaluateTile(...)` and `evaluateEntity(...)`.
  - [ ] Add baseline grade snapshots in `docs/` for both.
- Acceptance:
  - [ ] Monotonic sanity tests pass (stronger inputs increase expected dimensions).
  - [ ] Snapshot artifacts regenerate deterministically.

#### UEL.PR3 - Map + Encounter Evaluators
- Scope:
  - [ ] Implement `evaluateMap(...)` (topology, hazard density, path friction).
  - [ ] Implement `evaluateEncounter(...)` (map + spawn + objective pressure).
- Acceptance:
  - [ ] Encounter output includes explicit difficulty band field.
  - [ ] Deterministic test suite covers fixed seed/map inputs.

#### UEL.PR4 - UPA Integration + Artifacts
- Scope:
  - [ ] Link evaluator outputs into UPA scripts/workflow.
  - [ ] Emit unified evaluator artifacts for all object classes.
- Acceptance:
  - [ ] One command regenerates all evaluator artifacts.
  - [ ] `docs/UPA_GUIDE.md` includes evaluator runbook.

#### CAL.PR1 - Calibration Surfaces (Entity/Skill/Policy/Encounter)
- Scope:
  - [ ] Create versioned calibration configs for all four lever groups.
  - [ ] Add before/after diff generator for lever changes.
- Acceptance:
  - [ ] Any lever change produces comparable artifact deltas.
  - [ ] No non-deterministic drift in repeated runs.

#### CAL.PR2 - Difficulty-Targeted Challenge Design
- Scope:
  - [ ] Add workflow to design/validate encounters by target difficulty band.
  - [ ] Add reinforce-first recommendations against `FIREMAGE` baseline.
- Acceptance:
  - [ ] New encounter can be generated and validated to a chosen numeric band.
  - [ ] Weaker archetype uplift report is produced without mandatory firemage nerf.

#### CAL.PR3 - CI Gate Promotion
- Scope:
  - [ ] Promote at least one stable calibration threshold from warn-only to fail-gate.
  - [ ] Keep existing health gates green.
- Acceptance:
  - [ ] CI fails on threshold breach for promoted rule.
  - [ ] Threshold stability shown across 3 consecutive runs.

## Next Top Priority: Calibration Framework (Post-Evaluator)
Goal: apply evaluator outputs to a deterministic calibration loop with explicit lever ownership and measurable target bands.

### Lever Ownership (Unlocked)
- [x] Entity formulas and coefficients are in-scope for iteration.
- [x] Skill coefficients and scaling factors are in-scope for iteration.
- [x] AI policy weights and ranking formulas are in-scope for iteration.
- [x] Map/encounter generation parameters are in-scope for iteration.

### Calibration Lever A: Entity
- [ ] Define canonical calibration surface for entities (`Body`, `Mind`, `Instinct` + formula coefficients).
- [ ] Add baseline archetype/entity calibration tables and versioned config.
- [ ] Add tests for formula monotonicity and non-regression across key combat/mobility/status outputs.

### Calibration Lever B: Skill
- [ ] Define per-skill calibration surface (base values, multipliers, scaling coefficients, cooldown/cost, targeting constraints).
- [ ] Add skill tuning profiles that can be applied in simulation without changing engine contracts.
- [ ] Add artifact diff report for skill coefficient changes vs resulting grade/outcome deltas.

### Calibration Lever C: Policy (AI)
- [ ] Formalize layered policy scoring (`offense`, `defense`, `positioning`, `control/status`) with deterministic weights.
- [ ] Add policy profile presets and side-by-side simulation comparison tooling.
- [ ] Add guard tests preventing policy regressions (loop-risk spikes, no-progress action inflation).

### Calibration Lever D: Encounter/Map
- [ ] Define encounter/map calibration surface (hazard density, spawn pressure, objective pressure, path friction).
- [ ] Add map/encounter target difficulty bands and generator constraints.
- [ ] Validate calibrated encounter outputs against evaluator + simulation outcomes.

### Exit Criteria
- [ ] Calibration runs can adjust entity/skill/policy/encounter levers independently with deterministic outputs.
- [ ] Every calibration change produces comparable artifacts (before/after grades + outcome metrics).
- [ ] At least one calibration threshold is promoted to fail-gate in CI based on stable signal.

## Secondary Phase: Balance Execution
Goal: apply evaluator-guided tuning to matchup dominance and hazard-discipline issues.

### Queue
- [ ] Firemage dominance reduction across top 3 pairings from `docs/UPA_PVP_MATCHUP_MATRIX.json`.
- [ ] Hazard-breach reduction for `NECROMANCER`, `HUNTER`, `ASSASSIN`, `VANGUARD`.
- [ ] Keep skill-health gates green (`loop-risk=0`, `failures=0`, player-facing policy-blocked <= 2).

## Working Rules
- One mechanic slice per PR: rule change + test coverage + telemetry rerun.
- No new large systems while imbalance backlog is open.
- `scenarios_runner` + UPA health checks are merge gates.
