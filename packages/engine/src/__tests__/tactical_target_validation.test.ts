import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import { TacticalEngine } from '../systems/tactical-engine';
import type { Intent } from '../types/intent';

describe('tactical target validation', () => {
    it('invalid player target does not consume turn', () => {
        const state = generateInitialState(1, 'tactical-target-player-seed');
        const intent: Intent = {
            type: 'ATTACK',
            actorId: state.player.id,
            skillId: 'BASIC_ATTACK',
            targetHex: createHex(0, 0),
            priority: 10,
            metadata: {
                expectedValue: 0,
                reasoningCode: 'TEST_INVALID_TARGET',
                isGhost: false
            }
        };

        const result = TacticalEngine.execute(intent, state.player, state);
        expect(result.effects).toHaveLength(0);
        expect(result.consumesTurn).toBe(false);
        expect(result.messages.some(m => m.toLowerCase().includes('invalid target'))).toBe(true);
    });

    it('invalid enemy target consumes turn as deterministic wait fallback', () => {
        const state = generateInitialState(1, 'tactical-target-enemy-seed');
        const enemy = state.enemies[0];
        expect(enemy).toBeDefined();

        const intent: Intent = {
            type: 'ATTACK',
            actorId: enemy.id,
            skillId: 'BASIC_ATTACK',
            targetHex: createHex(0, 0),
            priority: 10,
            metadata: {
                expectedValue: 0,
                reasoningCode: 'TEST_INVALID_TARGET',
                isGhost: false
            }
        };

        const result = TacticalEngine.execute(intent, enemy, state);
        expect(result.effects).toHaveLength(0);
        expect(result.consumesTurn).toBe(true);
        expect(result.messages.some(m => m.toLowerCase().includes('invalid target'))).toBe(true);
    });
});
