# UPA Guide

Roadmap docs:
- Active tracker: `docs/NEXT_LEVEL.md`
- Backlog: `docs/BALANCE_BACKLOG.md`
- Historical milestones: `docs/ROADMAP_HISTORY.md`

## Purpose
UPA (Unified Power Assessment) is the telemetry score derived from simulation summaries.  
Use it to compare policies, loadout IDs, and head-to-head archetype performance under deterministic seeds.

## Prerequisites
- Run commands from repo root.
- Use `tsx` to execute TypeScript scripts directly:
  - `npx tsx ...`

## Core Scripts

### 1) Outlier + UPA report
Script: `packages/engine/scripts/runUpaOutlierAnalysis.ts`

Command:
```bash
npx tsx packages/engine/scripts/runUpaOutlierAnalysis.ts <count> <maxTurns> <loadoutId>
```

Arguments:
- `count` (default: `1000`)
- `maxTurns` (default: `80`)
- `loadoutId` (default: `VANGUARD`)

Behavior:
- Runs both policies (`random`, `heuristic`) on same loadout.
- Outputs JSON with:
  - `summary`
  - `upa`
  - strongest/weakest outlier seeds
  - skill-usage telemetry (`actionTypeTotals`, `skillUsageTotals`, `avgSkillUsagePerRun`, `avgPlayerSkillCastsPerRun`)

Quiet mode:
- Default is quiet (suppresses engine logs).
- Set `VERBOSE_ANALYSIS=1` to include verbose logs.

### 2) Quick harness summary
Script: `packages/engine/scripts/runBalanceHarness.ts`

Command:
```bash
npx tsx packages/engine/scripts/runBalanceHarness.ts <count> <maxTurns> <loadoutId>
```

Arguments:
- `count` (default: `20`)
- `maxTurns` (default: `80`)
- `loadoutId` (default: `VANGUARD`)

Behavior:
- Runs `random` and `heuristic`.
- Returns compact JSON summaries for both policies, including skill-usage metrics.

### 3) Head-to-head archetype matchup (PvE run comparison)
Script: `packages/engine/scripts/runUpaMatchup.ts`

Command:
```bash
npx tsx packages/engine/scripts/runUpaMatchup.ts <count> <maxTurns> <leftLoadoutId> <rightLoadoutId> <leftPolicy> <rightPolicy>
```

Arguments:
- `count` (default: `200`)
- `maxTurns` (default: `80`)
- `leftLoadoutId` (default: `VANGUARD`)
- `rightLoadoutId` (default: `FIREMAGE`)
- `leftPolicy` (default: `heuristic`)
- `rightPolicy` (default: `heuristic`)

Behavior:
- Runs both sides on identical seeds.
- Outputs:
  - `left` and `right` summaries + UPA
  - `matchup.summary` with `leftWins/rightWins/ties`
- seed sample with per-seed winner

Quiet mode:
- Default is quiet.
- Set `VERBOSE_ANALYSIS=1` for verbose logs.

### 4) Dedicated PvP UPA system (duel arena)
Script: `packages/engine/scripts/runPvpUpa.ts`

Command:
```bash
npx tsx packages/engine/scripts/runPvpUpa.ts <count> <maxRounds> <leftLoadoutId> <rightLoadoutId> <leftPolicy> <rightPolicy>
```

Arguments:
- `count` (default: `200`)
- `maxRounds` (default: `60`)
- `leftLoadoutId` (default: `VANGUARD`)
- `rightLoadoutId` (default: `HUNTER`)
- `leftPolicy` (default: `heuristic`)
- `rightPolicy` (default: `heuristic`)

Behavior:
- Runs deterministic duel simulations (left archetype vs right archetype) in a clean floor arena.
- Outputs:
  - per-side PvP score (`pvpUpa`)
  - duel summary (`leftWins`, `rightWins`, `draws`, average remaining HP, action totals, skill usage totals)
  - sample per-seed outcomes

Quiet mode:
- Default is quiet.
- Set `VERBOSE_ANALYSIS=1` for verbose logs.

### 5) Calibration baseline (all archetypes)
Script: `packages/engine/scripts/runUpaCalibration.ts`

Command:
```bash
npx tsx packages/engine/scripts/runUpaCalibration.ts <count> <maxTurns> <policy> <outFile> [waiverCsv] [strict]
```

Recommended:
```bash
npm run upa:calibration
```

Behavior:
- Runs all archetypes with one fixed policy/version and emits per-archetype baseline metrics.
- Includes guardrail checks and `unwaivedBreachCount`.
- Use `strict=1` to return non-zero on unwaived breaches.

### 6) Full archetype matchup matrix
Script: `packages/engine/scripts/runUpaMatchupMatrix.ts`

Command:
```bash
npx tsx packages/engine/scripts/runUpaMatchupMatrix.ts <count> <maxTurns> <outFile> <policy>
```

Recommended:
```bash
npm run upa:matrix
```

Behavior:
- Runs all ordered archetype pairs (`A vs B`) under one policy.
- Emits matrix cell stats and top imbalance candidates.

## Allowed Values

### Policies
- `random`
- `heuristic`

### Loadout IDs
- `VANGUARD`
- `SKIRMISHER`
- `FIREMAGE`
- `NECROMANCER`
- `HUNTER`
- `ASSASSIN`

## Useful Examples

### Standard UPA report (Firemage)
```bash
npx tsx packages/engine/scripts/runUpaOutlierAnalysis.ts 1000 80 FIREMAGE
```

### Quick sanity check (Necromancer)
```bash
npx tsx packages/engine/scripts/runBalanceHarness.ts 100 60 NECROMANCER
```

### Vanguard vs Hunter (heuristic vs heuristic)
```bash
npx tsx packages/engine/scripts/runUpaMatchup.ts 300 80 VANGUARD HUNTER heuristic heuristic
```

### Firemage vs Necromancer (heuristic vs random)
```bash
npx tsx packages/engine/scripts/runUpaMatchup.ts 300 80 FIREMAGE NECROMANCER heuristic random
```

### Dedicated PvP duel run (Vanguard vs Hunter)
```bash
npx tsx packages/engine/scripts/runPvpUpa.ts 300 60 VANGUARD HUNTER heuristic heuristic
```

### Save output to file (PowerShell)
```powershell
npx tsx packages/engine/scripts/runUpaOutlierAnalysis.ts 1000 80 VANGUARD | Out-File docs/UPA_REPORT_VANGUARD.json -Encoding utf8
```

## Reading the New Skill Telemetry

Key fields in `summary`:
- `actionTypeTotals`: total player action counts by type.
- `skillUsageTotals`: total casts per skill ID across all runs.
- `avgSkillUsagePerRun`: average casts per run per skill.
- `avgPlayerSkillCastsPerRun`: overall average number of skill casts per run.

Use these to validate whether a loadout is truly using its kit, or over-indexing on fallback actions like `MOVE` and `BASIC_ATTACK`.

Dynamic grade fields per skill:
- `numericGradeRaw`: pre-normalization dynamic grade.
- `rolePreset`: role context chosen from profile (`damage`, `control`, `mobility`, `sustain`).
- `roleAdjustedGrade`: role-normalized grade (also exposed as `numericGrade`).

## Notes
- Simulations are deterministic for the same seed list + policy + loadout.
- Simulations are deterministic for the same seed list + policy + loadout ID.
- UPA is telemetry-only and not used to gate gameplay outcomes.

## Numeric Skill Grades (No Ceiling)

Grading rule for current roadmap:
- Skill grades are pure numbers only.
- No stars, tiers, medals, or capped scales.
- Higher value means stronger overall utility under the current model version.

Recommended split:
- `staticNumericGrade`: computed from `SkillIntentProfile` metadata.
- `dynamicNumericGrade`: computed from simulation telemetry (UPA/harness outputs).

Suggested artifact names:
- `docs/UPA_SKILL_GRADES_STATIC.json`
- `docs/UPA_SKILL_GRADES_DYNAMIC.json`
- `docs/UPA_SKILL_GRADE_DRIFT.json`

Interpretation guidance:
- Use static grade for design-time comparisons before playtests.
- Use dynamic grade to validate real behavior under deterministic simulation.
- Use drift (`dynamic - static`) to find hidden synergies, no-op traps, or overtuned skills.

Contribution rule:
- If a skill stat/profile changes, regenerate `docs/UPA_SKILL_GRADES_STATIC.json`.
- If a skill behavior/targeting/execution rule changes, rerun dynamic grading and drift artifacts.

### Grade generation commands

Static numeric grades (all registered skills):
```bash
npx tsx packages/engine/scripts/runSkillGradesStatic.ts p6-static-v1 docs/UPA_SKILL_GRADES_STATIC.json
```

Dynamic numeric grades (single loadout):
```bash
npx tsx packages/engine/scripts/runSkillGradesDynamic.ts 300 80 heuristic VANGUARD docs/UPA_SKILL_GRADES_DYNAMIC.json
```

Dynamic numeric grades (all loadouts):
```bash
npx tsx packages/engine/scripts/runSkillGradesDynamic.ts 300 80 heuristic ALL docs/UPA_SKILL_GRADES_DYNAMIC.json
```

Static vs dynamic drift report:
```bash
npx tsx packages/engine/scripts/runSkillGradeDrift.ts docs/UPA_SKILL_GRADES_STATIC.json docs/UPA_SKILL_GRADES_DYNAMIC.json docs/UPA_SKILL_GRADE_DRIFT.json
```

Quiet/verbose behavior:
- `runSkillGradesDynamic.ts` is quiet by default.
- Set `VERBOSE_ANALYSIS=1` to print full engine logs during runs.

### One-command local flow
PowerShell:
```powershell
npx tsx packages/engine/scripts/runSkillGradesStatic.ts p6-static-v1 docs/UPA_SKILL_GRADES_STATIC.json; `
npx tsx packages/engine/scripts/runSkillGradesDynamic.ts 300 80 heuristic ALL docs/UPA_SKILL_GRADES_DYNAMIC.json; `
npx tsx packages/engine/scripts/runSkillGradeDrift.ts docs/UPA_SKILL_GRADES_STATIC.json docs/UPA_SKILL_GRADES_DYNAMIC.json docs/UPA_SKILL_GRADE_DRIFT.json
```

NPM shortcut:
```bash
npm run upa:grades:all
```

## Skill Health Report

Generate skill health labels (`effective`, `underutilized`, `loop-risk`, `spam-inflated`, `policy-blocked`, `no-data`):
```bash
npx tsx packages/engine/scripts/runSkillHealthReport.ts 80 60 docs/UPA_SKILL_HEALTH_2026-02-09.json
```

NPM shortcut:
```bash
npm run upa:health
```

Threshold mode (non-zero exit if exceeded):
```bash
npx tsx packages/engine/scripts/runSkillHealthReport.ts 80 60 docs/UPA_SKILL_HEALTH_2026-02-09.json 0 0 2
```
Where:
- arg5 = `maxLoopRisk` (set `0` to fail if any loop-risk labels exist)
- arg6 = `maxFailures` (set `0` to fail if any archetype run failures exist)
- arg7 = `maxPlayerFacingNoData` (set to `2` to allow only baseline `AUTO_ATTACK` + `BASIC_MOVE` policy-blocked entries)

## CI Automation

PR gate:
- `.github/workflows/upa-grade-pr-check.yml`
- Regenerates static grades and fails the PR if `docs/UPA_SKILL_GRADES_STATIC.json` is stale.
- Prints static-grade diff in CI logs for review.
- Runs health thresholds via `npm run upa:health:check` and uploads `docs/UPA_SKILL_HEALTH.json`.
- Runs calibration threshold summary via `npm run upa:calibration:check` (warn-only in PR workflow).

Nightly refresh:
- `.github/workflows/upa-grade-nightly.yml`
- Generates static/dynamic/drift artifacts on a schedule and uploads them as CI artifacts.
- Also generates and uploads:
  - `docs/UPA_SKILL_HEALTH.json`
  - `docs/UPA_CALIBRATION_BASELINE.json`
  - `docs/UPA_PVP_MATCHUP_MATRIX.json`
