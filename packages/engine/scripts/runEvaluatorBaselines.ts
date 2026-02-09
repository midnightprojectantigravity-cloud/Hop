import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeEvaluatorBaselines } from '../src/systems/evaluation-baselines';

const outFile = process.argv[2] || 'docs/UPA_EVALUATOR_BASELINES.json';
const modelVersion = process.argv[3] || 'uel-v1';
const calibrationVersion = process.argv[4] || 'cal-v1';

const payload = computeEvaluatorBaselines(modelVersion, calibrationVersion);
const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
console.log(JSON.stringify({
    wrote: target,
    calibrationVersion: payload.calibrationVersion,
    tiles: payload.tileGrades.length,
    loadouts: payload.entityGrades.loadouts.length,
    enemies: payload.entityGrades.enemies.length,
    maps: payload.mapGrades.length,
    encounters: payload.encounterGrades.length
}, null, 2));
