import { describe, expect, it } from 'vitest';
import { createHex, getNeighbors, hexDistance, pointToKey } from '../hex';
import { generateInitialState } from '../logic';
import { selectGenericUnitAiAction } from '../systems/ai/generic-unit-ai';
import { createCompanion, createEnemy } from '../systems/entities/entity-factory';
import { buildInitiativeQueue } from '../systems/initiative';
import { resolveIresRuleset } from '../systems/ires/config';
import { applyIresMutationToActor } from '../systems/ires/state';
import { DEFAULT_LOADOUTS } from '../systems/loadout';
import { SpatialSystem } from '../systems/spatial-system';
import { UnifiedTileService } from '../systems/tiles/unified-tile-service';
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

const computeTraversalDistance = (
    state: ReturnType<typeof buildState>,
    from: ReturnType<typeof createHex>,
    to: ReturnType<typeof createHex>
): number => {
    if (pointToKey(from) === pointToKey(to)) return 0;

    const queue: Array<{ point: ReturnType<typeof createHex>; distance: number }> = [{ point: from, distance: 0 }];
    const visited = new Set<string>([pointToKey(from)]);

    while (queue.length > 0) {
        const current = queue.shift()!;
        for (const next of getNeighbors(current.point)) {
            const key = pointToKey(next);
            if (visited.has(key)) continue;
            visited.add(key);
            if (!SpatialSystem.isWithinBounds(state, next)) continue;
            if (!UnifiedTileService.isPassable(state, next) && pointToKey(next) !== pointToKey(to)) continue;
            if (pointToKey(next) === pointToKey(to)) return current.distance + 1;
            queue.push({ point: next, distance: current.distance + 1 });
        }
    }

    return hexDistance(from, to) + 12;
};

describe('generic unit ai coherence', () => {
    it('chooses the same action and summary for footman and butcher shells when skills and goals match', () => {
        const buildShellResult = (subtype: 'footman' | 'butcher', seed: string) => {
            const actor = createEnemy({
                id: `coherence-${subtype}-shell`,
                subtype,
                position: createHex(4, 2),
                hp: 100,
                maxHp: 100,
                speed: 1,
                skills: ['BASIC_MOVE', 'BASIC_ATTACK']
            });
            const state = buildState({
                seed,
                playerPos: createHex(4, 4),
                enemies: [actor]
            });
            return selectGenericUnitAiAction({
                state,
                actor: state.enemies[0],
                side: 'enemy',
                simSeed: seed,
                decisionCounter: 0,
                goal: 'engage'
            });
        };

        const footmanResult = buildShellResult('footman', 'coherence-footman-shell');
        const butcherResult = buildShellResult('butcher', 'coherence-butcher-shell');

        expect(butcherResult.selected.action).toEqual(footmanResult.selected.action);
        expect(butcherResult.summary).toEqual(footmanResult.summary);
    });

    it('keeps player and enemy selectors aligned when their combat shell and goal are symmetric', () => {
        const enemy = createEnemy({
            id: 'coherence-side-parity',
            subtype: 'footman',
            position: createHex(4, 2),
            hp: 20,
            maxHp: 20,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        });
        const base = buildState({
            seed: 'coherence-side-parity',
            playerPos: createHex(4, 4),
            enemies: [enemy]
        });
        const mirroredPlayer = {
            ...base.player,
            position: createHex(4, 2),
            previousPosition: createHex(4, 2),
            hp: 20,
            maxHp: 20,
            activeSkills: base.enemies[0].activeSkills
        };
        const mirroredEnemy = {
            ...base.enemies[0],
            position: createHex(4, 4),
            previousPosition: createHex(4, 4)
        };
        const state = recomputeVisibilityFromScratch({
            ...base,
            player: mirroredPlayer,
            enemies: [mirroredEnemy],
            initiativeQueue: buildInitiativeQueue({
                ...base,
                player: mirroredPlayer,
                enemies: [mirroredEnemy]
            }),
            occupancyMask: SpatialSystem.refreshOccupancyMask({
                ...base,
                player: mirroredPlayer,
                enemies: [mirroredEnemy]
            })
        });

        const playerResult = selectGenericUnitAiAction({
            state,
            actor: state.player,
            side: 'player',
            simSeed: 'coherence-side-parity',
            decisionCounter: 0,
            goal: 'engage'
        });
        const enemyResult = selectGenericUnitAiAction({
            state,
            actor: state.enemies[0],
            side: 'enemy',
            simSeed: 'coherence-side-parity',
            decisionCounter: 0,
            goal: 'engage'
        });

        expect(playerResult.selected.action).toEqual(enemyResult.selected.action);
        expect(playerResult.summary.goal).toBe('engage');
        expect(enemyResult.summary.goal).toBe('engage');
    });

    it('lets generic melee enemies basic attack immediately when adjacent', () => {
        const butcher = createEnemy({
            id: 'coherence-butcher-attack',
            subtype: 'butcher',
            position: createHex(4, 3),
            hp: 100,
            maxHp: 100,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        });
        const state = buildState({
            seed: 'coherence-butcher-attack',
            playerPos: createHex(4, 4),
            enemies: [butcher]
        });

        const result = selectGenericUnitAiAction({
            state,
            actor: state.enemies[0],
            side: 'enemy',
            simSeed: 'coherence-butcher-attack',
            decisionCounter: 0,
            goal: 'engage'
        });

        expect(result.summary.engagementMode).toBe('engage');
        expect(result.summary.attackOpportunityAvailable).toBe(true);
        expect(result.selected.facts?.canDamageNow).toBe(true);
        expect(result.selected.action.type).toBe('USE_SKILL');
        if (result.selected.action.type === 'USE_SKILL') {
            expect(result.selected.action.payload.skillId).toBe('BASIC_ATTACK');
        }
    });

    it('prefers a kiting step over waiting when an engaged archer can reopen range', () => {
        const archer = createEnemy({
            id: 'coherence-archer-disengage',
            subtype: 'archer',
            position: createHex(4, 3),
            hp: 20,
            maxHp: 20,
            speed: 1,
            skills: ['BASIC_MOVE', 'ARCHER_SHOT']
        });
        const base = buildState({
            seed: 'coherence-archer-disengage',
            playerPos: createHex(4, 4),
            enemies: [archer]
        });
        const enemy = base.enemies[0];
        const state = recomputeVisibilityFromScratch({
            ...base,
            enemies: [{
                ...enemy,
                ires: enemy.ires ? {
                    ...enemy.ires,
                    spark: enemy.ires.maxSpark,
                    actedThisTurn: false,
                    movedThisTurn: false,
                    actionCountThisTurn: 0,
                    sparkBurnActionsThisTurn: 0
                } : enemy.ires
            }],
            initiativeQueue: buildInitiativeQueue({
                ...base,
                enemies: [{
                    ...enemy,
                    ires: enemy.ires ? {
                        ...enemy.ires,
                        spark: enemy.ires.maxSpark,
                        actedThisTurn: false,
                        movedThisTurn: false,
                        actionCountThisTurn: 0,
                        sparkBurnActionsThisTurn: 0
                    } : enemy.ires
                }]
            }),
            occupancyMask: SpatialSystem.refreshOccupancyMask({
                ...base,
                enemies: [{
                    ...enemy,
                    ires: enemy.ires ? {
                        ...enemy.ires,
                        spark: enemy.ires.maxSpark,
                        actedThisTurn: false,
                        movedThisTurn: false,
                        actionCountThisTurn: 0,
                        sparkBurnActionsThisTurn: 0
                    } : enemy.ires
                }]
            })
        });

        const result = selectGenericUnitAiAction({
            state,
            actor: state.enemies[0],
            side: 'enemy',
            simSeed: 'coherence-archer-disengage',
            decisionCounter: 0,
            goal: 'engage'
        });

        expect(result.selected.action.type).toBe('MOVE');
        const waitCandidate = result.candidates.find(candidate => candidate.action.type === 'WAIT');
        expect(waitCandidate?.breakdown.engaged_spark_wait_penalty).toBeLessThan(0);
        expect(waitCandidate?.score).toBeLessThan(result.selected.score);
        if (result.selected.action.type === 'MOVE') {
            expect(hexDistance(result.selected.action.payload, state.player.position)).toBe(2);
        }
    });

    it('prefers the far edge of a ranged band over a closer in-band move when shot is unavailable', () => {
        const archer = createEnemy({
            id: 'coherence-archer-max-range',
            subtype: 'archer',
            position: createHex(4, 1),
            hp: 20,
            maxHp: 20,
            speed: 1,
            skills: ['BASIC_MOVE', 'ARCHER_SHOT']
        });
        const base = buildState({
            seed: 'coherence-archer-max-range',
            playerPos: createHex(4, 4),
            enemies: [{
                ...archer,
                activeSkills: archer.activeSkills?.map(skill =>
                    String(skill.id) === 'ARCHER_SHOT'
                        ? { ...skill, currentCooldown: 1 }
                        : skill
                )
            }]
        });
        const enemy = base.enemies[0];
        const state = recomputeVisibilityFromScratch({
            ...base,
            enemies: [{
                ...enemy,
                ires: enemy.ires ? {
                    ...enemy.ires,
                    spark: enemy.ires.maxSpark,
                    actedThisTurn: false,
                    movedThisTurn: false,
                    actionCountThisTurn: 0,
                    sparkBurnActionsThisTurn: 0
                } : enemy.ires
            }],
            initiativeQueue: buildInitiativeQueue({
                ...base,
                enemies: [{
                    ...enemy,
                    ires: enemy.ires ? {
                        ...enemy.ires,
                        spark: enemy.ires.maxSpark,
                        actedThisTurn: false,
                        movedThisTurn: false,
                        actionCountThisTurn: 0,
                        sparkBurnActionsThisTurn: 0
                    } : enemy.ires
                }]
            }),
            occupancyMask: SpatialSystem.refreshOccupancyMask({
                ...base,
                enemies: [{
                    ...enemy,
                    ires: enemy.ires ? {
                        ...enemy.ires,
                        spark: enemy.ires.maxSpark,
                        actedThisTurn: false,
                        movedThisTurn: false,
                        actionCountThisTurn: 0,
                        sparkBurnActionsThisTurn: 0
                    } : enemy.ires
                }]
            })
        });

        const result = selectGenericUnitAiAction({
            state,
            actor: state.enemies[0],
            side: 'enemy',
            simSeed: 'coherence-archer-max-range',
            decisionCounter: 0,
            goal: 'engage'
        });

        expect(result.selected.action.type).toBe('MOVE');
        if (result.selected.action.type === 'MOVE') {
            expect(hexDistance(result.selected.action.payload, state.player.position)).toBe(4);
        }
    });

    it('prefers an open retreat lane over an equally ranged boxed-in lane', () => {
        const archer = createEnemy({
            id: 'coherence-archer-open-lane',
            subtype: 'archer',
            position: createHex(4, 2),
            hp: 20,
            maxHp: 20,
            speed: 1,
            skills: ['BASIC_MOVE', 'ARCHER_SHOT']
        });
        const base = buildState({
            seed: 'coherence-archer-open-lane',
            playerPos: createHex(4, 4),
            enemies: [{
                ...archer,
                activeSkills: archer.activeSkills?.map(skill =>
                    String(skill.id) === 'ARCHER_SHOT'
                        ? { ...skill, currentCooldown: 1 }
                        : skill
                )
            }]
        });
        const wallPoints = [
            createHex(5, 2),
            createHex(3, 2),
            createHex(3, 3),
            createHex(6, 1),
            createHex(6, 0),
            createHex(5, 0)
        ];
        const tiles = new Map(base.tiles);
        wallPoints.forEach(point => {
            tiles.set(pointToKey(point), {
                baseId: 'WALL',
                position: point,
                traits: new Set(['BLOCKS_MOVEMENT', 'BLOCKS_LOS', 'ANCHOR']),
                effects: []
            });
        });
        const enemy = {
            ...base.enemies[0],
            ires: base.enemies[0].ires ? {
                ...base.enemies[0].ires,
                spark: base.enemies[0].ires.maxSpark,
                actedThisTurn: false,
                movedThisTurn: false,
                actionCountThisTurn: 0,
                sparkBurnActionsThisTurn: 0
            } : base.enemies[0].ires
        };
        const state = recomputeVisibilityFromScratch({
            ...base,
            tiles,
            enemies: [enemy],
            initiativeQueue: buildInitiativeQueue({
                ...base,
                tiles,
                enemies: [enemy]
            }),
            occupancyMask: SpatialSystem.refreshOccupancyMask({
                ...base,
                tiles,
                enemies: [enemy]
            })
        });

        const result = selectGenericUnitAiAction({
            state,
            actor: state.enemies[0],
            side: 'enemy',
            simSeed: 'coherence-archer-open-lane',
            decisionCounter: 0,
            goal: 'engage'
        });

        expect(result.selected.action.type).toBe('MOVE');
        if (result.selected.action.type === 'MOVE') {
            expect(result.selected.action.payload).toEqual(createHex(4, 1));
        }
    });

    it('recognizes a basic-attack threat window after one closing move', () => {
        const butcher = createEnemy({
            id: 'coherence-butcher-threat',
            subtype: 'butcher',
            position: createHex(4, 2),
            hp: 100,
            maxHp: 100,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        });
        const state = buildState({
            seed: 'coherence-butcher-threat',
            playerPos: createHex(4, 4),
            enemies: [butcher]
        });

        const result = selectGenericUnitAiAction({
            state,
            actor: state.enemies[0],
            side: 'enemy',
            simSeed: 'coherence-butcher-threat',
            decisionCounter: 0,
            goal: 'engage'
        });

        expect(result.selected.action.type).toBe('MOVE');
        expect(result.selected.facts?.createsThreatNextDecision).toBe(true);
        expect(result.summary.threatOpportunityAvailable).toBe(true);
    });

    it('prefers the canonical straight chase step over an equal sideways tie', () => {
        const enemy = createEnemy({
            id: 'coherence-straight-line',
            subtype: 'footman',
            position: createHex(0, 3),
            hp: 20,
            maxHp: 20,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        });
        const base = buildState({
            seed: 'coherence-straight-line',
            playerPos: createHex(1, 4),
            enemies: [enemy]
        });
        const openedTiles = new Map(base.tiles);
        openedTiles.set(pointToKey(createHex(0, 4)), {
            baseId: 'STONE',
            position: createHex(0, 4),
            traits: new Set(['WALKABLE']),
            effects: []
        });
        const state = {
            ...base,
            tiles: openedTiles,
            turnNumber: 11,
            visibility: {
                ...base.visibility!,
                enemyAwarenessById: {
                    ...(base.visibility?.enemyAwarenessById || {}),
                    'coherence-straight-line': {
                        enemyId: 'coherence-straight-line',
                        lastKnownPlayerPosition: createHex(1, 4),
                        memoryTurnsRemaining: 3,
                        lastSeenTurn: 11,
                        butcherFactor: 1
                    }
                }
            },
            occupancyMask: SpatialSystem.refreshOccupancyMask({
                ...base,
                tiles: openedTiles
            })
        };

        const result = selectGenericUnitAiAction({
            state,
            actor: state.enemies[0],
            side: 'enemy',
            simSeed: 'coherence-straight-line',
            decisionCounter: 0,
            goal: 'engage'
        });

        expect(result.selected.action.type).toBe('MOVE');
        if (result.selected.action.type === 'MOVE') {
            expect(result.selected.action.payload).toEqual(createHex(0, 4));
        }
    });

    it('prefers the shortest walkable chase route over a farther canonical-looking step', () => {
        const floor = generateInitialState(2, 'tri-scan-2-37');
        const enemy = floor.enemies[0];
        expect(enemy).toBeTruthy();

        const seeded = {
            ...floor,
            turnNumber: 11,
            enemies: [{
                ...enemy!,
                hp: enemy!.maxHp
            }]
        };
        const withQueue = {
            ...seeded,
            initiativeQueue: buildInitiativeQueue(seeded),
            occupancyMask: SpatialSystem.refreshOccupancyMask(seeded)
        };
        const base = recomputeVisibilityFromScratch(withQueue);
        const state = {
            ...base,
            visibility: {
                ...base.visibility!,
                enemyAwarenessById: {
                    ...(base.visibility?.enemyAwarenessById || {}),
                    [enemy!.id]: {
                        enemyId: enemy!.id,
                        lastKnownPlayerPosition: base.player.position,
                        memoryTurnsRemaining: 3,
                        lastSeenTurn: 11,
                        butcherFactor: 1
                    }
                }
            }
        };

        const result = selectGenericUnitAiAction({
            state,
            actor: state.enemies[0],
            side: 'enemy',
            simSeed: 'tri-scan-2-37',
            decisionCounter: 0,
            goal: 'engage'
        });

        expect(result.summary.coherenceTargetKind).toBe('memory');
        expect(result.selected.action.type).toBe('MOVE');
        if (result.selected.action.type === 'MOVE') {
            expect(result.selected.action.payload).toEqual(createHex(2, 5));
        }
    });

    it('keeps melee pursuit making walkable route progress around blockers', () => {
        const floor10 = generateInitialState(10, 'coherence-floor10-route-progress');
        const butcher = floor10.enemies.find(enemy => enemy.subtype === 'butcher');
        expect(butcher).toBeTruthy();

        const seeded = {
            ...floor10,
            turnNumber: 11,
            player: {
                ...floor10.player,
                position: createHex(1, 2),
                previousPosition: createHex(1, 2)
            },
            enemies: [{
                ...butcher!,
                position: createHex(4, 2),
                previousPosition: createHex(4, 2),
                hp: butcher!.maxHp
            }]
        };
        const withQueue = {
            ...seeded,
            initiativeQueue: buildInitiativeQueue(seeded),
            occupancyMask: SpatialSystem.refreshOccupancyMask(seeded)
        };
        const base = recomputeVisibilityFromScratch(withQueue);
        const state = {
            ...base,
            visibility: {
                ...base.visibility!,
                enemyAwarenessById: {
                    ...(base.visibility?.enemyAwarenessById || {}),
                    [butcher!.id]: {
                        enemyId: butcher!.id,
                        lastKnownPlayerPosition: createHex(1, 2),
                        memoryTurnsRemaining: 3,
                        lastSeenTurn: 11,
                        butcherFactor: 1
                    }
                }
            }
        };

        const result = selectGenericUnitAiAction({
            state,
            actor: state.enemies[0],
            side: 'enemy',
            simSeed: 'coherence-floor10-route-progress',
            decisionCounter: 0,
            goal: 'engage'
        });

        expect(result.selected.action.type).toBe('MOVE');
        expect(result.summary.objectiveOpportunityAvailable).toBe(true);
        if (result.selected.action.type === 'MOVE') {
            expect(
                computeTraversalDistance(state, result.selected.action.payload, state.player.position)
            ).toBeLessThan(
                computeTraversalDistance(state, state.enemies[0].position, state.player.position)
            );
        }
    });

    it('prefers waiting to reenter rested over a merely standard chase setup', () => {
        const floor = generateInitialState(9, 'rest-scan-9-3');
        const enemy = floor.enemies[0];
        expect(enemy).toBeTruthy();

        const seeded = {
            ...floor,
            turnNumber: 11,
            enemies: [{
                ...enemy!,
                ires: enemy!.ires ? {
                    ...enemy!.ires,
                    currentState: 'base' as const,
                    spark: Math.round((enemy!.ires.maxSpark || 100) * 0.76),
                    actedThisTurn: false,
                    movedThisTurn: false,
                    actionCountThisTurn: 0,
                    sparkBurnActionsThisTurn: 0,
                    isExhausted: false,
                    pendingRestedBonus: false,
                    activeRestedCritBonusPct: 0
                } : enemy!.ires
            }]
        };
        const withQueue = {
            ...seeded,
            initiativeQueue: buildInitiativeQueue(seeded),
            occupancyMask: SpatialSystem.refreshOccupancyMask(seeded)
        };
        const base = recomputeVisibilityFromScratch(withQueue);
        const state = {
            ...base,
            visibility: {
                ...base.visibility!,
                enemyAwarenessById: {
                    ...(base.visibility?.enemyAwarenessById || {}),
                    [enemy!.id]: {
                        enemyId: enemy!.id,
                        lastKnownPlayerPosition: base.player.position,
                        memoryTurnsRemaining: 3,
                        lastSeenTurn: 11,
                        butcherFactor: 1
                    }
                }
            }
        };

        const result = selectGenericUnitAiAction({
            state,
            actor: state.enemies[0],
            side: 'enemy',
            simSeed: 'rest-scan-9-3',
            decisionCounter: 0,
            goal: 'recover'
        });

        expect(result.summary.restedOpportunityMode).toBe('setup_preserve');
        expect(result.selected.action.type).toBe('WAIT');
        expect(result.summary.selectedRestedDecision).toBe('true_rest');
        expect(result.summary.selectedWouldReenterRested).toBe(true);
    });

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
            decisionCounter: 0,
            goal: 'engage'
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
            decisionCounter: 0,
            goal: 'engage'
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
            decisionCounter: 0,
            goal: 'explore'
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
            decisionCounter: 0,
            goal: 'engage'
        });

        expect(result.selected.action).toEqual({ type: 'WAIT' });
    });

    it('uses explore goal to advance the floor objective when no hostiles are visible', () => {
        const state = buildState({
            seed: 'coherence-explore-goal'
        });

        const result = selectGenericUnitAiAction({
            state,
            actor: state.player,
            side: 'player',
            simSeed: 'coherence-explore-goal',
            decisionCounter: 0,
            goal: 'explore'
        });

        expect(result.summary.goal).toBe('explore');
        expect(result.summary.coherenceTargetKind).toBe('objective');
        expect(result.summary.objectiveOpportunityAvailable).toBe(true);
        expect(result.selected.action.type).toBe('MOVE');
        expect(result.selected.facts?.improvesObjective).toBe(true);
    });

    it('uses recover goal to prefer pacing over low-value extra actions in combat', () => {
        const base = buildState({
            seed: 'coherence-recover-goal',
            playerPos: createHex(4, 4),
            enemies: [
                createEnemy({
                    id: 'coherence-recover-target',
                    subtype: 'footman',
                    position: createHex(4, 2),
                    hp: 20,
                    maxHp: 20,
                    speed: 1,
                    skills: ['BASIC_MOVE', 'BASIC_ATTACK']
                })
            ]
        });
        const config = resolveIresRuleset(base.ruleset);
        const player = applyIresMutationToActor(
            {
                ...base.player,
                position: createHex(4, 4)
            },
            {
                sparkDelta: -70,
                manaDelta: -8,
                exhaustionDelta: 66,
                actionCountDelta: 2,
                movedThisTurn: true,
                actedThisTurn: true
            },
            config
        );
        const state = recomputeVisibilityFromScratch({
            ...base,
            player,
            initiativeQueue: buildInitiativeQueue({
                ...base,
                player
            }),
            occupancyMask: SpatialSystem.refreshOccupancyMask({
                ...base,
                player
            })
        });

        const result = selectGenericUnitAiAction({
            state,
            actor: state.player,
            side: 'player',
            simSeed: 'coherence-recover-goal',
            decisionCounter: 0,
            goal: 'recover'
        });

        expect(result.summary.goal).toBe('recover');
        expect(result.selected.action.type).toBe('WAIT');
        expect(result.summary.selectedRestedDecision).not.toBe('spend_battery');
    });
});
