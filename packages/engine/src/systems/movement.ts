import type { GameState, Point, AtomicEffect } from '../types';
import { hexDistance, hexEquals, getHexLine, getDirectionFromTo, hexDirection, hexAdd, pointToKey } from '../hex';
import { getEnemyAt, isOccupied } from '../helpers';
import { COMPOSITIONAL_SKILLS } from '../skillRegistry';
import { applyEffects, applyAtomicEffect } from './effect-engine';
import { prepareKineticSimulation, translate1DToHex } from './hex-bridge';
import { resolveKineticDash, resolveKineticPulse } from './kinetic-kernel';
import { TileResolver } from './tile-effects';
import { UnifiedTileService } from './unified-tile-service';


/**
 * Movement System
 * Handles all logic related to actor movement, dashing, and tackling.
 */
export const resolveMove = (state: GameState, actorId: string, target: Point): GameState => {
    const actor = actorId === 'player' ? state.player : state.enemies.find(e => e.id === actorId);
    if (!actor) return state;

    const dist = hexDistance(actor.position, target);
    const isSkirmisher = actor.archetype === 'SKIRMISHER';
    const maxDist = isSkirmisher ? 4 : 1;

    // 1. Range Check
    if (dist < 1 || dist > maxDist) return state;

    // 2. Dash Logic (dist > 1)
    if (dist > 1) {
        const line = getHexLine(actor.position, target);
        if (!hexEquals(line[line.length - 1], target)) return state;

        // Check if path is clear or if tackle is possible
        const path = line.slice(1); // Exclude start
        for (let i = 0; i < path.length; i++) {
            const pos = path[i];
            const enemy = getEnemyAt(state.enemies, pos);
            if (UnifiedTileService.getTraitsAt(state, pos).has('BLOCKS_MOVEMENT')) {
                return { ...state, message: [...state.message, "Blocked by wall!"].slice(-50) };
            }

            if (enemy) {
                // TACKLE! (Only for Skirmisher with Shield)
                if (isSkirmisher && state.hasShield) {
                    const dirIdx = getDirectionFromTo(actor.position, target);
                    const dirVec = hexDirection(dirIdx);

                    // Push enemy with momentum (standard 4)
                    let currentPos = pos;
                    let currentMomentum = 4;

                    while (currentMomentum > 0) {
                        const next = hexAdd(currentPos, dirVec);
                        const walkable = UnifiedTileService.isWalkable(state, next);

                        if (!walkable) break;

                        const tile = state.tiles.get(pointToKey(next));
                        if (tile) {
                            const transition = TileResolver.processTransition(enemy, tile, state, currentMomentum);
                            currentMomentum = transition.newMomentum ?? (currentMomentum - 1);
                            if (transition.interrupt) break;
                        } else {
                            currentMomentum -= 1;
                        }

                        currentPos = next;
                    }

                    const pushDest = currentPos;

                    // Apply displacement and stun to enemy
                    let newState = state;
                    newState = applyAtomicEffect(newState, { type: 'Displacement', target: 'targetActor', destination: pushDest }, { targetId: enemy.id });
                    newState = applyAtomicEffect(newState, { type: 'ApplyStatus', target: pushDest, status: 'stunned', duration: 1 }, { targetId: enemy.id });
                    newState = applyAtomicEffect(newState, { type: 'Juice', effect: 'shake', intensity: 'medium' });
                    newState = applyAtomicEffect(newState, { type: 'Juice', effect: 'impact', target: pos }); // Impact at original enemy pos
                    newState.message.push(`Tackled ${enemy.subtype}!`);

                    // Player stops at enemy's old position
                    return applyEffects(newState, [{ type: 'Displacement', target: actorId === 'player' ? 'self' : 'targetActor', destination: pos }], { targetId: actorId });
                } else {
                    return { ...state, message: [...state.message, "Blocked by enemy!"].slice(-50) };
                }
            }
        }
    }

    // 3. Continuous Path Evaluation (Hazards & Walls)
    const line = getHexLine(actor.position, target);
    const path = line.slice(1);

    const pathResult = TileResolver.processPath(actor, path, state);

    if (pathResult.interrupt) {
        // 1. Move to the lethal hex (lastValidPos is where the actor ended up)
        let newState = applyEffects(state, [{
            type: 'Displacement' as const,
            target: actorId === 'player' ? 'self' : 'targetActor',
            destination: pathResult.lastValidPos
        }], { targetId: actorId });

        // 2. Apply lethal effects (Damage/Death/Juice)
        return applyEffects(newState, pathResult.result.effects, { targetId: actorId });
    }

    // 4. Standard Blocked Check (Walls/Actors)
    if (!UnifiedTileService.isWalkable(state, pathResult.lastValidPos)) {
        return { ...state, message: [...state.message, "Blocked!"].slice(-50) };
    }


    // 4. Occupied Check (Distance 1)
    if (isOccupied(target, state)) {
        const targetEnemy = getEnemyAt(state.enemies, target);
        if (targetEnemy && dist === 1 && actorId === 'player') {
            const basicAttackDef = COMPOSITIONAL_SKILLS['BASIC_ATTACK'];
            const basicAttackSkill = state.player.activeSkills?.find(ss => ss.id === 'BASIC_ATTACK');

            if (basicAttackDef && basicAttackSkill) {
                const execution = basicAttackDef.execute(state, state.player, target, basicAttackSkill.activeUpgrades);
                let newState = applyEffects(state, execution.effects, { targetId: targetEnemy.id });
                newState.message = [...newState.message, ...execution.messages].slice(-50);
                return newState;
            }
        }
        return { ...state, message: [...state.message, "Tile occupied!"].slice(-50) };
    }

    // 5. Apply Movement
    const moveEffects: AtomicEffect[] = [
        { type: 'Displacement' as const, target: actorId === 'player' ? 'self' : 'targetActor', destination: target, source: actor.position, path: [actor.position, ...path] }
    ];

    let newState = applyEffects(state, moveEffects, { targetId: actorId });

    // 6. Sliding / Continuous Momentum
    // If the TileResolver indicated we have momentum left (e.g. SLIPPERY), continue moving in the same direction
    if (pathResult.result.newMomentum && pathResult.result.newMomentum > 0) {
        const lastPos = path[path.length - 1];
        const prevPos = path[path.length - 2] || actor.position;
        const dir = getDirectionFromTo(prevPos, lastPos);

        if (dir !== -1) {
            const nextHex = hexAdd(lastPos, hexDirection(dir));
            return resolveMove(newState, actorId, nextHex);
        }
    }

    // 7. Process onEnter tile effects
    // This ensures tiles react when units land on them (walking, dashing, etc.)
    const updatedActor = actorId === 'player' ? newState.player : newState.enemies.find(e => e.id === actorId);
    if (updatedActor) {
        const tile = newState.tiles.get(pointToKey(target));
        if (tile) {
            const enterResult = TileResolver.processEntry(updatedActor, tile, newState);
            if (enterResult.effects.length > 0 || enterResult.messages.length > 0) {
                newState = applyEffects(newState, enterResult.effects, { targetId: actorId });
                newState.message = [...newState.message, ...enterResult.messages].slice(-50);
            }
        }
    }

    return newState;
}

export interface KineticRequest {
    sourceId: string;
    target: Point;
    momentum: number;
    isPulse?: boolean; // If true, uses resolveKineticPulse (no shooter teleport)
    skipSourceDisplacement?: boolean;
}

export interface KineticStep {
    actorId: string;
    hexPos: Point;
    isLead: boolean;
}

export interface KineticResult {
    steps: KineticStep[][];
    effects: AtomicEffect[];
    messages: string[];
}

/**
 * processKineticRequest
 * Orchestrates the translation of hex coordinates to the 1D kinetic kernel and back.
 * Returns the final positions and collision data, including environmental hazards.
 * 
 * NOW USES TILE EFFECTS SYSTEM:
 * - Processes onPass hooks for each tile during movement
 * - Tiles can modify momentum and trigger effects
 * - Supports interruption of movement chains
 */
export function processKineticRequest(state: GameState, request: KineticRequest): KineticResult {
    const simulation = prepareKineticSimulation(request.sourceId, request.target, request.momentum, state);
    const intention = request.isPulse
        ? resolveKineticPulse(simulation.state)
        : resolveKineticDash(simulation.state);

    const effects: AtomicEffect[] = [];
    const messages: string[] = [];
    const deadIds = new Set<string>();
    let chainBroken = false;
    let currentMomentum = request.momentum;

    const steps: KineticStep[][] = [];

    for (let p = 0; p < intention.steps.length; p++) {
        if (chainBroken) break;

        const pulseState = intention.steps[p];
        const leadId = intention.activeIdAtStep[p];
        const pulseSteps: KineticStep[] = [];

        // Sort front-to-back to ensure hazards hit the front unit first
        const sortedEntities = [...pulseState].sort((a, b) => b.pos - a.pos);

        for (const entity of sortedEntities) {
            if (entity.type === 'I' || entity.type === 'L' || deadIds.has(entity.id)) continue;

            const hexPos = translate1DToHex(simulation.origin, simulation.directionVector, entity.pos);
            const isLead = entity.id === leadId;

            // Get the actor from state
            const actor = entity.id === state.player.id
                ? state.player
                : state.enemies.find(e => e.id === entity.id);

            if (!actor) continue;

            // TILE EFFECTS: Process onPass for this tile
            const tile = state.tiles.get(pointToKey(hexPos));
            if (tile) {
                const tileResult = TileResolver.processTransition(actor, tile, state, currentMomentum);

                // Accumulate effects and messages from tile
                effects.push(...tileResult.effects);
                messages.push(...tileResult.messages);

                // Update momentum if tile modified it
                if (tileResult.newMomentum !== undefined) {
                    currentMomentum = tileResult.newMomentum;
                }

                // Check if tile interrupted (LAVA/VOID death)
                if (tileResult.interrupt) {
                    deadIds.add(entity.id);
                    // Add the final displacement to the dead position
                    pulseSteps.push({ actorId: entity.id, hexPos, isLead });
                    effects.push({
                        type: 'Displacement',
                        target: entity.id === state.player.id ? 'self' : entity.id,
                        destination: hexPos
                    });

                    if (isLead) {
                        chainBroken = true;
                    }
                    continue;
                }
            }


            // 2. Add to pulse steps
            pulseSteps.push({ actorId: entity.id, hexPos, isLead });

            // 3. Generate Displacement Effect
            if (entity.id === request.sourceId && request.skipSourceDisplacement) continue;

            effects.push({
                type: 'Displacement',
                target: entity.id === request.sourceId ? 'self' : entity.id,
                destination: hexPos
            });
        }
        steps.push(pulseSteps);
    }

    // 4. Collision/Impact Check (Kernel-level remaining momentum)
    if (intention.remainingMomentum > 0) {
        // Find the lead unit that hit the obstacle
        const frontUnit = steps[steps.length - 1]?.find(s => s.isLead);
        if (frontUnit) {
            effects.push({
                type: 'ApplyStatus',
                target: frontUnit.hexPos,
                status: 'stunned',
                duration: 1
            });
            messages.push(`${frontUnit.actorId} hit an obstacle and was stunned!`);
        }
    }

    return { steps, effects, messages };
}
