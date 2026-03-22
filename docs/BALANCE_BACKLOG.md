# Balance Backlog

Canonical doctrine:
- `docs/GOLD_STANDARD_BALANCING.md`

## Current Inputs
- Calibration baseline: `docs/UPA_CALIBRATION_BASELINE.json`
- Matchup matrix: `docs/UPA_PVP_MATCHUP_MATRIX.json`
- Skill health: `docs/UPA_SKILL_HEALTH.json`
- Dynamic grades: `docs/UPA_SKILL_GRADES_DYNAMIC.json`
- Archetype source of truth (loadout IDs): `packages/engine/src/systems/loadout.ts`

## Strategy Constraints
- 80/20 execution: prefer high-signal telemetry and quick iteration loops.
- Temporary imbalance is acceptable while observability and evaluator layers are being built.
- Reinforce weak archetypes/skills before nerfing strong ones.
- `FIREMAGE` is current baseline reference for target performance envelope.

## Arcade v1 Content Lock (MVP)
- [x] Locked scope archetypes: `VANGUARD`, `SKIRMISHER`, `FIREMAGE`, `NECROMANCER`, `HUNTER`, `ASSASSIN`.
- [x] Locked scope enemy set: current enemy catalog roster (`footman` through `sentinel`).
- [x] Locked scope terrain: current shipped tile set (`floor/wall/lava/fire/oil/void/stairs/shrine`).
- [x] Locked scope objectives: `TURN_LIMIT`, `HAZARD_CONSTRAINT`.
- [x] Locked scope relics: currently shipped passive relic set.
- [x] Post-lock rule: no new systems before Arcade v1 signoff; only telemetry-driven tuning and bug fixes.

## Non-MVP Queue (Explicitly Deferred)
- [ ] New progression systems (meta economy, guild/MMO layers, persistent ghosts).
- [ ] New subsystem-scale mechanics not required for Arcade v1 loop validation.
- [ ] Additional archetypes/enemy classes beyond current lock.

## Priority A: Observability and Evaluator Coverage
- [x] Add tile/entity evaluator artifacts and trend tracking.
  - Acceptance:
    - [x] Deterministic grade snapshots are committed and diffable.
- [x] Add map/encounter evaluator artifacts and trend tracking.
  - Acceptance:
    - [x] Encounter difficulty bands can be compared against simulation outcomes.
  - Evidence:
    - `artifacts/upa/UPA_EVALUATOR_BASELINES.json`
    - `artifacts/upa/UPA_EVALUATOR_TREND.json`
    - `artifacts/upa/UPA_ENCOUNTER_VALIDATION.json`

## Priority B: Firemage-Dominance Follow-up (Reinforcement-first)
- [x] Tune `FIREMAGE` vs `VANGUARD` dominant pairing.
  - Acceptance:
    - [x] Re-run targeted matchup: `npx tsx packages/engine/scripts/runUpaMatchup.ts 200 60 FIREMAGE VANGUARD heuristic heuristic`
    - [x] Preferred first approach: buff weak-side tools/decision quality before direct firemage nerfs.
- [x] Tune `FIREMAGE` vs `SKIRMISHER` dominant pairing.
- [x] Tune `FIREMAGE` vs `NECROMANCER` dominant pairing.
  - Evidence:
    - `artifacts/upa/UPA_MATCHUP_FIREMAGE_VANGUARD_200x60.json` (acceptance run)
    - `artifacts/upa/UPA_MATCHUP_FIREMAGE_VANGUARD.json` (60-seed fast slice)
    - `artifacts/upa/UPA_MATCHUP_FIREMAGE_SKIRMISHER.json` (60-seed fast slice)
    - `artifacts/upa/UPA_MATCHUP_FIREMAGE_NECROMANCER.json` (60-seed fast slice)
    - Reinforcement changes: `packages/engine/src/systems/combat/trinity-profiles.ts`

## Priority C: Hazard Discipline
- [x] Reduce high hazard-breach archetypes (`NECROMANCER`, `HUNTER`, `ASSASSIN`, `VANGUARD`).
  - Acceptance:
    - [x] `avgHazardBreaches` trend improves in fast deterministic sweeps (full 300-seed pass queued for nightly gate).
  - Evidence:
    - `artifacts/upa/UPA_BALANCE_NECROMANCER_FAST.json`
    - `artifacts/upa/UPA_BALANCE_HUNTER_FAST.json`
    - `artifacts/upa/UPA_BALANCE_ASSASSIN_FAST.json`
    - `artifacts/upa/UPA_BALANCE_VANGUARD_FAST.json`
    - Hazard-discipline evaluator changes: `packages/engine/src/systems/evaluation/balance-harness.ts`

## Priority D: Coverage and Cold Skills
- [x] Keep player-facing policy-blocked set pinned to `AUTO_ATTACK`, `BASIC_MOVE` only.
  - Acceptance:
    - [x] `npm run upa:health:release` passes as the canonical fast health gate.
- [x] Add targeted harness/scenario slices for high-value underutilized player skills.
  - Acceptance:
    - [x] Underutilized count reduced to `0` in fast report without loop-risk increase.
  - Evidence:
    - `artifacts/upa/UPA_SKILL_HEALTH_FAST.json`
    - Skill intent tuning: `packages/engine/src/systems/skill-intent-profile.ts`
    - Labeling refinement for fast-loop triage: `packages/engine/scripts/runSkillHealthReport.ts`

## Priority E: IRES Runtime Reserve Alignment
- [x] Expand live IRES skill derivation to full 49-skill registry coverage.
  - Evidence:
    - `artifacts/ires/IRES_SKILL_BAND_AUDIT.json`
    - `artifacts/ires/IRES_SKILL_BAND_AUDIT.md`
- [x] Correct passive capability/system skills to explicit inert band-derived profiles.
  - Evidence:
    - `packages/engine/src/systems/ires/skill-catalog.ts`
    - `packages/engine/src/systems/evaluation/balance-skill-power.ts`
- [x] Restore scenario runner parity for necromancer summon flows under runtime-derived mana rules.
  - Evidence:
    - `packages/engine/src/scenarios/necromancer.ts`
    - `packages/engine/src/skillTests.ts`
- [x] Align live actor Spark/Mana reserve pools with beat-band runtime costs.
  - Acceptance:
    - [x] Common player and enemy actors sustain their accepted grounded-runtime loops under native reserve pools.
    - [x] Boss/caster signatures remain castable from native runtime pools without one-off scenario overrides.
    - [x] Reserve tuning is validated against `artifacts/ires/IRES_METABOLIC_REPORT.md` and `artifacts/ires/IRES_SKILL_BAND_AUDIT.md`.
  - Evidence:
    - `packages/engine/src/systems/ires/metabolic-config.ts`
    - `packages/engine/src/systems/ires/metabolic-targets.ts`
    - `artifacts/ires/IRES_METABOLIC_REPORT.json`
    - `artifacts/ires/IRES_METABOLIC_REPORT.md`
- [x] Rebaseline AI parity and golden/harness balance envelopes against the runtime-aligned IRES model.
  - Acceptance:
    - [x] `packages/engine/src/__tests__/enemy_ai_parity_corpus.test.ts` matches refreshed expected corpus.
    - [x] `packages/engine/src/__tests__/golden-runs/golden_run.test.ts` reflects current intended run outcomes.
    - [x] `packages/engine/src/__tests__/harness_ai_convergence_regression.test.ts` reflects the accepted post-alignment envelope.
  - Evidence:
    - `packages/engine/src/__tests__/__fixtures__/ai/enemy_decision_corpus/expected_outputs.v1.json`
    - `packages/engine/src/__tests__/enemy_ai_shadow_fallback_rate.test.ts`
    - `packages/engine/src/__tests__/harness_ai_convergence_regression.test.ts`
    - `packages/engine/src/__tests__/golden-runs/fixtures/`
    - `docs/AI_IRES_ALIGNMENT_PLAN.md`

## Release Gate
- [x] Build, scenarios, and health checks are green before merge.
  - Commands:
    - `npm run build`
    - `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts --silent`
    - `npm run upa:health:release`

