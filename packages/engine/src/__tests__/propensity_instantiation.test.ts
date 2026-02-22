import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import { compileBaseUnitBlueprint, parseBaseUnitDefinition } from '../data';
import { instantiateActorFromBlueprint, instantiateActorFromDefinition } from '../systems/propensity-instantiation';

const loadBaseUnit = () => {
    const url = new URL('../data/examples/base-unit.raider.v1.json', import.meta.url);
    return parseBaseUnitDefinition(JSON.parse(readFileSync(url, 'utf8')));
};

describe('propensity instantiation', () => {
    it('is deterministic for same seed and draw order', () => {
        const def = loadBaseUnit();
        const blueprint = compileBaseUnitBlueprint(def);

        const stateA = generateInitialState(1, 'propensity-seed-01');
        const stateB = generateInitialState(1, 'propensity-seed-01');

        const resultA = instantiateActorFromBlueprint(stateA, blueprint, { actorId: 'raider-a', position: createHex(4, 4) });
        const resultB = instantiateActorFromBlueprint(stateB, blueprint, { actorId: 'raider-a', position: createHex(4, 4) });

        expect(resultA.stats).toEqual(resultB.stats);
        expect(resultA.rollTrace).toEqual(resultB.rollTrace);
    });

    it('consumes global rngCounter in consume_global mode', () => {
        const def = loadBaseUnit();
        const state = generateInitialState(1, 'propensity-seed-02');
        const result = instantiateActorFromDefinition(state, def, { position: createHex(3, 6) });

        expect((result.nextState.rngCounter || 0) - (state.rngCounter || 0)).toBe(4);
        expect(result.actor.activeSkills.map(s => s.id)).toEqual(expect.arrayContaining(['BASIC_MOVE', 'BASIC_ATTACK', 'DASH', 'AUTO_ATTACK']));
    });

    it('does not consume global rngCounter in stateless mode', () => {
        const def = loadBaseUnit();
        const statelessDef = {
            ...def,
            instantiate: {
                ...def.instantiate,
                counterMode: 'stateless' as const
            }
        };

        const state = generateInitialState(1, 'propensity-seed-03');
        const result = instantiateActorFromDefinition(state, statelessDef, { position: createHex(5, 5) });

        expect((result.nextState.rngCounter || 0) - (state.rngCounter || 0)).toBe(0);
    });
});

