import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import { ScenarioEngine } from '../skillTests';
import { isPlayerTurn } from '../systems/initiative';

describe('timeline sequencing', () => {
    it('rejects unsafe lava entry without emitting movement timeline phases', () => {
        const initialState = generateInitialState(1, 'timeline-seed');
        initialState.enemies = [];
        initialState.tiles.clear();
        initialState.gameStatus = 'playing';
        const engine = new ScenarioEngine(initialState);

        engine.setPlayer({ q: 4, r: 5, s: -9 }, ['BASIC_MOVE']);
        engine.setTile({ q: 4, r: 5, s: -9 }, 'floor');
        engine.setTile({ q: 4, r: 6, s: -10 }, 'lava');

        let guard = 0;
        while (!isPlayerTurn(engine.state) && guard < 20) {
            engine.dispatchSync({ type: 'ADVANCE_TURN' });
            guard++;
        }

        engine.useSkill('BASIC_MOVE', { q: 4, r: 6, s: -10 });

        const phases = (engine.state.timelineEvents || []).map(e => e.phase);
        expect(phases.includes('MOVE_START')).toBe(false);
        expect(phases.includes('MOVE_END')).toBe(false);
        expect(phases.includes('HAZARD_CHECK')).toBe(false);
        expect(phases.includes('DAMAGE_APPLY')).toBe(false);
    });
});
