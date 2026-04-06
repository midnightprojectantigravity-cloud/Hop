import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import { selectGenericUnitAiAction } from '../systems/ai/generic-unit-ai';
import { createEnemy } from '../systems/entities/entity-factory';
import { buildInitiativeQueue } from '../systems/initiative';
import { DEFAULT_LOADOUTS } from '../systems/loadout';
import { SpatialSystem } from '../systems/spatial-system';
import { recomputeVisibilityFromScratch } from '../systems/visibility';

const buildVanguardState = ({
    seed,
    playerPos,
    enemyPos
}: {
    seed: string;
    playerPos: ReturnType<typeof createHex>;
    enemyPos: ReturnType<typeof createHex>;
}) => {
    const base = generateInitialState(1, seed, seed, undefined, DEFAULT_LOADOUTS.VANGUARD);
    const enemy = {
        ...createEnemy({
        id: `${seed}-enemy`,
        subtype: 'footman',
        position: enemyPos,
        hp: 20,
        maxHp: 20,
        speed: 1,
        skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        }),
        previousPosition: enemyPos
    };
    const seeded = {
        ...base,
        player: {
            ...base.player,
            position: playerPos,
            previousPosition: playerPos
        },
        enemies: [enemy]
    };
    const withQueue = {
        ...seeded,
        initiativeQueue: buildInitiativeQueue(seeded),
        occupancyMask: SpatialSystem.refreshOccupancyMask(seeded)
    };
    return recomputeVisibilityFromScratch(withQueue);
};

describe('generic unit ai melee commit', () => {
    it('chooses a damage-now action instead of drifting when a melee hit is legal', () => {
        const state = buildVanguardState({
            seed: 'generic-melee-hit-now',
            playerPos: createHex(4, 4),
            enemyPos: createHex(4, 3)
        });

        const result = selectGenericUnitAiAction({
            state,
            actor: state.player,
            side: 'player',
            simSeed: 'generic-melee-hit-now',
            decisionCounter: 0,
            goal: 'engage'
        });

        expect(result.summary.engagementMode).toBe('engage');
        expect(result.selected.facts?.canDamageNow).toBe(true);
        expect(result.selected.action.type).toBe('USE_SKILL');
    });

    it('prefers basic movement over jump when both create the same next-contact window', () => {
        const state = buildVanguardState({
            seed: 'generic-gap-close-shadow',
            playerPos: createHex(4, 4),
            enemyPos: createHex(4, 0)
        });

        const result = selectGenericUnitAiAction({
            state,
            actor: state.player,
            side: 'player',
            simSeed: 'generic-gap-close-shadow',
            decisionCounter: 0,
            goal: 'engage'
        });

        expect(result.summary.engagementMode).toBe('engage');
        expect(result.selected.action.type).toBe('MOVE');
    });
});
