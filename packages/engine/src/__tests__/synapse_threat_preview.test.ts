import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import type { Actor, GameState } from '../types';
import { buildSynapseThreatPreview } from '../systems/synapse-threat';
import { computeRelativeThreatScores, computeUnifiedPowerScoreBreakdown } from '../systems/threat-scoring';
import { buildIntentPreview } from '../systems/telegraph-projection';

const withSingleEnemyState = (seed: string): GameState => {
    const state = generateInitialState(1, seed);
    const enemy: Actor = {
        ...state.player,
        id: 'enemy-a',
        type: 'enemy',
        factionId: 'enemy',
        position: { q: state.player.position.q + 1, r: state.player.position.r, s: state.player.position.s - 1 },
    };
    return {
        ...state,
        enemies: [enemy],
        companions: [],
    };
};

describe('synapse threat preview', () => {
    it('includes synapse preview on fresh initial state', () => {
        const state = generateInitialState(1, 'synapse-initial-seed');
        expect(state.intentPreview?.synapse).toBeDefined();
        expect((state.intentPreview?.synapse?.unitScores || []).length).toBeGreaterThan(0);
    });

    it('computes deterministic UPS breakdowns', () => {
        const state = withSingleEnemyState('synapse-ups-seed');
        const first = computeUnifiedPowerScoreBreakdown(state.player);
        const second = computeUnifiedPowerScoreBreakdown(state.player);
        expect(first).toEqual(second);
        expect(first.ups).toBeGreaterThan(0);
    });

    it('handles sparse skill edge cases (0/1/2 skills)', () => {
        const state = withSingleEnemyState('synapse-sparse-seed');
        const baseActor = state.player;
        const firstSkill = baseActor.activeSkills[0];
        const secondSkill = baseActor.activeSkills[1];
        const none = computeUnifiedPowerScoreBreakdown({
            ...baseActor,
            activeSkills: []
        });
        const one = computeUnifiedPowerScoreBreakdown({
            ...baseActor,
            activeSkills: firstSkill ? [firstSkill] : []
        });
        const two = computeUnifiedPowerScoreBreakdown({
            ...baseActor,
            activeSkills: [firstSkill, secondSkill].filter((skill): skill is Actor['activeSkills'][number] => Boolean(skill))
        });

        expect(none.skillScore).toBe(0);
        expect(one.skillScore).toBeGreaterThanOrEqual(0);
        expect(two.skillScore).toBeGreaterThanOrEqual(one.skillScore);
    });

    it('applies sigma floor and tier boundaries deterministically', () => {
        const state = withSingleEnemyState('synapse-sigma-seed');
        const relative = computeRelativeThreatScores(state);
        expect(relative.sigmaRef).toBeGreaterThanOrEqual(6);

        const playerEntry = relative.entries.find(entry => entry.actorId === state.player.id);
        expect(playerEntry?.zScore).toBe(0);
        expect(playerEntry?.sigmaTier).toBe('elevated');
    });

    it('keeps intent preview synapse payload deterministic', () => {
        const state = withSingleEnemyState('synapse-intent-seed');
        const first = buildIntentPreview(state).synapse;
        const second = buildIntentPreview(state).synapse;
        expect(first).toEqual(second);
    });

    it('suppresses dead-zone emitters below z<0.25', () => {
        const state = withSingleEnemyState('synapse-deadzone-seed');
        const enemy = state.enemies[0];
        state.enemies = [
            {
                ...enemy,
                // Small state increase keeps z positive but below dead-zone threshold.
                temporaryArmor: (enemy.temporaryArmor || 0) + 1,
            }
        ];

        const preview = buildSynapseThreatPreview(state);
        const source = preview.sources.find(s => s.actorId === 'enemy-a');
        expect(source).toBeDefined();
        expect(source!.zScore).toBeGreaterThanOrEqual(0);
        expect(source!.zScore).toBeLessThan(0.25);
        expect(source!.emitterWeight).toBe(0);
        expect(preview.tiles.every(tile => tile.heat === 0)).toBe(true);
    });

    it('keeps sources/tiles/sourceActorIds stably sorted', () => {
        const state = generateInitialState(1, 'synapse-sort-seed');
        const enemyA: Actor = {
            ...state.player,
            id: 'enemy-b',
            type: 'enemy',
            factionId: 'enemy',
            position: { q: state.player.position.q + 2, r: state.player.position.r, s: state.player.position.s - 2 },
        };
        const enemyB: Actor = {
            ...state.player,
            id: 'enemy-a',
            type: 'enemy',
            factionId: 'enemy',
            position: { q: state.player.position.q + 1, r: state.player.position.r, s: state.player.position.s - 1 },
            temporaryArmor: 2
        };
        const preview = buildSynapseThreatPreview({
            ...state,
            enemies: [enemyA, enemyB],
            companions: []
        });

        const sourceIds = preview.sources.map(source => source.actorId);
        expect(sourceIds).toEqual([...sourceIds].sort((a, b) => a.localeCompare(b)));

        const tileKeys = preview.tiles.map(tile => `${tile.tile.q},${tile.tile.r},${tile.tile.s}`);
        expect(tileKeys).toEqual([...tileKeys].sort((a, b) => a.localeCompare(b)));

        for (const tile of preview.tiles) {
            expect(tile.sourceActorIds).toEqual([...tile.sourceActorIds].sort((a, b) => a.localeCompare(b)));
        }
    });
});
