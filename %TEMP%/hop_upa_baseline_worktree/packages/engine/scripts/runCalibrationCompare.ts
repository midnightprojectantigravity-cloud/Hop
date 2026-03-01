import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeEvaluatorBaselines } from '../src/systems/evaluation/evaluation-baselines';

const beforeVersion = process.argv[2] || 'cal-v1';
const afterVersion = process.argv[3] || 'cal-v1-firemage-baseline';
const modelVersion = process.argv[4] || 'uel-v1';
const outFile = process.argv[5] || 'docs/UPA_CALIBRATION_COMPARE.json';

const before = computeEvaluatorBaselines(modelVersion, beforeVersion);
const after = computeEvaluatorBaselines(modelVersion, afterVersion);

const diffRows = (a: Array<{ id: string; numericGrade: number }>, b: Array<{ id: string; numericGrade: number }>) => {
    const am = new Map(a.map(x => [x.id, x.numericGrade]));
    const bm = new Map(b.map(x => [x.id, x.numericGrade]));
    const ids = [...new Set([...am.keys(), ...bm.keys()])];
    return ids.map(id => {
        const beforeVal = am.get(id) ?? 0;
        const afterVal = bm.get(id) ?? 0;
        return {
            id,
            before: beforeVal,
            after: afterVal,
            delta: Number((afterVal - beforeVal).toFixed(4))
        };
    }).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
};

const payload = {
    modelVersion,
    beforeVersion: before.calibrationVersion,
    afterVersion: after.calibrationVersion,
    deltas: {
        loadoutEntities: diffRows(before.entityGrades.loadouts, after.entityGrades.loadouts),
        enemyEntities: diffRows(before.entityGrades.enemies, after.entityGrades.enemies),
        maps: diffRows(before.mapGrades, after.mapGrades),
        encounters: diffRows(before.encounterGrades, after.encounterGrades)
    }
};

const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
console.log(JSON.stringify({
    wrote: target,
    beforeVersion: payload.beforeVersion,
    afterVersion: payload.afterVersion
}, null, 2));
