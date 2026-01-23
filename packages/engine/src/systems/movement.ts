import type { GameState, Point, AtomicEffect } from '../types';
import { hexDistance, hexEquals, getHexLine, getDirectionFromTo, hexDirection, hexAdd } from '../hex';
import { getEnemyAt, isWalkable, isOccupied } from '../helpers';
import { COMPOSITIONAL_SKILLS } from '../skillRegistry';
import { applyEffects, applyAtomicEffect } from './effect-engine';
import { prepareKineticSimulation, translate1DToHex } from './hex-bridge';
import { resolveKineticDash, resolveKineticPulse } from './kinetic-kernel';
import { processTilePass, processTileEnter } from './tile-effects';

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
            const isWall = state.wallPositions.some(w => hexEquals(w, pos));

            if (isWall) {
                return { ...state, message: [...state.message, "Blocked by wall!"].slice(-50) };
            }

            if (enemy) {
                // TACKLE! (Only for Skirmisher with Shield)
                if (isSkirmisher && state.hasShield) {
                    const dirIdx = getDirectionFromTo(actor.position, target);
                    const dirVec = hexDirection(dirIdx);

                    // Push enemy 4 tiles
                    let pushDest = pos;
                    for (let j = 0; j < 4; j++) {
                        const next = hexAdd(pushDest, dirVec);
                        if (isWalkable(next, state.wallPositions, [], state.gridWidth, state.gridHeight)) {
                            pushDest = next;
                        } else {
                            break;
                        }
                    }

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

    // 3. Standard Walkable Check
    if (!isWalkable(target, state.wallPositions, state.lavaPositions, state.gridWidth, state.gridHeight)) {
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
        { type: 'Displacement' as const, target: actorId === 'player' ? 'self' : 'targetActor', destination: target, source: actor.position }
    ];

    let newState = applyEffects(state, moveEffects, { targetId: actorId });

    // 6. Process onEnter tile effects
    // This ensures tiles react when units land on them (walking, dashing, etc.)
    const updatedActor = actorId === 'player' ? newState.player : newState.enemies.find(e => e.id === actorId);
    if (updatedActor) {
        const enterResult = processTileEnter(target, updatedActor, newState);
        if (enterResult.effects.length > 0 || enterResult.messages.length > 0) {
            newState = applyEffects(newState, enterResult.effects, { targetId: actorId });
            newState.message = [...newState.message, ...enterResult.messages].slice(-50);
        }
    }

    return newState;
};

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
            // This is where the magic happens - tiles observe and react to units
            const tileResult = processTilePass(hexPos, actor, state, currentMomentum);

            // Accumulate effects and messages from tile
            effects.push(...tileResult.effects);
            messages.push(...tileResult.messages);

            // Update momentum if tile modified it
            if (tileResult.newMomentum !== undefined) {
                currentMomentum = tileResult.newMomentum;
            }

            // Check if tile interrupted the chain
            if (tileResult.interrupt) {
                deadIds.add(entity.id);
                if (isLead) {
                    chainBroken = true;
                    messages.push(`The chain broke! Remaining momentum lost.`);
                }
                continue;
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
