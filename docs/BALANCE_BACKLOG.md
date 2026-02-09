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

## Priority A: Observability and Evaluator Coverage
- [ ] Add tile/entity evaluator artifacts and trend tracking.
  - Acceptance:
    - [ ] Deterministic grade snapshots are committed and diffable.
- [ ] Add map/encounter evaluator artifacts and trend tracking.
  - Acceptance:
    - [ ] Encounter difficulty bands can be compared against simulation outcomes.

## Priority B: Firemage-Dominance Follow-up (Reinforcement-first)
- [ ] Tune `FIREMAGE` vs `VANGUARD` dominant pairing.
  - Acceptance:
    - [ ] Re-run targeted matchup: `npx tsx packages/engine/scripts/runUpaMatchup.ts 200 60 FIREMAGE VANGUARD heuristic heuristic`
    - [ ] Preferred first approach: buff weak-side tools/decision quality before direct firemage nerfs.
- [ ] Tune `FIREMAGE` vs `SKIRMISHER` dominant pairing.
- [ ] Tune `FIREMAGE` vs `NECROMANCER` dominant pairing.

## Priority C: Hazard Discipline
- [ ] Reduce high hazard-breach archetypes (`NECROMANCER`, `HUNTER`, `ASSASSIN`, `VANGUARD`).
  - Acceptance:
    - [ ] `avgHazardBreaches` trend improves against `docs/UPA_CALIBRATION_BASELINE.json` in refreshed 300-seed run.

## Priority D: Coverage and Cold Skills
- [ ] Keep player-facing policy-blocked set pinned to `AUTO_ATTACK`, `BASIC_MOVE` only.
  - Acceptance:
    - [ ] `npm run upa:health:check` passes.
- [ ] Add targeted harness/scenario slices for high-value underutilized player skills.
  - Acceptance:
    - [ ] Underutilized count decreases in `docs/UPA_SKILL_HEALTH.json` without introducing loop-risk tags.

## Release Gate
- [ ] Build, scenarios, and health checks are green before merge.
  - Commands:
    - `npm run build`
    - `npx vitest run packages/engine/src/__tests__/scenarios_runner.test.ts --silent`
    - `npm run upa:health:check`
