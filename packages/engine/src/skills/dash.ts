import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { processKineticPulse } from '../systems/kinetic-kernel';
import { hexEquals, hexDistance, getDirectionFromTo, hexDirection, getHexLine, hexAdd, hexSubtract, scaleVector } from '../hex';
import { getActorAt, isPerimeter, isWithinBounds } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { applyEffects } from '../systems/effect-engine';
import { SKILL_JUICE_SIGNATURES, JuiceHelpers } from '../systems/juice-manifest';

/**
 * KINETIC DASH Skill
 * 
 * A momentum-based dash that uses the Kinetic Pulse physics system.
 */
export const DASH: SkillDefinition = {
    id: 'DASH',
    name: 'Kinetic Dash',
    description: 'Dash in a straight line. With a shield, slam into enemies and send them flying!',
    slot: 'passive',
    icon: '💨',
    baseVariables: {
        range: 4,
        cost: 0,
        cooldown: 0,
    },
    execute: (state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const dist = hexDistance(attacker.position, target);
        const dirIdx = getDirectionFromTo(attacker.position, target);
        const range = state.enemies.filter(e => e.hp > 0).length === 0 ? 20 : 4;

        if (dist < 1 || dist > range) {
            return { effects, messages: ['Out of range!'], consumesTurn: false };
        }
        if (dirIdx === -1) {
            return { effects, messages: ['Axial only! Dash must be in a straight line.'], consumesTurn: false };
        }

        // JUICE: Anticipation - Charge-up
        effects.push(...SKILL_JUICE_SIGNATURES.DASH.anticipation(attacker.position, target));

        const dir = hexDirection(dirIdx);
        const fullLine = getHexLine(attacker.position, target);

        let stopPos = attacker.position;
        let hitActor: Actor | null = null;
        let blockedByWall = false;
        let blockedByLava = false;

        for (const point of fullLine.slice(1)) {
            // 1. Wall/Perimeter Check
            const isWall = state.wallPositions?.some(w => hexEquals(w, point)) ||
                isPerimeter(point, state.gridWidth, state.gridHeight);
            if (isWall) {
                blockedByWall = true;
                break;
            }

            // 2. Lava Check (Impassable - stay at current stopPos)
            const isLava = state.lavaPositions?.some(l => hexEquals(l, point));
            if (isLava) {
                blockedByLava = true;
                break;
            }

            // 3. Actor Interception
            const actor = getActorAt(state, point);
            if (actor && actor.id !== attacker.id) {
                hitActor = actor;
                break;
            }

            stopPos = point;
            if (hexEquals(point, target)) break;
        }

        // Apply Player Displacement
        if (blockedByWall) {
            return { effects, messages: ['A wall blocks the way!'], consumesTurn: false };
        } else if (blockedByLava) {
            return { effects, messages: ['Lava blocks the way!'], consumesTurn: false };
        } else if (hitActor) {
            // JUICE: Execution - Dash blur + momentum trail
            const dashPath = getHexLine(attacker.position, stopPos);
            effects.push(...SKILL_JUICE_SIGNATURES.DASH.execution(dashPath));

            const preFlightEffects: AtomicEffect[] = [
                {
                    type: 'Displacement',
                    target: 'self',
                    destination: stopPos,
                    path: dashPath,
                    animationDuration: dashPath.length * 60  // 60ms per tile (fast dash)
                }
            ];
            const tempState = applyEffects(state, preFlightEffects, { sourceId: attacker.id });

            if (state.hasShield) {
                // JUICE: Impact - Heavy (extreme shake + freeze)
                effects.push(...SKILL_JUICE_SIGNATURES.DASH.impact(stopPos, dir, true));

                // Trigger Kinetic Pulse (Momentum 5)
                const pulseEffects = processKineticPulse(tempState, {
                    origin: stopPos,
                    direction: dir,
                    momentum: 5
                });
                effects.push(...pulseEffects);

                // JUICE: Resolution - Kinetic wave + momentum trails
                const kineticPath = getHexLine(stopPos, hexAdd(stopPos, scaleVector(dirIdx, 6)));
                effects.push(...SKILL_JUICE_SIGNATURES.DASH.resolution(kineticPath));

                messages.push("Shield Shunt!");
            } else {
                // JUICE: Impact - Light (no shield)
                effects.push(...SKILL_JUICE_SIGNATURES.DASH.impact(stopPos, dir, false));
                messages.push("Stopped by an obstacle (Need shield to shunt).");
            }
        } else {
            // JUICE: Execution - Dash blur + momentum trail (normal dash)
            const dashPath = getHexLine(attacker.position, stopPos);
            effects.push(...SKILL_JUICE_SIGNATURES.DASH.execution(dashPath));

            effects.push({
                type: 'Displacement',
                target: 'self',
                destination: stopPos,
                path: dashPath,
                animationDuration: dashPath.length * 60  // 60ms per tile
            });
            messages.push("Dashed!");
        }

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },

    getValidTargets: (state: GameState, origin: Point) => {
        const noEnemies = state.enemies.filter(e => e.hp > 0).length === 0;
        const range = noEnemies ? 20 : 4;
        const valid: Point[] = [];

        for (let d = 0; d < 6; d++) {
            for (let i = 1; i <= range; i++) {
                const p = hexAdd(origin, scaleVector(d, i));
                if (!isWithinBounds(state, p)) break;

                const isWall = state.wallPositions?.some(w => hexEquals(w, p)) ||
                    isPerimeter(p, state.gridWidth, state.gridHeight);
                if (isWall) break;

                const isLava = state.lavaPositions?.some(l => hexEquals(l, p));
                if (isLava) break; // Cannot dash into lava

                const actor = getActorAt(state, p);
                valid.push(p);

                // Path is blocked for passing, but we can target the obstacle itself
                if (actor) break;
            }
        }
        return valid;
    },

    upgrades: {
        'MOMENTUM_SURGE': {
            id: 'MOMENTUM_SURGE',
            name: 'Momentum Surge',
            description: '+2 Momentum when dashing with shield',
        },
        'CHAIN_REACTION': {
            id: 'CHAIN_REACTION',
            name: 'Chain Reaction',
            description: 'Enemies pushed into other enemies transfer momentum',
        }
    },
    scenarios: getSkillScenarios('DASH')
};
