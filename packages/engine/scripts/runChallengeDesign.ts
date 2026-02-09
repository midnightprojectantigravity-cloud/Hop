import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runChallengeDesignWorkflow } from '../src/systems/challenge-design';

const targetDifficulty = Number(process.argv[2] || 72);
const tolerance = Number(process.argv[3] || 5);
const calibrationVersion = process.argv[4] || 'cal-v1-firemage-baseline';
const modelVersion = process.argv[5] || 'uel-v1';
const outFile = process.argv[6] || 'docs/UPA_CHALLENGE_DESIGN_REPORT.json';

const payload = runChallengeDesignWorkflow(targetDifficulty, tolerance, calibrationVersion, modelVersion);
const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
console.log(JSON.stringify({
    wrote: target,
    targetDifficulty,
    tolerance,
    selectedDifficulty: payload.targetEncounter.selected.difficultyGrade,
    bandMatch: payload.targetEncounter.selected.bandMatch,
    recommendations: payload.reinforcementPlan.length
}, null, 2));
