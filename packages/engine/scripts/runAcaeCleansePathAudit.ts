import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyEffects, generateInitialState } from '../src';

type CleanseAuditReport = {
    metric: 'acae_cleanse_path';
    initialBurn: number;
    wetApplied: number;
    residualBurn: number;
    clearRatio: number;
};

const baselinePath = resolve('scripts/fixtures/acae/cleanse_path.baseline.json');

const run = (): CleanseAuditReport => {
    let state = generateInitialState(1, 'acae-cleanse-path-seed');
    state.ruleset = { ailments: { acaeEnabled: true, version: 'acae-v1' } };

    state = applyEffects(state, [
        { type: 'DepositAilmentCounters', target: state.player.id, ailment: 'burn', amount: 10, source: 'tile' }
    ], { sourceId: state.player.id, targetId: state.player.id });
    state = applyEffects(state, [
        { type: 'DepositAilmentCounters', target: state.player.id, ailment: 'wet', amount: 5, source: 'tile' }
    ], { sourceId: state.player.id, targetId: state.player.id });

    const counters = (state.player.components?.get('ailments') as { counters?: Record<string, number> } | undefined)?.counters || {};
    const residualBurn = Number(counters.burn || 0);
    return {
        metric: 'acae_cleanse_path',
        initialBurn: 10,
        wetApplied: 5,
        residualBurn,
        clearRatio: Number(((10 - residualBurn) / 10).toFixed(3))
    };
};

const compareWithBaseline = (report: CleanseAuditReport): void => {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as CleanseAuditReport;
    if (report.residualBurn !== baseline.residualBurn || report.clearRatio !== baseline.clearRatio) {
        console.error('[ACAE][CLEANSE] baseline drift detected');
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
        console.log('[ACAE][CLEANSE] baseline check passed');
    }
};

main();
