import { describe, expect, it } from 'vitest';
import { listEnemyCatalogEntries } from '../data/enemies';
import { computeEvaluatorBaselines } from '../systems/evaluation/evaluation-baselines';

describe('evaluator baseline enemy source', () => {
    it('derives enemy baseline grades from enemy catalog entries', () => {
        const baselines = computeEvaluatorBaselines();
        const catalogEntries = listEnemyCatalogEntries();

        expect(baselines.entityGrades.enemies).toHaveLength(catalogEntries.length);

        const baselineIds = new Set(baselines.entityGrades.enemies.map(grade => grade.id));
        for (const entry of catalogEntries) {
            expect(baselineIds.has(`enemy_${entry.subtype}`)).toBe(true);
        }
    });
});

