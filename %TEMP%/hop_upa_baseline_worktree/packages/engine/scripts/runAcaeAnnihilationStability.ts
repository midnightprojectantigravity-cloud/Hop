import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyEffects, generateInitialState } from '../src';

type StabilityReport = {
    metric: 'acae_annihilation_stability';
    runs: number;
    fingerprintCount: number;
    stable: boolean;
    fingerprints: string[];
};

const baselinePath = resolve('scripts/fixtures/acae/annihilation_stability.baseline.json');

const run = (): StabilityReport => {
    const fingerprints = new Set<string>();
    const runs = 24;
    for (let i = 0; i < runs; i++) {
        let state = generateInitialState(1, `acae-annihilation-stability-${i}`);
        state.ruleset = { ailments: { acaeEnabled: true, version: 'acae-v1' } };
        state = applyEffects(state, [
            { type: 'DepositAilmentCounters', target: state.player.id, ailment: 'burn', amount: 14, source: 'tile' },
            { type: 'DepositAilmentCounters', target: state.player.id, ailment: 'wet', amount: 4, source: 'tile' },
            { type: 'DepositAilmentCounters', target: state.player.id, ailment: 'frozen', amount: 3, source: 'tile' }
        ], { sourceId: state.player.id, targetId: state.player.id });

        const counters = (state.player.components?.get('ailments') as { counters?: Record<string, number> } | undefined)?.counters || {};
        const fingerprint = ['burn', 'wet', 'frozen', 'poison', 'bleed']
            .map(id => `${id}:${Math.max(0, Math.floor(Number(counters[id] || 0)))}`)
            .join('|');
        fingerprints.add(fingerprint);
    }

    const all = [...fingerprints];
    return {
        metric: 'acae_annihilation_stability',
        runs,
        fingerprintCount: all.length,
        stable: all.length === 1,
        fingerprints: all.sort((a, b) => a.localeCompare(b))
    };
};

const compareWithBaseline = (report: StabilityReport): void => {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as StabilityReport;
    if (!report.stable || report.fingerprintCount !== baseline.fingerprintCount || report.fingerprints.join(',') !== baseline.fingerprints.join(',')) {
        console.error('[ACAE][STABILITY] baseline drift detected');
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
        console.log('[ACAE][STABILITY] baseline check passed');
    }
};

main();
