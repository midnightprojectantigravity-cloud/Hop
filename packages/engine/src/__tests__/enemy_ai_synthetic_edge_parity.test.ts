import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import { selectEnemyDecisionWithOracleDiff } from '../systems/ai/enemy/selector';
import { createEnemy } from '../systems/entities/entity-factory';

describe('enemy ai synthetic edge parity', () => {
    it('matches default-policy fallback for unknown subtype aliases', () => {
        const base = generateInitialState(1, 'enemy-ai-edge-alias');
        const playerPos = createHex(5, 3);
        const enemy = createEnemy({
            id: 'edge_alias_shieldbearer',
            subtype: 'shieldbearer',
            position: createHex(5, 6),
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        });

        const state = {
            ...base,
            player: { ...base.player, position: playerPos },
            enemies: [enemy],
            companions: []
        };

        const debug = selectEnemyDecisionWithOracleDiff(
            { enemy, playerPos, state },
            { includePolicyExact: false }
        );

        expect(debug.mismatchReason).toBeUndefined();
        expect(debug.selected.plannedEntity.position).toEqual(debug.oracle.plannedEntity.position);
        expect(debug.selected.plannedEntity.intent).toBe(debug.oracle.plannedEntity.intent);
        expect(debug.selected.plannedEntity.intentPosition).toEqual(debug.oracle.plannedEntity.intentPosition);
    });

    it('matches minion policy behavior for player-faction companions', () => {
        const base = generateInitialState(1, 'enemy-ai-edge-minion');
        const playerPos = createHex(0, 0);
        const minion = {
            ...createEnemy({
                id: 'edge_minion_skeleton',
                subtype: 'skeleton',
                position: createHex(5, 6),
                speed: 1,
                skills: ['BASIC_MOVE', 'BASIC_ATTACK']
            }),
            factionId: 'player'
        };

        const state = {
            ...base,
            player: { ...base.player, position: playerPos },
            enemies: [minion],
            companions: []
        };

        const debug = selectEnemyDecisionWithOracleDiff(
            { enemy: minion, playerPos, state },
            { includePolicyExact: false }
        );

        expect(debug.mismatchReason).toBeUndefined();
        expect(debug.selected.plannedEntity.position).toEqual(debug.oracle.plannedEntity.position);
        expect(debug.selected.plannedEntity.intent).toBe(debug.oracle.plannedEntity.intent);
        expect(debug.selected.plannedEntity.intentPosition).toEqual(debug.oracle.plannedEntity.intentPosition);
    });
});
