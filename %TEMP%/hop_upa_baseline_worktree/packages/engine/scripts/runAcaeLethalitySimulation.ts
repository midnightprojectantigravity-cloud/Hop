import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyEffects, generateInitialState } from '../src';
import { tickActorAilments } from '../src/systems/ailments/runtime';

type LethalityReport = {
    metric: 'acae_lethality';
    sampleSize: number;
    avgHitsToKill: number;
    maxHitsToKill: number;
    minHitsToKill: number;
};

const baselinePath = resolve('scripts/fixtures/acae/lethality.baseline.json');

const run = (): LethalityReport => {
    const seeds = ['acae-lethal-1', 'acae-lethal-2', 'acae-lethal-3', 'acae-lethal-4', 'acae-lethal-5'];
    const results: number[] = [];

    for (const seed of seeds) {
        let state = generateInitialState(1, seed);
        state.ruleset = { ailments: { acaeEnabled: true, version: 'acae-v1' } };
        let hits = 0;
        while (state.player.hp > 0 && hits < 30) {
            state = applyEffects(state, [{
                type: 'DepositAilmentCounters',
                target: state.player.id,
                ailment: 'burn',
                amount: 8,
                source: 'tile'
            }], { sourceId: state.player.id, targetId: state.player.id });
            const tick = tickActorAilments(state, state.player.id, 'END_OF_TURN', `lethal:${hits}`);
            state = tick.state;
            hits += 1;
        }
        results.push(hits);
    }

    const sum = results.reduce((acc, value) => acc + value, 0);
    return {
        metric: 'acae_lethality',
        sampleSize: results.length,
        avgHitsToKill: Number((sum / Math.max(1, results.length)).toFixed(3)),
        maxHitsToKill: Math.max(...results),
        minHitsToKill: Math.min(...results)
    };
};

const compareWithBaseline = (report: LethalityReport): void => {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as LethalityReport;
    const drift = Math.abs(report.avgHitsToKill - baseline.avgHitsToKill);
    if (drift > 0.5 || report.maxHitsToKill !== baseline.maxHitsToKill || report.minHitsToKill !== baseline.minHitsToKill) {
        console.error('[ACAE][LETHALITY] baseline drift detected');
        console.error('baseline:', baseline);
        console.error('current:', report);
        process.exit(1);
    }
};

const main = (): void => {
    const outputPathArg = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '';
    const checkMode = process.argv.includes('--check');
    const report = run();

    if (outputPathArg) {
        writeFileSync(resolve(outputPathArg), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    } else {
        console.log(JSON.stringify(report, null, 2));
    }

    if (checkMode) {
        compareWithBaseline(report);
        console.log('[ACAE][LETHALITY] baseline check passed');
    }
};

main();
