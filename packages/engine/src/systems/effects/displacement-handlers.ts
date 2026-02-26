import { getDirectionFromTo, getHexLine, hexAdd, hexDirection, hexEquals, pointToKey } from '../../hex';
import type { Actor, GameState, MovementTrace } from '../../types';
import { appendTaggedMessages } from '../engine-messages';
import { SpatialSystem } from '../spatial-system';
import { TileResolver } from '../tiles/tile-effects';
import { UnifiedTileService } from '../tiles/unified-tile-service';
import type { AtomicEffectHandlerMap } from './types';

export const displacementEffectHandlers: AtomicEffectHandlerMap = {
    Displacement: (state, effect, context, api) => {
        let nextState = { ...state };

        let targetActorId = '';
        if (effect.target === 'self') targetActorId = context.sourceId || nextState.player.id;
        else if (effect.target === 'targetActor') targetActorId = context.targetId || '';
        else targetActorId = effect.target;

        if (!targetActorId) return nextState;

        const resolveActor = (s: GameState, actorId: string): Actor | undefined => {
            if (actorId === s.player.id) return s.player;
            return s.enemies.find(e => e.id === actorId);
        };

        const actor = resolveActor(nextState, targetActorId);
        if (!actor) {
            // Target actor may have been removed earlier in the same effect chain.
            // Skip displacement safely instead of crashing path simulation.
            return nextState;
        }

        const origin = effect.source || actor.position;
        const timelineDelayBeforeMoveMs = Math.min(
            3200,
            Math.max(0, api.getBlockingTimelineDurationMs(nextState.timelineEvents))
        );
        let moveEndedEventEmitted = false;
        const isTeleportMovement = !(effect.simulatePath || effect.path || effect.isFling);
        if (origin) {
            nextState = api.appendTimelineEvent(
                nextState,
                'MOVE_START',
                'Displacement',
                { origin, destination: effect.destination, targetActorId },
                { ...context, targetId: targetActorId },
                true,
                220
            );
        }

        if (!origin) return nextState;

        const path = effect.path || getHexLine(origin, effect.destination);
        const shouldSimulate = effect.simulatePath || effect.isFling || !!effect.path;

        let finalDestination = effect.destination;

        if (shouldSimulate && path) {
            const liveActor = resolveActor(nextState, targetActorId);
            if (!liveActor) {
                return nextState;
            }
            const pathResult = TileResolver.processPath(liveActor, path.slice(1), nextState, path.length - 1, {
                ignoreActors: effect.ignoreCollision,
                ignoreGroundHazards: effect.ignoreGroundHazards
            });
            finalDestination = pathResult.lastValidPos;

            if (targetActorId === nextState.player.id) {
                nextState.player = { ...nextState.player, position: finalDestination };
            } else {
                nextState.enemies = nextState.enemies.map(e => e.id === targetActorId ? { ...e, position: finalDestination } : e);
            }

            if (!moveEndedEventEmitted) {
                nextState = api.appendTimelineEvent(
                    nextState,
                    'MOVE_END',
                    'Displacement',
                    { destination: finalDestination, targetActorId },
                    { ...context, targetId: targetActorId },
                    true,
                    260
                );
                moveEndedEventEmitted = true;
            }
            if (pathResult.result.effects.length > 0) {
                nextState = api.appendTimelineEvent(
                    nextState,
                    'ON_PASS',
                    'TilePath',
                    { path: path.slice(1), targetActorId },
                    { ...context, targetId: targetActorId },
                    false,
                    80
                );
                nextState = api.applyEffects(nextState, pathResult.result.effects, { targetId: targetActorId });
            }
            if (pathResult.result.messages.length > 0) {
                nextState.message = appendTaggedMessages(nextState.message, pathResult.result.messages, 'INFO', 'HAZARD');
            }

            const isAlive = (targetActorId === nextState.player.id) || nextState.enemies.some(e => e.id === targetActorId);

            if (!pathResult.interrupt && isAlive) {
                const finalTile = UnifiedTileService.getTileAt(nextState, finalDestination);
                nextState = api.appendTimelineEvent(
                    nextState,
                    'ON_ENTER',
                    'TileEnter',
                    { position: finalDestination, targetActorId, tileBaseId: finalTile?.baseId },
                    { ...context, targetId: targetActorId },
                    false,
                    80
                );
                const liveActorForEntry = resolveActor(nextState, targetActorId);
                if (!liveActorForEntry) {
                    return nextState;
                }
                const entryResult = TileResolver.processEntry(liveActorForEntry, finalTile, nextState);
                if (entryResult.effects.length > 0) {
                    nextState = api.applyEffects(nextState, entryResult.effects, { targetId: targetActorId });
                }
                if (entryResult.messages.length > 0) {
                    nextState.message = appendTaggedMessages(nextState.message, entryResult.messages, 'INFO', 'HAZARD');
                }
            }

            if (pathResult.result.newMomentum && pathResult.result.newMomentum > 0) {
                const lastPos = pathResult.lastValidPos;
                const prevPos = path.length > 1 ? path[path.length - 2] : origin;
                const dirIdx = getDirectionFromTo(prevPos, lastPos);

                if (dirIdx !== -1) {
                    const dirVec = hexDirection(dirIdx);
                    let slidePos = lastPos;
                    let remaining = 5;

                    while (remaining > 0) {
                        const nextSlide = hexAdd(slidePos, dirVec);
                        if (!UnifiedTileService.isWalkable(nextState, nextSlide)) break;

                        const occupant = (targetActorId === nextState.player.id)
                            ? nextState.enemies.find(e => e.hp > 0 && hexEquals(e.position, nextSlide))
                            : (hexEquals(nextState.player.position, nextSlide) ? nextState.player : nextState.enemies.find(e => e.id !== targetActorId && e.hp > 0 && hexEquals(e.position, nextSlide)));

                        if (occupant) break;

                        const tile = UnifiedTileService.getTileAt(nextState, nextSlide);
                        if (tile) {
                            const transition = TileResolver.processTransition(actor as Actor, tile, nextState, 1);
                            slidePos = nextSlide;
                            if (transition.effects.length > 0) {
                                nextState = api.applyEffects(nextState, transition.effects, { targetId: targetActorId });
                            }
                            if (transition.messages.length > 0) {
                                nextState.message = appendTaggedMessages(nextState.message, transition.messages, 'INFO', 'HAZARD');
                            }
                            if (transition.newMomentum === 0 || transition.interrupt) break;
                        } else {
                            slidePos = nextSlide;
                            break;
                        }
                        remaining--;
                    }
                    finalDestination = slidePos;
                }
            }
        }

        const existingVisualEvents = [...(nextState.visualEvents || [])];
        const isKineticTransfer = Boolean(effect.ignoreCollision || effect.isFling);
        const priorKineticSlides = isKineticTransfer
            ? existingVisualEvents.reduce((count, ev) => {
                if (ev.type !== 'kinetic_trace') return count;
                const payload = ev.payload as MovementTrace | undefined;
                if (!payload) return count;
                return (payload.movementType ?? 'slide') === 'slide' ? count + 1 : count;
            }, 0)
            : 0;
        const kineticChainDelayMs = isTeleportMovement
            ? 0
            : (isKineticTransfer ? Math.min(640, priorKineticSlides * 90) : 0);
        const traceStartDelayMs = Math.max(timelineDelayBeforeMoveMs, kineticChainDelayMs);

        const trace: MovementTrace = {
            actorId: targetActorId,
            origin,
            path: effect.path || (isTeleportMovement ? [origin, finalDestination] : getHexLine(origin, finalDestination)),
            destination: finalDestination,
            movementType: isTeleportMovement ? 'teleport' : 'slide',
            durationMs: effect.animationDuration ?? (isTeleportMovement ? 180 : Math.max(120, (effect.path?.length || getHexLine(origin, finalDestination).length) * 110)),
            startDelayMs: traceStartDelayMs,
            wasLethal: nextState.tiles.get(pointToKey(finalDestination))?.traits.has('HAZARDOUS') || false
        };

        const visualEvents = existingVisualEvents;
        if (!isTeleportMovement) {
            let merged = false;
            for (let i = visualEvents.length - 1; i >= 0; i--) {
                const ev = visualEvents[i];
                if (ev.type !== 'kinetic_trace') continue;
                const prev = ev.payload as MovementTrace | undefined;
                if (!prev || prev.actorId !== targetActorId) continue;

                if ((prev.movementType ?? 'slide') === 'slide' && hexEquals(prev.destination, trace.origin)) {
                    const prevPath = (prev.path && prev.path.length > 0) ? prev.path : [prev.origin, prev.destination];
                    const nextPath = (trace.path && trace.path.length > 0) ? trace.path : [trace.origin, trace.destination];
                    const mergedPath = [...prevPath, ...nextPath.slice(1)];
                    visualEvents[i] = {
                        type: 'kinetic_trace' as const,
                        payload: {
                            ...trace,
                            origin: prev.origin,
                            path: mergedPath,
                            durationMs: (prev.durationMs || 0) + (trace.durationMs || 0),
                            startDelayMs: Math.min(prev.startDelayMs ?? traceStartDelayMs, traceStartDelayMs),
                            movementType: 'slide' as const,
                            wasLethal: Boolean(prev.wasLethal || trace.wasLethal),
                        } as MovementTrace
                    };
                    merged = true;
                }
                break;
            }
            if (!merged) {
                visualEvents.push({
                    type: 'kinetic_trace' as const,
                    payload: trace
                });
            }
        } else {
            visualEvents.push({
                type: 'kinetic_trace' as const,
                payload: trace
            });
        }
        nextState.visualEvents = visualEvents;

        if (targetActorId === nextState.player.id) {
            nextState.player = {
                ...nextState.player,
                position: finalDestination,
                previousPosition: isTeleportMovement ? finalDestination : nextState.player.position
            };
        } else {
            const updatePos = (e: Actor) => e.id === targetActorId
                ? { ...e, position: finalDestination, previousPosition: isTeleportMovement ? finalDestination : e.position }
                : e;
            nextState.enemies = nextState.enemies.map(updatePos);
            if (nextState.companions) {
                nextState.companions = nextState.companions.map(updatePos);
            }
        }

        nextState.occupancyMask = SpatialSystem.refreshOccupancyMask(nextState);
        if (!moveEndedEventEmitted) {
            nextState = api.appendTimelineEvent(
                nextState,
                'MOVE_END',
                'Displacement',
                { destination: finalDestination, targetActorId },
                { ...context, targetId: targetActorId },
                true,
                260
            );
        }

        nextState = api.appendSimulationEvent(nextState, {
            type: 'UnitMoved',
            actorId: targetActorId,
            position: finalDestination,
            payload: {
                origin,
                destination: finalDestination,
                movementType: trace.movementType
            }
        });

        return nextState;
    }
};
