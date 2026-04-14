import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import { createEnemy } from '../systems/entities/entity-factory';
import { buildInitiativeQueue } from '../systems/initiative';
import { DEFAULT_LOADOUTS } from '../systems/loadout';
import { chooseGenericAiGoal, getGenericAiGoalProfile } from '../systems/ai/player/policy';
import { SpatialSystem } from '../systems/spatial-system';
import { recomputeVisibilityFromScratch } from '../systems/visibility';

const buildState = ({
    seed,
    playerHp,
    playerMaxHp,
    enemies = []
}: {
    seed: string;
    playerHp?: number;
    playerMaxHp?: number;
    enemies?: ReturnType<typeof createEnemy>[];
}) => {
    const base = generateInitialState(1, seed, seed, undefined, DEFAULT_LOADOUTS.VANGUARD);
    const player = {
        ...base.player,
        hp: playerHp ?? base.player.hp,
        maxHp: playerMaxHp ?? base.player.maxHp
    };
    const seeded = {
        ...base,
        player,
        enemies
    };
    const withQueue = {
        ...seeded,
        initiativeQueue: buildInitiativeQueue(seeded),
        occupancyMask: SpatialSystem.refreshOccupancyMask(seeded)
    };
    return recomputeVisibilityFromScratch(withQueue);
};

describe('player goal policy', () => {
    const profile = getGenericAiGoalProfile('sp-v1-default');

    it('switches to engage when a hostile is visible', () => {
        const enemy = createEnemy({
            id: 'policy-visible-hostile',
            subtype: 'footman',
            position: createHex(4, 2),
            hp: 20,
            maxHp: 20,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        });
        const state = buildState({
            seed: 'policy-visible-hostile',
            enemies: [enemy]
        });

        expect(chooseGenericAiGoal(state, profile)).toBe('engage');
    });

    it('switches to recover when a visible hostile remains and hp is critical', () => {
        const enemy = createEnemy({
            id: 'policy-recover-hostile',
            subtype: 'footman',
            position: createHex(4, 2),
            hp: 20,
            maxHp: 20,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        });
        const state = buildState({
            seed: 'policy-recover-hostile',
            playerHp: 10,
            playerMaxHp: 55,
            enemies: [enemy]
        });

        expect(chooseGenericAiGoal(state, profile)).toBe('recover');
    });

    it('falls back to explore when no hostiles are visible', () => {
        const state = buildState({
            seed: 'policy-explore-default'
        });

        expect(chooseGenericAiGoal(state, profile)).toBe('explore');
    });

    it('stays in engage while hostiles remain alive offscreen', () => {
        const enemy = createEnemy({
            id: 'policy-offscreen-hostile',
            subtype: 'footman',
            position: createHex(4, 0),
            hp: 20,
            maxHp: 20,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        });
        const state = buildState({
            seed: 'policy-offscreen-hostile',
            enemies: [enemy]
        });

        expect(chooseGenericAiGoal(state, profile)).toBe('engage');
    });
});
