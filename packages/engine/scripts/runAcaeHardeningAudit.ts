import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyEffects, generateInitialState } from '../src';
import { tickActorAilments } from '../src/systems/ailments/runtime';

type HardeningAuditReport = {
    metric: 'acae_hardening';
    sampleSize: number;
    avgBurnResistancePct: number;
    maxBurnResistancePct: number;
    capBreaches: number;
};

const baselinePath = resolve('scripts/fixtures/acae/hardening.baseline.json');

const run = (): HardeningAuditReport => {
    const seeds = Array.from({ length: 8 }, (_, idx) => `acae-hardening-${idx + 1}`);
    const burnResistanceValues: number[] = [];
    let capBreaches = 0;

    for (const seed of seeds) {
        let state = generateInitialState(1, seed);
        state.ruleset = { ailments: { acaeEnabled: true, version: 'acae-v1' } };

        for (let turn = 0; turn < 60; turn++) {
            state = applyEffects(state, [
                { type: 'DepositAilmentCounters', target: state.player.id, ailment: 'burn', amount: 5, source: 'tile' },
                { type: 'DepositAilmentCounters', target: state.player.id, ailment: 'wet', amount: 2, source: 'tile' }
            ], { sourceId: state.player.id, targetId: state.player.id });
            const tick = tickActorAilments(state, state.player.id, 'END_OF_TURN', `hardening:${turn}`);
            state = tick.state;
        }

        const resilience = state.player.components?.get('ailment_resilience') as { resistancePct?: Record<string, number> } | undefined;
        const burnPct = Number(resilience?.resistancePct?.burn || 0);
        burnResistanceValues.push(burnPct);
        if (burnPct > 85.0001) {
            capBreaches += 1;
        }
    }

    const avg = burnResistanceValues.reduce((acc, value) => acc + value, 0) / Math.max(1, burnResistanceValues.length);
    return {
        metric: 'acae_hardening',
        sampleSize: burnResistanceValues.length,
        avgBurnResistancePct: Number(avg.toFixed(3)),
        maxBurnResistancePct: Number(Math.max(...burnResistanceValues).toFixed(3)),
        capBreaches
    };
};

const compareWithBaseline = (report: HardeningAuditReport): void => {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as HardeningAuditReport;
    const avgDrift = Math.abs(report.avgBurnResistancePct - baseline.avgBurnResistancePct);
    if (avgDrift > 2 || report.capBreaches > baseline.capBreaches || report.maxBurnResistancePct > 85.0001) {
        console.error('[ACAE][HARDENING] baseline drift detected');
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
        console.log('[ACAE][HARDENING] baseline check passed');
    }
};

main();
