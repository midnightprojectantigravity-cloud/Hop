import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import { ScenarioEngine } from '../skillTests';
import { isPlayerTurn } from '../systems/initiative';

describe('timeline sequencing', () => {
    it('emits MOVE phases before hazard sink/damage phases on lava entry', () => {
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

        const moveStart = phases.indexOf('MOVE_START');
        const moveEnd = phases.indexOf('MOVE_END');
        const hazard = phases.indexOf('HAZARD_CHECK');
        const damage = phases.indexOf('DAMAGE_APPLY');

        expect(moveStart).toBeGreaterThanOrEqual(0);
        expect(moveEnd).toBeGreaterThan(moveStart);
        expect(hazard).toBeGreaterThan(moveEnd);
        expect(damage).toBeGreaterThan(hazard);
    });
});
