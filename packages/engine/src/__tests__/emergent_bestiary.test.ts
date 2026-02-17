import { describe, expect, it } from 'vitest';
import { runEmergentBestiarySimulation } from '../systems/emergent-bestiary';

describe('emergent bestiary simulation', () => {
    it('is deterministic for a fixed seed and config', () => {
        const config = {
            seed: 'eco-red-deterministic',
            biome: 'red' as const,
            batchSize: 100,
            hazardRounds: 6,
            crossBiomeTargets: ['green', 'blue'] as const
        };
        const first = runEmergentBestiarySimulation(config);
        const second = runEmergentBestiarySimulation(config);
        expect(first).toEqual(second);
    });

    it('keeps survivor propensity near the 60/30/10 target envelope', () => {
        const report = runEmergentBestiarySimulation({
            seed: 'eco-red-propensity',
            biome: 'red',
            batchSize: 140,
            hazardRounds: 6
        });

        expect(report.propensity.native).toBeGreaterThan(0.45);
        expect(report.propensity.native).toBeLessThan(0.8);
        expect(report.propensity.hybrid).toBeGreaterThan(0.15);
        expect(report.propensity.hybrid).toBeLessThan(0.45);
        expect(report.propensity.inversion).toBeGreaterThanOrEqual(0.03);
        expect(report.propensity.inversion).toBeLessThan(0.22);
    });

    it('reports cross-biome stress when survivors enter foreign ecology', () => {
        const report = runEmergentBestiarySimulation({
            seed: 'eco-red-cross',
            biome: 'red',
            batchSize: 120,
            hazardRounds: 6,
            crossBiomeTargets: ['green']
        });
        const foreign = report.crossBiomeStress.find(x => x.targetBiome === 'green');
        expect(foreign).toBeTruthy();
        expect(foreign?.operationalRate).toBeLessThan(report.homeStress.operationalRate);
        expect(foreign?.traverseThreeHexesRate).toBeLessThanOrEqual(report.homeStress.traverseThreeHexesRate);
    });

    it('preserves RGB predation ordering in arc telemetry', () => {
        const report = runEmergentBestiarySimulation({
            seed: 'eco-predation',
            biome: 'blue',
            batchSize: 90,
            hazardRounds: 5
        });

        const redOverGreen = report.predationArc.find(arc => arc.predator === 'red' && arc.prey === 'green');
        const greenOverBlue = report.predationArc.find(arc => arc.predator === 'green' && arc.prey === 'blue');
        const blueOverRed = report.predationArc.find(arc => arc.predator === 'blue' && arc.prey === 'red');

        expect(redOverGreen?.advantage).toBeGreaterThan(0);
        expect(greenOverBlue?.advantage).toBeGreaterThan(0);
        expect(blueOverRed?.advantage).toBeGreaterThan(0);
    });
});

