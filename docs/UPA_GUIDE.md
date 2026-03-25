# UPA Guide

Roadmap docs:
- Active tracker: `docs/NEXT_LEVEL.md`
- Backlog: `docs/BALANCE_BACKLOG.md`
- Historical milestones: `docs/ROADMAP_HISTORY.md`
- AI convergence milestone: `docs/archive/AI_CONVERGENCE_MILESTONE_2026-02-28.md`

Artifact policy:
- Stable/reference reports can stay in `docs/`.
- Generated test/audit run outputs should go to `artifacts/upa/`.

## Purpose
UPA (Unified Power Assessment) is the telemetry score derived from simulation summaries.  
Use it to compare policies, loadout IDs, and head-to-head archetype performance under deterministic seeds.

## Prerequisites
- Run commands from repo root.
- Use `tsx` to execute TypeScript scripts directly:
  - `npx tsx ...`
- For stable CI-style runs, use non-watch test commands:
  - `npm --workspace @hop/engine run test:ai-acceptance:strict`
  - `npm --workspace @hop/web run test:run`

## AI Convergence Gate (Recommended Before AI Changes)

1. Build + import integrity
- `npm --workspace @hop/engine run build`
- `npm --workspace @hop/engine run check-script-imports`

2. Strict AI acceptance suite
- `npm --workspace @hop/engine run test:ai-acceptance:strict`

3. Web non-watch tests
- `npm --workspace @hop/web run test:run`

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
- `policyProfileId` (optional, default: `sp-v1-default`; heuristic runs only)

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
npx tsx packages/engine/scripts/runBalanceHarness.ts <count> <maxTurns> <loadoutId> [policyProfileId]
```

Arguments:
- `count` (default: `20`)
- `maxTurns` (default: `80`)
- `loadoutId` (default: `VANGUARD`)
- `policyProfileId` (optional, default: `sp-v1-default`; heuristic side only)

Behavior:
- Runs `random` and `heuristic`.
- Returns compact JSON summaries for both policies, including skill-usage metrics.

### 3) Head-to-head archetype matchup (PvE run comparison)
Script: `packages/engine/scripts/runUpaMatchup.ts`

Command:
```bash
npx tsx packages/engine/scripts/runUpaMatchup.ts <count> <maxTurns> <leftLoadoutId> <rightLoadoutId> <leftPolicy> <rightPolicy> [leftPolicyProfileId] [rightPolicyProfileId]
```

Arguments:
- `count` (default: `200`)
- `maxTurns` (default: `80`)
- `leftLoadoutId` (default: `VANGUARD`)
- `rightLoadoutId` (default: `FIREMAGE`)
- `leftPolicy` (default: `heuristic`)
- `rightPolicy` (default: `heuristic`)
- `leftPolicyProfileId` (optional, default: `sp-v1-default`)
- `rightPolicyProfileId` (optional, default: `sp-v1-default`)

Behavior:
- Runs both sides on identical seeds.
- Outputs:
  - `left` and `right` summaries + UPA
  - `matchup.summary` with `leftWins/rightWins/ties`
- seed sample with per-seed winner

### 3.1) Strategic policy profile compare (fixed-seed A/B)
Script: `packages/engine/scripts/runPolicyProfileCompare.ts`

Command:
```bash
npx tsx packages/engine/scripts/runPolicyProfileCompare.ts <count> <maxTurns> <loadoutId> <profileA> <profileB>
```

NPM shortcut:
```bash
npm run upa:policy:compare
```

Default profile IDs:
- `sp-v1-default`
- `sp-v1-aggro`

Quiet mode:
- Default is quiet.
- Set `VERBOSE_ANALYSIS=1` for verbose logs.

Triangle interaction telemetry mode:
- Set `HOP_COMBAT_INTERACTION_MODEL=triangle` to enable attacker-vs-defender trinity interaction formulas.
- Example (PowerShell):
```powershell
$env:HOP_COMBAT_INTERACTION_MODEL='triangle'; npx tsx packages/engine/scripts/runUpaMatchup.ts 120 60 VANGUARD HUNTER heuristic heuristic sp-v1-default sp-v1-aggro
```
- In this mode, matchup summaries include non-zero `summary.triangleSignal` fields:
  - `avgHitPressure`
  - `avgMitigationPressure`
  - `avgCritPressure`
  - `avgResistancePressure`

Trinity runtime profile:
- Trinity profile env overrides are retired.
- The integrated runtime uses one shipped profile set: `core-v2-live`.

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

### 7) Unified evaluator baselines (`skill`, `entity`, `tile`, `map`, `encounter`)
Script: `packages/engine/scripts/runEvaluatorBaselines.ts`

Command:
```bash
npx tsx packages/engine/scripts/runEvaluatorBaselines.ts <outFile> <modelVersion>
```

Recommended:
```bash
npm run upa:evaluators
npm run upa:evaluators:trend
```

Behavior:
- Emits deterministic baseline grades for:
  - tile definitions (from tile registry),
  - loadout entities,
  - enemy archetypes,
  - sample generated maps,
  - sample encounters.
- Default artifact: `artifacts/upa/UPA_EVALUATOR_BASELINES.json`
- Trend artifact: `artifacts/upa/UPA_EVALUATOR_TREND.json`

### 8) Calibration snapshots and diffs
Scripts:
- `packages/engine/scripts/runCalibrationSnapshot.ts`
- `packages/engine/scripts/runCalibrationDiff.ts`
- `packages/engine/scripts/runCalibrationCompare.ts`

Commands:
```bash
npx tsx packages/engine/scripts/runCalibrationSnapshot.ts artifacts/upa/UPA_CALIBRATION_SNAPSHOT_BEFORE.json cal-v1 uel-v1
npx tsx packages/engine/scripts/runCalibrationSnapshot.ts artifacts/upa/UPA_CALIBRATION_SNAPSHOT_AFTER.json cal-v1-firemage-baseline uel-v1
npx tsx packages/engine/scripts/runCalibrationDiff.ts artifacts/upa/UPA_CALIBRATION_SNAPSHOT_BEFORE.json artifacts/upa/UPA_CALIBRATION_SNAPSHOT_AFTER.json artifacts/upa/UPA_CALIBRATION_DIFF.json
npx tsx packages/engine/scripts/runCalibrationCompare.ts cal-v1 cal-v1-firemage-baseline uel-v1 artifacts/upa/UPA_CALIBRATION_COMPARE.json
```

NPM shortcuts:
```bash
npm run upa:calibration:snapshot
npm run upa:calibration:diff
npm run upa:calibration:compare
```

### 9) Challenge design and encounter validation
Scripts:
- `packages/engine/scripts/runChallengeDesign.ts`
- `packages/engine/scripts/runEncounterValidation.ts`

NPM shortcuts:
```bash
npm run upa:challenge:design
npm run upa:encounter:validate
```

Artifacts:
- `artifacts/upa/UPA_CHALLENGE_DESIGN_REPORT.json`
- `artifacts/upa/UPA_ENCOUNTER_VALIDATION.json`

### 10) Skill formula-path audit
Script: `packages/engine/scripts/runSkillFormulaAudit.ts`

Command:
```bash
npx tsx packages/engine/scripts/runSkillFormulaAudit.ts artifacts/upa/UPA_SKILL_FORMULA_AUDIT.json
```

NPM shortcut:
```bash
npm run upa:skills:audit
```

### 10.1) Skill migration audit (`Damage -> calculateCombat` contract)
Script: `packages/engine/scripts/runSkillMigrationAudit.ts`

Command:
```bash
npx tsx packages/engine/scripts/runSkillMigrationAudit.ts artifacts/upa/UPA_SKILL_MIGRATION_AUDIT.json
```

NPM shortcut:
```bash
npm run upa:skills:migration:audit
```

Behavior:
- Fails if a skill emits direct `Damage` without `calculateCombat`.
- Fails if direct trinity math patterns are found in skill files.

### 11) Trinity contribution report (archetype + matchup tables)
Script: `packages/engine/scripts/runTrinityContributionReport.ts`

Command:
```bash
npx tsx packages/engine/scripts/runTrinityContributionReport.ts <count> <maxTurns> <outFile>
```

NPM shortcut:
```bash
npm run upa:trinity:report
```

Default artifact:
- `artifacts/upa/UPA_TRINITY_CONTRIBUTIONS.json`

### 12) Trinity runtime artifact ownership
The integrated runtime no longer supports profile A/B comparison through ambient env toggles.

Current contract:
1. One Trinity content set ships: `core-v2-live`.
2. Balance comparisons should compare candidate coefficients/content against accepted baselines, not alternate runtime profiles.

### 13) MVP baseline snapshot (`mvp-v1`)
Script: `packages/engine/scripts/runMvpBaseline.ts`

Command:
```bash
npx tsx packages/engine/scripts/runMvpBaseline.ts artifacts/upa/MVP_SEEDS_mvp-v1.json 80 heuristic artifacts/upa/MVP_BASELINE_mvp-v1.json
```

NPM shortcut:
```bash
npm run mvp:baseline
```

Artifacts:
- `artifacts/upa/MVP_SEEDS_mvp-v1.json`
- `artifacts/upa/MVP_BASELINE_mvp-v1.json`

### 14) MVP deterministic gate
Command:
```bash
npm run mvp:gate
```

Includes:
- engine build
- web build
- `scenarios_runner` gate
- replay parity gate
- timeline sequencing/blocking-budget audit
- skill-health smoke threshold gate

### 15) Timeline sequencing audit
Script: `packages/engine/scripts/runTimelineAudit.ts`

Command:
```bash
npx tsx packages/engine/scripts/runTimelineAudit.ts 20 80 artifacts/upa/UPA_TIMELINE_AUDIT.json 1500 1
```

NPM shortcut:
```bash
npm run mvp:timeline:audit
```

Strict mode (diagnostic fail-gate):
```bash
npm run mvp:timeline:audit:strict
```

Checks:
- phase ordering within each timeline group
- `MOVE_START` -> `MOVE_END` completeness
- no `HAZARD_CHECK`/`DAMAGE_APPLY` before `MOVE_END`
- blocking duration budget per group

### 16) Cross-archetype message consistency audit
Script: `packages/engine/scripts/runUpaMessageAudit.ts`

Command:
```bash
npx tsx packages/engine/scripts/runUpaMessageAudit.ts 8 60 artifacts/upa/UPA_MESSAGE_AUDIT.json 2500
```

Checks:
- all emitted messages are tagged (`[LEVEL|CHANNEL]`)
- jump message order vs stun messages in same step
- stunned actor is not also reported attacking in same step
- duplicate/spam message bursts
- target preview mismatch errors surfacing in logs

Artifact:
- `artifacts/upa/UPA_MESSAGE_AUDIT.json`

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
npx tsx packages/engine/scripts/runUpaOutlierAnalysis.ts 1000 80 VANGUARD | Out-File artifacts/upa/UPA_REPORT_VANGUARD.json -Encoding utf8
```

## Reading the New Skill Telemetry

Key fields in `summary`:
- `actionTypeTotals`: total player action counts by type.
- `skillUsageTotals`: total casts per skill ID across all runs.
- `avgSkillUsagePerRun`: average casts per run per skill.
- `avgPlayerSkillCastsPerRun`: overall average number of skill casts per run.
- `strategicIntentTotals`: total intent posture counts (`offense`, `defense`, `positioning`, `control`).
- `avgStrategicIntentPerRun`: average intent posture counts per run.
- `trinityContribution`: averaged trinity leverage terms from combat events:
  - `bodyContribution`
  - `mindContribution`
  - `instinctContribution`
- `combatProfileSignal`: averaged trait multipliers applied at damage resolution:
  - `avgOutgoingMultiplier`
  - `avgIncomingMultiplier`
  - `avgTotalMultiplier`

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
- `artifacts/upa/UPA_SKILL_GRADES_STATIC.json`
- `artifacts/upa/UPA_SKILL_GRADES_DYNAMIC.json`
- `artifacts/upa/UPA_SKILL_GRADE_DRIFT.json`

Interpretation guidance:
- Use static grade for design-time comparisons before playtests.
- Use dynamic grade to validate real behavior under deterministic simulation.
- Use drift (`dynamic - static`) to find hidden synergies, no-op traps, or overtuned skills.

Contribution rule:
- If a skill stat/profile changes, regenerate `artifacts/upa/UPA_SKILL_GRADES_STATIC.json`.
- If a skill behavior/targeting/execution rule changes, rerun dynamic grading and drift artifacts.

### Grade generation commands

Static numeric grades (all registered skills):
```bash
npx tsx packages/engine/scripts/runSkillGradesStatic.ts p6-static-v1 artifacts/upa/UPA_SKILL_GRADES_STATIC.json
```

Dynamic numeric grades (single loadout):
```bash
npx tsx packages/engine/scripts/runSkillGradesDynamic.ts 300 80 heuristic VANGUARD artifacts/upa/UPA_SKILL_GRADES_DYNAMIC.json
```

Dynamic numeric grades (all loadouts):
```bash
npx tsx packages/engine/scripts/runSkillGradesDynamic.ts 300 80 heuristic ALL artifacts/upa/UPA_SKILL_GRADES_DYNAMIC.json
```

Static vs dynamic drift report:
```bash
npx tsx packages/engine/scripts/runSkillGradeDrift.ts artifacts/upa/UPA_SKILL_GRADES_STATIC.json artifacts/upa/UPA_SKILL_GRADES_DYNAMIC.json artifacts/upa/UPA_SKILL_GRADE_DRIFT.json
```

Quiet/verbose behavior:
- `runSkillGradesDynamic.ts` is quiet by default.
- Set `VERBOSE_ANALYSIS=1` to print full engine logs during runs.

### One-command local flow
PowerShell:
```powershell
npx tsx packages/engine/scripts/runSkillGradesStatic.ts p6-static-v1 artifacts/upa/UPA_SKILL_GRADES_STATIC.json; `
npx tsx packages/engine/scripts/runSkillGradesDynamic.ts 300 80 heuristic ALL artifacts/upa/UPA_SKILL_GRADES_DYNAMIC.json; `
npx tsx packages/engine/scripts/runSkillGradeDrift.ts artifacts/upa/UPA_SKILL_GRADES_STATIC.json artifacts/upa/UPA_SKILL_GRADES_DYNAMIC.json artifacts/upa/UPA_SKILL_GRADE_DRIFT.json
```

NPM shortcut:
```bash
npm run upa:grades:all
```

Evaluator baseline generation:
```bash
npm run upa:evaluators
```

## Skill Health Report

Generate skill health labels (`effective`, `underutilized`, `loop-risk`, `spam-inflated`, `policy-blocked`, `no-data`):
```bash
npx tsx packages/engine/scripts/runSkillHealthReport.ts full docs/UPA_SKILL_HEALTH_2026-02-09.json
```

The report now includes per-loadout `pacingSignal` telemetry:
- `avgSparkRatio`
- `avgManaRatio`
- `avgReservePressure`
- `avgFatiguePressure`
- `avgRecoveryPressure`
- `restSelections`
- `endTurnSelections`
- `continuedActionSelections`

NPM shortcut:
```bash
npm run upa:health
```

Threshold mode (non-zero exit if exceeded):
```bash
npx tsx packages/engine/scripts/runSkillHealthReport.ts check docs/UPA_SKILL_HEALTH_2026-02-09.json
```
Smoke gate mode (bounded CI/runtime-friendly sweep):
```bash
npx tsx packages/engine/scripts/runSkillHealthReport.ts smoke artifacts/upa/UPA_SKILL_HEALTH.json
```

Modes:
- `full`: offline analysis sweep, no threshold failure caps
- `check`: full sweep with strict thresholds (`loopRisk=0`, `failures=0`, `playerFacingNoData=2`)
- `smoke`: bounded gate sweep with relaxed no-data tolerance for CI practicality (`loopRisk=2`, `failures=0`, `playerFacingNoData=20`)

## CI Automation

PR gate:
- `.github/workflows/upa-grade-pr-check.yml`
- Regenerates static grades and fails the PR if `docs/UPA_SKILL_GRADES_STATIC.json` is stale.
- Prints static-grade diff in CI logs for review.
- Uses `npm run upa:health:release` as the canonical fast release report.
- Uses `npm run upa:health:full` for deep offline health analysis.
- Runs calibration threshold summary via `npm run upa:calibration:check` (warn-only in PR workflow).

Nightly refresh:
- `.github/workflows/upa-grade-nightly.yml`
- Generates static/dynamic/drift artifacts on a schedule and uploads them as CI artifacts.
- Also generates and uploads:
  - `artifacts/upa/UPA_SKILL_HEALTH.json`
  - `artifacts/upa/UPA_CALIBRATION_BASELINE.json`
  - `docs/UPA_PVP_MATCHUP_MATRIX.json`
  - `artifacts/upa/UPA_EVALUATOR_BASELINES.json`
  - `artifacts/upa/UPA_EVALUATOR_TREND.json`

