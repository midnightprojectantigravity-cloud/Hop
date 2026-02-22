import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import type { AtomicEffect } from '../types';
import { applyEffects } from '../systems/effect-engine';

describe('simulation event bus', () => {
    it('emits canonical events from atomic effect resolution', () => {
        const base = generateInitialState(1, 'sim-event-seed');
        const playerPos = createHex(4, 5);
        const moved = {
            ...base,
            player: { ...base.player, position: playerPos },
            enemies: base.enemies.map((e, idx) => idx === 0 ? { ...e, position: createHex(5, 5) } : e)
        };
        const target = moved.enemies[0]!;

        const effects: AtomicEffect[] = [
            { type: 'Displacement', target: target.id, destination: createHex(6, 5), simulatePath: true },
            { type: 'Damage', target: target.id, amount: 1, reason: 'test' },
            { type: 'Message', text: 'hello event bus' }
        ];

        const next = applyEffects(moved, effects, { sourceId: moved.player.id, targetId: target.id });
        const types = (next.simulationEvents || []).map(e => e.type);

        expect(types).toEqual(expect.arrayContaining(['UnitMoved', 'DamageTaken', 'MessageLogged']));
    });
});

