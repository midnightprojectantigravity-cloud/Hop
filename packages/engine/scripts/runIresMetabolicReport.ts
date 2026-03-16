import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildIresMetabolicAnalysisReport } from '../src/systems/evaluation/ires-metabolic-analysis';

const round3 = (value: number): string => value.toFixed(3);

const findResult = (
    report: ReturnType<typeof buildIresMetabolicAnalysisReport>,
    profileId: string,
    workloadId: string
) => report.results.find((row) => row.profileId === profileId && row.workloadId === workloadId);

const appendResultTable = (
    lines: string[],
    title: string,
    rows: Array<{ label: string; avg: number; rest: number | null; peak: number; burn?: number | null }>
) => {
    lines.push(`## ${title}`);
    lines.push('');
    lines.push('| Scenario | Avg Events / Beat (5) | First Rest | Peak EX (5) | First Burn |');
    lines.push('| --- | ---: | ---: | ---: | ---: |');
    rows.forEach((row) => {
        lines.push(`| ${row.label} | ${round3(row.avg)} | ${row.rest ?? '-'} | ${round3(row.peak)} | ${row.burn ?? '-'} |`);
    });
    lines.push('');
};

const toMarkdown = (report: ReturnType<typeof buildIresMetabolicAnalysisReport>): string => {
    const lines: string[] = [];
    lines.push('# IRES Metabolic Report');
    lines.push('');
    lines.push('The turn window is the beat.');
    lines.push('Spells are Mana-only plus BFI tax by default.');
    lines.push('Movement is Spark plus BFI.');
    lines.push('Passive recovery and passive exhaustion bleed happen every beat. WAIT adds extra reset on top.');
    lines.push('');
    lines.push('## Band Catalog');
    lines.push('');
    lines.push('| Band | Spark | Mana | Base EX | Intended Use |');
    lines.push('| --- | ---: | ---: | ---: | --- |');
    Object.values(report.config.actionBands).forEach((band) => {
        lines.push(`| ${band.id} | ${band.sparkCost} | ${band.manaCost} | ${band.baseExhaustion} | ${band.intendedUse} |`);
    });
    lines.push('');
    lines.push('## Beat Anchors');
    lines.push('');
    lines.push('- `BASIC_MOVE x1 = walking`');
    lines.push('- `BASIC_MOVE x2 = running`');
    lines.push('- `BASIC_MOVE x3 = sprint / overdrive`');
    lines.push('');
    lines.push('## Recovery Model');
    lines.push('');
    lines.push(`- passive Spark recovery base: ${report.config.sparkRecoveryFormula.base}`);
    lines.push(`- passive Mana recovery base: ${report.config.manaRecoveryFormula.base}`);
    lines.push(`- passive base Exhaustion bleed: ${report.config.exhaustionBleedByState.base.base}`);
    lines.push(`- WAIT Spark bonus: ${report.config.waitSparkBonus}`);
    lines.push(`- WAIT Exhaustion bonus: ${report.config.waitExhaustionBonus}`);
    lines.push('');
    lines.push('## Target Outcomes');
    lines.push('');
    lines.push('| Target | Passed | Score | Details |');
    lines.push('| --- | --- | ---: | --- |');
    report.targetOutcomes.forEach((outcome) => {
        lines.push(`| ${outcome.id} | ${outcome.passed ? 'yes' : 'no'} | ${outcome.score.toFixed(3)} | ${outcome.details} |`);
    });
    lines.push('');

    const walking = findResult(report, 'balanced_mid_standard', 'basic_move_x1');
    const running = findResult(report, 'balanced_mid_standard', 'basic_move_x2');
    const sprinting = findResult(report, 'balanced_mid_standard', 'basic_move_x3');
    appendResultTable(lines, 'Walking / Running / Sprinting', [
        {
            label: 'Balanced Mid Standard / BASIC_MOVE x1',
            avg: walking?.avgActionsPerTurnOpening5 || 0,
            rest: walking?.firstRestTurn || null,
            peak: walking?.peakExhaustionOpening5 || 0,
            burn: walking?.firstImmediateBurnTurn || null
        },
        {
            label: 'Balanced Mid Standard / BASIC_MOVE x2',
            avg: running?.avgActionsPerTurnOpening5 || 0,
            rest: running?.firstRestTurn || null,
            peak: running?.peakExhaustionOpening5 || 0,
            burn: running?.firstImmediateBurnTurn || null
        },
        {
            label: 'Balanced Mid Standard / BASIC_MOVE x3',
            avg: sprinting?.avgActionsPerTurnOpening5 || 0,
            rest: sprinting?.firstRestTurn || null,
            peak: sprinting?.peakExhaustionOpening5 || 0,
            burn: sprinting?.firstImmediateBurnTurn || null
        }
    ]);

    const bodyRun = findResult(report, 'body_mid_standard', 'basic_move_x2');
    const instinctRun = findResult(report, 'instinct_mid_standard', 'basic_move_x2');
    appendResultTable(lines, 'Body Vs Instinct', [
        {
            label: 'Body Mid Standard / BASIC_MOVE x2',
            avg: bodyRun?.avgActionsPerTurnOpening5 || 0,
            rest: bodyRun?.firstRestTurn || null,
            peak: bodyRun?.peakExhaustionOpening5 || 0,
            burn: bodyRun?.firstImmediateBurnTurn || null
        },
        {
            label: 'Instinct Mid Standard / BASIC_MOVE x2',
            avg: instinctRun?.avgActionsPerTurnOpening5 || 0,
            rest: instinctRun?.firstRestTurn || null,
            peak: instinctRun?.peakExhaustionOpening5 || 0,
            burn: instinctRun?.firstImmediateBurnTurn || null
        }
    ]);

    const mindHeavy = findResult(report, 'mind_mid_heavy', 'heavy_mind_battleline');
    const mindCast = findResult(report, 'mind_mid_standard', 'basic_move_then_standard_cast');
    const instinctCast = findResult(report, 'instinct_mid_standard', 'basic_move_then_standard_cast');
    appendResultTable(lines, 'Mind Vs Instinct', [
        {
            label: 'Mind Mid Standard / BASIC_MOVE Then Standard Cast',
            avg: mindCast?.avgActionsPerTurnOpening5 || 0,
            rest: mindCast?.firstRestTurn || null,
            peak: mindCast?.peakExhaustionOpening5 || 0,
            burn: mindCast?.firstImmediateBurnTurn || null
        },
        {
            label: 'Instinct Mid Standard / BASIC_MOVE Then Standard Cast',
            avg: instinctCast?.avgActionsPerTurnOpening5 || 0,
            rest: instinctCast?.firstRestTurn || null,
            peak: instinctCast?.peakExhaustionOpening5 || 0,
            burn: instinctCast?.firstImmediateBurnTurn || null
        }
    ]);

    lines.push('## Heavy Mind Move+Cast');
    lines.push('');
    if (mindHeavy) {
        lines.push(`- first failure mode: ${mindHeavy.firstFailureMode}`);
        lines.push(`- movement share of Spark spend: ${round3(mindHeavy.movementShareOfSparkSpend)}`);
        lines.push(`- opening 5 avg events per beat: ${round3(mindHeavy.avgActionsPerTurnOpening5)}`);
    }
    lines.push('');

    const lightMoveAttack = findResult(report, 'balanced_mid_light', 'basic_move_then_standard_attack');
    const standardMoveAttack = findResult(report, 'balanced_mid_standard', 'basic_move_then_standard_attack');
    const heavyMoveAttack = findResult(report, 'balanced_mid_heavy', 'basic_move_then_standard_attack');
    appendResultTable(lines, 'Light Vs Standard Vs Heavy', [
        {
            label: 'Balanced Mid Light / BASIC_MOVE Then Standard Attack',
            avg: lightMoveAttack?.avgActionsPerTurnOpening5 || 0,
            rest: lightMoveAttack?.firstRestTurn || null,
            peak: lightMoveAttack?.peakExhaustionOpening5 || 0,
            burn: lightMoveAttack?.firstImmediateBurnTurn || null
        },
        {
            label: 'Balanced Mid Standard / BASIC_MOVE Then Standard Attack',
            avg: standardMoveAttack?.avgActionsPerTurnOpening5 || 0,
            rest: standardMoveAttack?.firstRestTurn || null,
            peak: standardMoveAttack?.peakExhaustionOpening5 || 0,
            burn: standardMoveAttack?.firstImmediateBurnTurn || null
        },
        {
            label: 'Balanced Mid Heavy / BASIC_MOVE Then Standard Attack',
            avg: heavyMoveAttack?.avgActionsPerTurnOpening5 || 0,
            rest: heavyMoveAttack?.firstRestTurn || null,
            peak: heavyMoveAttack?.peakExhaustionOpening5 || 0,
            burn: heavyMoveAttack?.firstImmediateBurnTurn || null
        }
    ]);

    const travel = findResult(report, 'balanced_mid_standard', 'move_only_travel');
    const battle = findResult(report, 'balanced_mid_standard', 'move_only_battle');
    appendResultTable(lines, 'Travel Vs Battle Movement', [
        {
            label: 'Balanced Mid Standard / Move Only Battle',
            avg: battle?.avgActionsPerTurnOpening5 || 0,
            rest: battle?.firstRestTurn || null,
            peak: battle?.peakExhaustionOpening5 || 0,
            burn: battle?.firstImmediateBurnTurn || null
        },
        {
            label: 'Balanced Mid Standard / Move Only Travel',
            avg: travel?.avgActionsPerTurnOpening5 || 0,
            rest: travel?.firstRestTurn || null,
            peak: travel?.peakExhaustionOpening5 || 0,
            burn: travel?.firstImmediateBurnTurn || null
        }
    ]);

    lines.push('## Sensitivity');
    lines.push('');
    lines.push('| Lever | Avg Events / Beat Delta | First Rest Delta | Peak EX Delta | Profiles |');
    lines.push('| --- | ---: | ---: | ---: | --- |');
    report.sensitivity.forEach((row) => {
        lines.push(`| ${row.label} | ${row.deltaAvgActionsPerTurnOpening5.toFixed(3)} | ${row.deltaFirstRestTurn.toFixed(3)} | ${row.deltaPeakExhaustionOpening5.toFixed(3)} | ${row.mostAffectedProfiles.join(', ')} |`);
    });
    lines.push('');

    lines.push('## Recommended Next Candidate Changes');
    lines.push('');
    report.recommendedNextCandidateChanges.forEach((line) => {
        lines.push(`- ${line}`);
    });
    lines.push('');

    return `${lines.join('\n')}\n`;
};

const jsonOutFile = process.argv[2] || 'artifacts/ires/IRES_METABOLIC_REPORT.json';
const mdOutFile = process.argv[3] || 'artifacts/ires/IRES_METABOLIC_REPORT.md';

const report = buildIresMetabolicAnalysisReport();
const jsonOutPath = resolve(process.cwd(), jsonOutFile);
const mdOutPath = resolve(process.cwd(), mdOutFile);

mkdirSync(dirname(jsonOutPath), { recursive: true });
mkdirSync(dirname(mdOutPath), { recursive: true });
writeFileSync(jsonOutPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(mdOutPath, toMarkdown(report), 'utf8');

console.log(JSON.stringify({
    wroteJson: jsonOutPath,
    wroteMarkdown: mdOutPath,
    targets: report.targetOutcomes.length,
    failedTargets: report.targetOutcomes.filter((row) => !row.passed).length
}, null, 2));
