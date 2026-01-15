import type { GameState, Point, AtomicEffect } from '../types';
import { hexDistance, hexEquals, getHexLine, getDirectionFromTo, hexDirection, hexAdd } from '../hex';
import { getEnemyAt, isWalkable, isOccupied } from '../helpers';
import { COMPOSITIONAL_SKILLS } from '../skillRegistry';
import { applyEffects, applyAtomicEffect } from '../effectEngine';

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

    return applyEffects(state, moveEffects, { targetId: actorId });
};
