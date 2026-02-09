import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';
import { runBatch, summarizeBatch, type ArchetypeLoadoutId } from '../src/systems/balance-harness';
import { runChallengeDesignWorkflow } from '../src/systems/challenge-design';

const originalLog = console.log.bind(console);
if (process.env.VERBOSE_ANALYSIS !== '1') {
    console.log = () => undefined;
    console.warn = () => undefined;
}

const targetDifficulty = Number(process.argv[2] || 72);
const tolerance = Number(process.argv[3] || 5);
const calibrationVersion = process.argv[4] || 'cal-v1-firemage-baseline';
const modelVersion = process.argv[5] || 'uel-v1';
const sampleSize = Number(process.argv[6] || 40);
const maxTurns = Number(process.argv[7] || 60);
const outFile = process.argv[8] || 'docs/UPA_ENCOUNTER_VALIDATION.json';

const challenge = runChallengeDesignWorkflow(targetDifficulty, tolerance, calibrationVersion, modelVersion);
const baseSeed = challenge.targetEncounter.selected.seed;
const loadouts = Object.keys(DEFAULT_LOADOUTS) as ArchetypeLoadoutId[];

const simulations = loadouts.map(loadoutId => {
    const seeds = Array.from({ length: sampleSize }, (_, i) => `${baseSeed}:validation:${loadoutId}:${i + 1}`);
    const summary = summarizeBatch(runBatch(seeds, 'heuristic', maxTurns, loadoutId), 'heuristic', loadoutId);
    return {
        loadoutId,
        winRate: summary.winRate,
        timeoutRate: summary.timeoutRate,
        avgFloor: summary.avgFloor,
        avgHazardBreaches: summary.avgHazardBreaches
    };
});

const payload = {
    targetDifficulty,
    tolerance,
    selectedEncounter: {
        seed: challenge.targetEncounter.selected.seed,
        floor: challenge.targetEncounter.selected.floor,
        difficultyGrade: challenge.targetEncounter.selected.difficultyGrade,
        bandMatch: challenge.targetEncounter.selected.bandMatch
    },
    simulations
};

const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
originalLog(JSON.stringify({
    wrote: target,
    selectedDifficulty: payload.selectedEncounter.difficultyGrade,
    loadouts: simulations.length
}, null, 2));
