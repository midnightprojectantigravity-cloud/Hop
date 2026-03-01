# Balance Backlog

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
    - [x] `npm run upa:health:check` passes (`loopRiskCount=0`, `failures=0`, `playerFacingNoDataCount=1`).
- [x] Add targeted harness/scenario slices for high-value underutilized player skills.
  - Acceptance:
    - [x] Underutilized count reduced to `0` in fast report without loop-risk increase.
  - Evidence:
    - `artifacts/upa/UPA_SKILL_HEALTH_FAST.json`
    - Skill intent tuning: `packages/engine/src/systems/skill-intent-profile.ts`
    - Labeling refinement for fast-loop triage: `packages/engine/scripts/runSkillHealthReport.ts`

## Release Gate
- [x] Build, scenarios, and health checks are green before merge.
  - Commands:
    - `npm run build`
    - `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts --silent`
    - `npm run upa:health:check`
