import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { processKineticPulse } from '../systems/kinetic-kernel';
import { hexEquals, hexDirection, getHexLine } from '../hex';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { applyEffects } from '../systems/effect-engine';
import { SKILL_JUICE_SIGNATURES } from '../systems/juice-manifest';
import { validateAxialDirection, validateRange, findFirstObstacle, canLandOnHazard } from '../systems/validation';
import { SpatialSystem } from '../systems/SpatialSystem';

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
    execute: (state: GameState, attacker: Actor, target?: Point, activeUpgrades: string[] = []) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];
        const hasMomentumSurge = activeUpgrades.includes('MOMENTUM_SURGE');
        const hasChainReaction = activeUpgrades.includes('DASH_CHAIN_REACTION') || activeUpgrades.includes('CHAIN_REACTION');

        if (!target) return { effects, messages, consumesTurn: false };

        const { isAxial, directionIndex } = validateAxialDirection(attacker.position, target);
        // const dist = hexDistance(attacker.position, target);
        const noEnemies = state.enemies.filter(e => e.hp > 0).length === 0;
        const range = noEnemies ? 20 : 4;

        if (!validateRange(attacker.position, target, range)) {
            return { effects, messages: ['Out of range!'], consumesTurn: false };
        }
        if (!isAxial) {
            return { effects, messages: ['Axial only! Dash must be in a straight line.'], consumesTurn: false };
        }

        // JUICE: Anticipation - Charge-up
        effects.push(...SKILL_JUICE_SIGNATURES.DASH.anticipation(attacker.position, target));

        const dir = hexDirection(directionIndex);
        const fullLine = getHexLine(attacker.position, target);

        // findFirstObstacle returns what we hit first
        const obstacleResult = findFirstObstacle(state, fullLine.slice(1), {
            checkWalls: true,
            checkActors: true,
            checkLava: false,
            excludeActorId: attacker.id
        });

        // Determine stop position
        let stopPos = target;
        if (obstacleResult.obstacle) {
            if (obstacleResult.obstacle === 'wall') {
                return { effects, messages: ['A wall blocks the way!'], consumesTurn: false };
            }
            if (obstacleResult.obstacle === 'lava') {
                return { effects, messages: ['Lava blocks the way!'], consumesTurn: false };
            }

            // If actor, we stop BEFORE them
            const obstacleIdx = fullLine.findIndex(p => hexEquals(p, obstacleResult.position!));
            stopPos = fullLine[obstacleIdx - 1] || attacker.position;
        }

        const hitActor = obstacleResult.obstacle === 'actor' ? obstacleResult.actor : null;

        if (hitActor) {
            // JUICE: Execution - Dash blur + momentum trail
            const dashPath = getHexLine(attacker.position, stopPos);
            effects.push(...SKILL_JUICE_SIGNATURES.DASH.execution(dashPath));

            const preFlightEffects: AtomicEffect[] = [
                {
                    type: 'Displacement',
                    target: 'self',
                    destination: stopPos,
                    path: dashPath,
                    simulatePath: true,
                    ignoreGroundHazards: true,
                    animationDuration: dashPath.length * 60  // 60ms per tile (fast dash)
                }
            ];
            // We apply it here to a tempState just to calculate kinetic pulses accurately
            const tempState = applyEffects(state, preFlightEffects, { sourceId: attacker.id });

            if (state.hasShield) {
                // JUICE: Impact - Heavy (extreme shake + freeze)
                effects.push(...SKILL_JUICE_SIGNATURES.DASH.impact(stopPos, dir, true));

                // Trigger Kinetic Pulse (Momentum 5)
                const momentum = 5
                    + (state.hasShield && hasMomentumSurge ? 2 : 0)
                    + (hasChainReaction ? 1 : 0);
                const pulseEffects = processKineticPulse(tempState, {
                    origin: stopPos,
                    direction: dir,
                    momentum
                });

                // IMPORTANT: The displacement MUST be in the final effects list!
                return {
                    effects: [...effects, ...preFlightEffects, ...pulseEffects],
                    messages: [...messages, "Shield Shunt!"],
                    consumesTurn: true
                };
            } else {
                // JUICE: Impact - Light (no shield)
                effects.push(...SKILL_JUICE_SIGNATURES.DASH.impact(stopPos, dir, false));

                return {
                    effects: [...effects, ...preFlightEffects],
                    messages: [...messages, "Stopped by an obstacle (Need shield to shunt)."],
                    consumesTurn: !hexEquals(attacker.position, stopPos)
                };
            }
        } else {
            // JUICE: Execution - Dash blur + momentum trail (normal dash)
            const dashPath = getHexLine(attacker.position, stopPos);
            effects.push(...SKILL_JUICE_SIGNATURES.DASH.execution(dashPath));

            const moveEff: AtomicEffect = {
                type: 'Displacement',
                target: 'self',
                destination: stopPos,
                path: dashPath,
                simulatePath: true,
                ignoreGroundHazards: true,
                animationDuration: dashPath.length * 60  // 60ms per tile
            };

            return {
                effects: [...effects, moveEff],
                messages: [...messages, "Dashed!"],
                consumesTurn: !hexEquals(attacker.position, stopPos)
            };
        }
    },

    getValidTargets: (state: GameState, origin: Point) => {
        const noEnemies = state.enemies.filter(e => e.hp > 0).length === 0;
        const range = noEnemies ? 20 : 4;
        const actor = getActorAt(state, origin) as Actor | undefined;
        if (!actor) return [];
        return SpatialSystem.getAxialTargets(state, origin, range, {
            stopAtObstacles: true,
            includeActors: true,
            includeWalls: false
        }).filter(p => canLandOnHazard(state, actor, p));
    },

    upgrades: {
        'MOMENTUM_SURGE': {
            id: 'MOMENTUM_SURGE',
            name: 'Momentum Surge',
            description: '+2 Momentum when dashing with shield',
        },
        'DASH_CHAIN_REACTION': {
            id: 'DASH_CHAIN_REACTION',
            name: 'Chain Reaction',
            description: 'Enemies pushed into other enemies transfer momentum',
        }
    },
    scenarios: getSkillScenarios('DASH')
};
