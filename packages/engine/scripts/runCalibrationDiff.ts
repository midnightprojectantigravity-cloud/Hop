import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Snapshot = {
    calibration: Record<string, any>;
    evaluatorBaselines: {
        tileGrades: Array<{ id: string; numericGrade: number }>;
        entityGrades: {
            loadouts: Array<{ id: string; numericGrade: number }>;
            enemies: Array<{ id: string; numericGrade: number }>;
        };
        mapGrades: Array<{ id: string; numericGrade: number; difficultyGrade: number }>;
        encounterGrades: Array<{ id: string; numericGrade: number; difficultyGrade: number }>;
    };
};

const beforeFile = process.argv[2];
const afterFile = process.argv[3];
const outFile = process.argv[4] || 'docs/UPA_CALIBRATION_DIFF.json';

if (!beforeFile || !afterFile) {
    throw new Error('Usage: runCalibrationDiff.ts <beforeSnapshot> <afterSnapshot> [outFile]');
}

const before = JSON.parse(readFileSync(resolve(process.cwd(), beforeFile), 'utf8')) as Snapshot;
const after = JSON.parse(readFileSync(resolve(process.cwd(), afterFile), 'utf8')) as Snapshot;

const flattenNums = (obj: any, prefix = ''): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj || {})) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'number') out[key] = v;
        else if (v && typeof v === 'object' && !Array.isArray(v)) {
            Object.assign(out, flattenNums(v, key));
        }
    }
    return out;
};

const numDiffs = (() => {
    const a = flattenNums(before.calibration);
    const b = flattenNums(after.calibration);
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    return keys.map(key => ({
        key,
        before: a[key] ?? null,
        after: b[key] ?? null,
        delta: (a[key] != null && b[key] != null) ? Number((b[key] - a[key]).toFixed(4)) : null
    }));
})();

const toMap = (rows: Array<{ id: string; numericGrade: number }>) => new Map(rows.map(r => [r.id, r.numericGrade]));
const baselineDiff = (beforeRows: Array<{ id: string; numericGrade: number }>, afterRows: Array<{ id: string; numericGrade: number }>) => {
    const a = toMap(beforeRows);
    const b = toMap(afterRows);
    const ids = [...new Set([...a.keys(), ...b.keys()])];
    return ids
        .map(id => {
            const beforeValue = a.get(id);
            const afterValue = b.get(id);
            const delta = (beforeValue != null && afterValue != null)
                ? Number((afterValue - beforeValue).toFixed(4))
                : null;
            return { id, before: beforeValue ?? null, after: afterValue ?? null, delta };
        })
        .sort((x, y) => Math.abs(y.delta || 0) - Math.abs(x.delta || 0));
};

const payload = {
    beforeFile,
    afterFile,
    calibrationDiffs: numDiffs,
    baselineDiffs: {
        tiles: baselineDiff(before.evaluatorBaselines.tileGrades, after.evaluatorBaselines.tileGrades),
        loadoutEntities: baselineDiff(before.evaluatorBaselines.entityGrades.loadouts, after.evaluatorBaselines.entityGrades.loadouts),
        enemyEntities: baselineDiff(before.evaluatorBaselines.entityGrades.enemies, after.evaluatorBaselines.entityGrades.enemies),
        maps: baselineDiff(before.evaluatorBaselines.mapGrades, after.evaluatorBaselines.mapGrades),
        encounters: baselineDiff(before.evaluatorBaselines.encounterGrades, after.evaluatorBaselines.encounterGrades)
    }
};

const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
console.log(JSON.stringify({
    wrote: target,
    calibrationDiffCount: payload.calibrationDiffs.length
}, null, 2));
