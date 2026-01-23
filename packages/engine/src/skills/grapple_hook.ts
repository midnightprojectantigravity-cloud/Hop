import type { SkillDefinition, GameState, Actor, AtomicEffect, Point, WeightClass } from '../types';
import {
    hexDistance, hexAdd, hexSubtract, hexEquals,
    getDirectionFromTo, hexDirection, scaleVector, getHexLine, getNeighbors
} from '../hex';
import { getAxialTargets } from './targeting';
import { getActorAt, isPerimeter } from '../helpers';
import { applyEffects } from '../systems/effect-engine';
import { pullToward, swap, kineticFling } from '../systems/displacement-system';
import { getSkillScenarios } from '../scenarios';
import { SKILL_JUICE_SIGNATURES, JuiceHelpers } from '../systems/juice-manifest';

export const GRAPPLE_HOOK: SkillDefinition = {
    id: 'GRAPPLE_HOOK',
    name: 'Grapple Hook',
    description: 'Pull/Zip mechanism with multi-phase kinetic resolution.',
    slot: 'offensive',
    icon: '🪝',
    baseVariables: { range: 4, cost: 1, cooldown: 3, momentum: 4 },

    execute: (state: GameState, shooter: Actor, target?: Point, _activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        let effects: AtomicEffect[] = [];
        let messages: string[] = [];
        const momentum = 4;

        if (!target) return { effects, messages, consumesTurn: false };

        const fullLine = getHexLine(shooter.position, target);
        let actualTargetPos = target;
        let blockedBy: 'wall' | 'actor' | null = null;
        const dirIdx = getDirectionFromTo(shooter.position, target);
        const dir = hexDirection(dirIdx);

        // JUICE: Anticipation - Aiming laser
        effects.push(...SKILL_JUICE_SIGNATURES.GRAPPLE_HOOK.anticipation(shooter.position, target));

        for (const point of fullLine.slice(1)) {
            const hitWall = state.wallPositions?.some(w => hexEquals(w, point)) ||
                isPerimeter(point, state.gridWidth, state.gridHeight);

            if (hitWall) {
                actualTargetPos = point;
                if (!hexEquals(target, point)) blockedBy = 'wall';
                break;
            }

            const actor = getActorAt(state, point);
            if (actor && actor.id !== shooter.id) {
                actualTargetPos = point;
                if (!hexEquals(target, point)) blockedBy = 'actor';
                break;
            }
        }

        if (blockedBy) {
            messages.push(`Line of sight blocked by ${blockedBy}!`);
            return { effects, messages, consumesTurn: false };
        }

        const targetActor = getActorAt(state, actualTargetPos);
        const isWallTile = state.wallPositions?.some(w => hexEquals(w, actualTargetPos)) ||
            isPerimeter(actualTargetPos, state.gridWidth, state.gridHeight);

        const weightClass: WeightClass = isWallTile ? 'Heavy' : (targetActor as any)?.weightClass || 'Standard';

        // --- CASE A: ZIP TO HEAVY/WALL ---
        if (weightClass === 'Heavy' || weightClass === 'Anchored') {
            const destination = hexSubtract(actualTargetPos, dir);

            // JUICE: Execution - Hook cable + dash blur
            effects.push(...SKILL_JUICE_SIGNATURES.GRAPPLE_HOOK.execution(getHexLine(shooter.position, destination)));

            effects.push({ type: 'Displacement', target: shooter.id, destination });

            const neighbors = getNeighbors(destination);
            for (const n of neighbors) {
                const a = getActorAt(state, n);
                if (a && a.id !== shooter.id) {
                    effects.push({ type: 'Impact', target: a.id, damage: 0, direction: dir });
                    effects.push({ type: 'ApplyStatus', target: a.id, status: 'stunned', duration: 2 });
                    // JUICE: AOE stun burst
                    effects.push(JuiceHelpers.stunBurst(n));
                }
            }

            // JUICE: Impact - Heavy landing
            effects.push(JuiceHelpers.heavyImpact(destination, dir));
            effects.push(JuiceHelpers.shake('high', dir));

            messages.push('Zipped to anchor!');
            return { effects, messages, consumesTurn: true };
        }

        // --- CASE B: THE COMBO FLOW ---
        else if (targetActor) {
            const distance = hexDistance(shooter.position, actualTargetPos);
            const towardShooterVec = hexDirection((dirIdx + 3) % 6);
            const shooterOriginalPos = shooter.position;

            // JUICE: Execution - Hook cable
            effects.push(...SKILL_JUICE_SIGNATURES.GRAPPLE_HOOK.execution(fullLine));

            // --- PHASE 1: THE PULL ---
            const pullEffects = pullToward(state, shooter, actualTargetPos, distance - 1);

            // Create tempState1 to see if victim survived (using the Engine's Truth Machine)
            const tempState1 = applyEffects(state, pullEffects, { sourceId: shooter.id, targetId: targetActor.id });
            const victimStillAlive = tempState1.enemies.find(e => e.id === targetActor.id) ||
                (tempState1.player.id === targetActor.id ? tempState1.player : null);

            if (!victimStillAlive) {
                messages.push(`${targetActor.subtype || 'Enemy'} neutralized during pull.`);
                return {
                    effects: [...effects, ...pullEffects],
                    messages,
                    consumesTurn: true
                };
            }

            // --- PHASE 2: THE SWAP ---
            const swapEffects = swap(shooter, victimStillAlive);

            // JUICE: Impact - Winch effect on swap
            const swapPoint = victimStillAlive.position;
            effects.push(...SKILL_JUICE_SIGNATURES.GRAPPLE_HOOK.impact(swapPoint, dir));

            // Create tempState2 to see where they are for the fling
            const tempState2 = applyEffects(tempState1, swapEffects, { sourceId: shooter.id, targetId: targetActor.id });

            // --- PHASE 3: THE KINETIC FLING ---
            const flingEffects = kineticFling(tempState2, shooterOriginalPos, towardShooterVec, momentum);

            // JUICE: Resolution - Momentum trails + kinetic wave
            const flingPath = getHexLine(shooterOriginalPos, hexAdd(shooterOriginalPos, scaleVector(dirIdx, momentum + 2)));
            effects.push(...SKILL_JUICE_SIGNATURES.GRAPPLE_HOOK.resolution(flingPath, momentum));

            return {
                effects: [...effects, ...pullEffects, ...swapEffects, ...flingEffects],
                messages: ["Vaulted and Flung!"],
                consumesTurn: true
            };
        } else {
            messages.push('Hook missed.');
            return { effects, messages, consumesTurn: false };
        }
    },

    getValidTargets: (state: GameState, origin: Point) => getAxialTargets(state, origin, 4),
    upgrades: {},
    scenarios: getSkillScenarios('GRAPPLE_HOOK')
};
