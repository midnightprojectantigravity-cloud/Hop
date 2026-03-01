import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type GradeRow = {
    id: string;
    numericGrade: number;
    efficiencyGrade: number;
    difficultyGrade: number;
};

type EvaluatorBaselines = {
    tileGrades: GradeRow[];
    entityGrades: {
        loadouts: GradeRow[];
        enemies: GradeRow[];
    };
    mapGrades: GradeRow[];
    encounterGrades: GradeRow[];
};

const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const round4 = (v: number) => Number(v.toFixed(4));

const parseFile = (path: string): EvaluatorBaselines =>
    JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));

const toMap = (rows: GradeRow[]) => new Map(rows.map(r => [r.id, r]));

const computeBucketTrend = (prevRows: GradeRow[], currRows: GradeRow[]) => {
    const prevMap = toMap(prevRows);
    const currMap = toMap(currRows);
    const ids = Array.from(new Set([...prevMap.keys(), ...currMap.keys()])).sort();
    const deltas: Array<{
        id: string;
        numericDelta: number;
        efficiencyDelta: number;
        difficultyDelta: number;
    }> = [];

    for (const id of ids) {
        const p = prevMap.get(id);
        const c = currMap.get(id);
        if (!p || !c) {
            deltas.push({
                id,
                numericDelta: p ? -p.numericGrade : (c?.numericGrade || 0),
                efficiencyDelta: p ? -p.efficiencyGrade : (c?.efficiencyGrade || 0),
                difficultyDelta: p ? -p.difficultyGrade : (c?.difficultyGrade || 0)
            });
            continue;
        }
        deltas.push({
            id,
            numericDelta: round4(c.numericGrade - p.numericGrade),
            efficiencyDelta: round4(c.efficiencyGrade - p.efficiencyGrade),
            difficultyDelta: round4(c.difficultyGrade - p.difficultyGrade)
        });
    }

    return {
        count: deltas.length,
        avgNumericDelta: round4(avg(deltas.map(d => d.numericDelta))),
        avgEfficiencyDelta: round4(avg(deltas.map(d => d.efficiencyDelta))),
        avgDifficultyDelta: round4(avg(deltas.map(d => d.difficultyDelta))),
        changed: deltas.filter(d => d.numericDelta !== 0 || d.efficiencyDelta !== 0 || d.difficultyDelta !== 0),
    };
};

const previousFile = process.argv[2] || 'artifacts/upa/UPA_EVALUATOR_BASELINES_PREVIOUS.json';
const currentFile = process.argv[3] || 'artifacts/upa/UPA_EVALUATOR_BASELINES.json';
const outFile = process.argv[4] || 'artifacts/upa/UPA_EVALUATOR_TREND.json';

const previous = parseFile(previousFile);
const current = parseFile(currentFile);

const payload = {
    generatedAt: new Date().toISOString(),
    previousFile,
    currentFile,
    trend: {
        tiles: computeBucketTrend(previous.tileGrades, current.tileGrades),
        loadouts: computeBucketTrend(previous.entityGrades.loadouts, current.entityGrades.loadouts),
        enemies: computeBucketTrend(previous.entityGrades.enemies, current.entityGrades.enemies),
        maps: computeBucketTrend(previous.mapGrades, current.mapGrades),
        encounters: computeBucketTrend(previous.encounterGrades, current.encounterGrades),
    }
};

const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
console.log(JSON.stringify({
    wrote: target,
    changed: {
        tiles: payload.trend.tiles.changed.length,
        loadouts: payload.trend.loadouts.changed.length,
        enemies: payload.trend.enemies.changed.length,
        maps: payload.trend.maps.changed.length,
        encounters: payload.trend.encounters.changed.length
    }
}, null, 2));
