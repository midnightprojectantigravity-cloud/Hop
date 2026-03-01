import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import { previewActionOutcome } from '../systems/action-preview';

describe('action preview dry run', () => {
    it('simulates outcome without mutating live state', () => {
        const state = generateInitialState(1, 'preview-seed-01');
        const enemy = state.enemies[0]!;
        const playerPos = createHex(4, 5);
        const enemyPos = createHex(5, 5);
        const positioned = {
            ...state,
            player: { ...state.player, position: playerPos },
            enemies: state.enemies.map((e, idx) => idx === 0 ? { ...e, position: enemyPos } : e)
        };
        const beforeHp = positioned.enemies[0]!.hp;

        const result = previewActionOutcome(positioned, {
            actorId: positioned.player.id,
            skillId: 'BASIC_ATTACK',
            target: enemyPos
        });

        expect(result.ok).toBe(true);
        expect(result.predictedState).toBeTruthy();
        expect(positioned.enemies[0]!.hp).toBe(beforeHp);
        const previewEnemy = result.predictedState!.enemies.find(e => e.id === enemy.id);
        if (previewEnemy) {
            expect(previewEnemy.hp).toBeLessThan(beforeHp);
        } else {
            expect(true).toBe(true);
        }
        expect(result.simulationEvents.some(e => e.type === 'DamageTaken')).toBe(true);
        expect(result.stackTrace.length).toBeGreaterThan(0);
    });

    it('rejects invalid targets before simulation', () => {
        const state = generateInitialState(1, 'preview-seed-02');
        const result = previewActionOutcome(state, {
            actorId: state.player.id,
            skillId: 'BASIC_ATTACK',
            target: createHex(8, 8)
        });

        expect(result.ok).toBe(false);
        expect(result.reason).toContain('invalid');
    });
});
