import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import { ScenarioEngine } from '../skillTests';
import { isPlayerTurn } from '../systems/initiative';
import { applyEffects } from '../systems/effect-engine';
import { createEnemy } from '../systems/entities/entity-factory';

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

    it('orders displacement sequence before hazard damage (move -> hazard -> damage)', () => {
        const initialState = generateInitialState(1, 'timeline-order-seed');
        initialState.enemies = [];
        initialState.tiles.clear();
        initialState.gameStatus = 'playing';
        const engine = new ScenarioEngine(initialState);

        const from = { q: 4, r: 5, s: -9 };
        const to = { q: 4, r: 6, s: -10 };
        const sink = { q: 4, r: 7, s: -11 };
        engine.setPlayer(from, ['SHIELD_BASH']);
        engine.setTile(from, 'floor');
        engine.setTile(to, 'floor');
        engine.setTile(sink, 'lava');

        const enemy = createEnemy({
            id: 'timeline-target',
            subtype: 'footman',
            position: to,
            hp: 3,
            maxHp: 3,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        });
        engine.state.enemies = [enemy];

        engine.state = applyEffects(engine.state, [{
            type: 'Displacement',
            target: enemy.id,
            destination: sink,
        }], { sourceId: engine.state.player.id, targetId: enemy.id });

        const phases = (engine.state.timelineEvents || []).map(e => e.phase);
        const moveEnd = phases.indexOf('MOVE_END');
        const hazard = phases.indexOf('HAZARD_CHECK');
        const damage = phases.indexOf('DAMAGE_APPLY');

        expect(moveEnd).toBeGreaterThanOrEqual(0);
        if (hazard >= 0) {
            expect(hazard).toBeGreaterThan(moveEnd);
        }
        if (damage >= 0) {
            const gate = hazard >= 0 ? hazard : moveEnd;
            expect(damage).toBeGreaterThan(gate);
        }
    });
});
