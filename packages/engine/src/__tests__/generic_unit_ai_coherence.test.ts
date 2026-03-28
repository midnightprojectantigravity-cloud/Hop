import { describe, expect, it } from 'vitest';
import { createHex, hexDistance } from '../hex';
import { generateInitialState } from '../logic';
import { selectGenericUnitAiAction } from '../systems/ai/generic-unit-ai';
import { createCompanion, createEnemy } from '../systems/entities/entity-factory';
import { buildInitiativeQueue } from '../systems/initiative';
import { DEFAULT_LOADOUTS } from '../systems/loadout';
import { SpatialSystem } from '../systems/spatial-system';
import { recomputeVisibilityFromScratch } from '../systems/visibility';

const buildState = ({
    seed,
    playerPos = createHex(4, 4),
    enemies = [],
    companions = []
}: {
    seed: string;
    playerPos?: ReturnType<typeof createHex>;
    enemies?: ReturnType<typeof createEnemy>[];
    companions?: ReturnType<typeof createCompanion>[];
}) => {
    const base = generateInitialState(1, seed, seed, undefined, DEFAULT_LOADOUTS.VANGUARD);
    const seeded = {
        ...base,
        player: {
            ...base.player,
            position: playerPos,
            previousPosition: playerPos
        },
        enemies,
        companions
    };
    const withQueue = {
        ...seeded,
        initiativeQueue: buildInitiativeQueue(seeded),
        occupancyMask: SpatialSystem.refreshOccupancyMask(seeded)
    };
    return recomputeVisibilityFromScratch(withQueue);
};

describe('generic unit ai coherence', () => {
    it('rejects same-turn retreat drift after already moving closer to the hostile', () => {
        const turnStart = createHex(4, 4);
        const current = createHex(4, 3);
        const playerPos = createHex(4, 0);
        const enemy = {
            ...createEnemy({
                id: 'coherence-footman',
                subtype: 'footman',
                position: current,
                hp: 20,
                maxHp: 20,
                speed: 1,
                skills: ['BASIC_MOVE', 'BASIC_ATTACK']
            }),
            previousPosition: turnStart
        };
        const base = buildState({
            seed: 'coherence-retreat',
            playerPos,
            enemies: [enemy]
        });
        const state = {
            ...base,
            initiativeQueue: {
                ...base.initiativeQueue!,
                entries: base.initiativeQueue!.entries.map(entry =>
                    entry.actorId === enemy.id
                        ? { ...entry, turnStartPosition: turnStart }
                        : entry
                )
            }
        };

        const result = selectGenericUnitAiAction({
            state,
            actor: state.enemies[0],
            side: 'enemy',
            simSeed: 'coherence-retreat',
            decisionCounter: 0
        });

        expect(result.summary.sameTurnRetreatRejectedCount).toBeGreaterThan(0);
        expect(result.summary.coherenceTargetKind).toBe('hostile');
        if (result.selected.action.type === 'MOVE') {
            expect(hexDistance(result.selected.action.payload, playerPos))
                .toBeLessThanOrEqual(hexDistance(current, playerPos));
            expect(result.selected.action.payload).not.toEqual(turnStart);
        }
    });

    it('tracks anchor actors as the coherence target when temporary behavior overlays provide one', () => {
        const hostile = createEnemy({
            id: 'anchor-hostile',
            subtype: 'footman',
            position: createHex(4, 1),
            hp: 18,
            maxHp: 18,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        });
        const companion = createCompanion({
            companionType: 'skeleton',
            ownerId: 'player',
            position: createHex(4, 5)
        });
        companion.behaviorState = {
            overlays: [{
                id: 'predator_anchor',
                source: 'command',
                sourceId: 'predator_anchor',
                desiredRange: [1, 2],
                offenseBias: 0.2,
                commitBias: 0.2
            }],
            anchorActorId: hostile.id
        };
        const state = buildState({
            seed: 'coherence-anchor-actor',
            enemies: [hostile],
            companions: [companion]
        });

        const result = selectGenericUnitAiAction({
            state,
            actor: state.companions?.[0] ?? companion,
            side: 'companion',
            simSeed: 'coherence-anchor-actor',
            decisionCounter: 0
        });

        expect(result.summary.coherenceTargetKind).toBe('anchor_actor');
    });

    it('tracks anchor points as the coherence target when no hostile should override them', () => {
        const companion = createCompanion({
            companionType: 'skeleton',
            ownerId: 'player',
            position: createHex(3, 4)
        });
        companion.behaviorState = {
            overlays: [{
                id: 'scout_anchor',
                source: 'command',
                sourceId: 'scout_anchor',
                rangeModel: 'anchor_proximity',
                controlBias: 0.3,
                selfPreservationBias: 0.1
            }],
            anchorPoint: createHex(6, 4)
        };
        const state = buildState({
            seed: 'coherence-anchor-point',
            companions: [companion]
        });

        const result = selectGenericUnitAiAction({
            state,
            actor: state.companions?.[0] ?? companion,
            side: 'companion',
            simSeed: 'coherence-anchor-point',
            decisionCounter: 0
        });

        expect(result.summary.coherenceTargetKind).toBe('anchor_point');
    });

    it('lets passive-only bomb actors collapse naturally to wait', () => {
        const bomb = createEnemy({
            id: 'coherence-bomb',
            subtype: 'bomb',
            position: createHex(4, 2),
            hp: 1,
            maxHp: 1,
            speed: 1,
            skills: ['TIME_BOMB', 'VOLATILE_PAYLOAD']
        });
        const state = buildState({
            seed: 'coherence-bomb',
            enemies: [bomb]
        });

        const result = selectGenericUnitAiAction({
            state,
            actor: state.enemies[0],
            side: 'enemy',
            simSeed: 'coherence-bomb',
            decisionCounter: 0
        });

        expect(result.selected.action).toEqual({ type: 'WAIT' });
    });
});
