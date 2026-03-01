import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { computeUPA } from '../systems/upa';

describe('UPA Telemetry', () => {
    it('produces stable output for fixed inputs', () => {
        const input = { winRate: 0.45, avgTurnsToWin: 26, timeoutRate: 0.1, avgFloor: 4.2, avgHazardBreaches: 1.2 };
        expect(computeUPA(input)).toBe(computeUPA(input));
    });

    it('penalizes timeouts and no-win pace inflation', () => {
        const noWinsLowTimeout = computeUPA({
            winRate: 0,
            avgTurnsToWin: 1,
            timeoutRate: 0.05,
            avgFloor: 4,
            avgHazardBreaches: 0.2
        });
        const noWinsHighTimeout = computeUPA({
            winRate: 0,
            avgTurnsToWin: 1,
            timeoutRate: 0.95,
            avgFloor: 4,
            avgHazardBreaches: 0.2
        });
        expect(noWinsHighTimeout).toBeLessThan(noWinsLowTimeout);
    });

    it('is not referenced by runtime gameplay reducers/executors', () => {
        const targets = [
            path.resolve(__dirname, '../logic.ts'),
            path.resolve(__dirname, '../systems/tactical-engine.ts'),
            path.resolve(__dirname, '../systems/ai/ai.ts')
        ];
        const found = targets.some(file => fs.readFileSync(file, 'utf8').includes('computeUPA('));
        expect(found).toBe(false);
    });
});
