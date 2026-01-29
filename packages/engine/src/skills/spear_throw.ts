import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getHexLine } from '../hex';

import { getSkillScenarios } from '../scenarios';
import { SKILL_JUICE_SIGNATURES } from '../systems/juice-manifest';
import { validateAxialDirection, validateRange, findFirstObstacle } from '../systems/validation';
import { SpatialSystem } from '../systems/SpatialSystem';

/**
 * Implementation of the Spear Throw skill using the Compositional Skill Framework.
 */
export const SPEAR_THROW: SkillDefinition = {
    id: 'SPEAR_THROW',
    name: 'Spear Throw',
    description: 'Throw your spear to instantly kill an enemy. Retrieve to use again.',
    slot: 'offensive',
    icon: '🔱',
    baseVariables: {
        range: 3,
        cost: 0,
        cooldown: 0,
        damage: 1,
    },
    execute: (state: GameState, shooter: Actor, target?: Point, activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        if (!state.hasSpear) {
            messages.push('Spear not in hand!');
            return { effects, messages, consumesTurn: false };
        }

        let range = 3;
        if (activeUpgrades.includes('SPEAR_RANGE')) range += 1;

        if (!validateRange(shooter.position, target, range)) {
            messages.push('Out of range!');
            return { effects, messages, consumesTurn: false };
        }

        const { isAxial } = validateAxialDirection(shooter.position, target);
        if (!isAxial) {
            // Though getValidTargets filters axial, we should ideally check here if strict axial is required
            // For now sticking to original behavior which didn't explicitly check axial in execute but did in getValidTargets
        }

        // JUICE: Anticipation - Red aiming laser
        effects.push(...SKILL_JUICE_SIGNATURES.SPEAR_THROW.anticipation(shooter.position, target));

        const line = getHexLine(shooter.position, target);

        // findFirstObstacle returns what we hit first
        const obstacleResult = findFirstObstacle(state, line.slice(1), {
            checkWalls: true,
            checkActors: true,
            excludeActorId: shooter.id
        });

        let hitPos = target;
        let hitEnemy = undefined;

        if (obstacleResult.obstacle) {
            hitPos = obstacleResult.position!;
            if (obstacleResult.obstacle === 'actor') {
                hitEnemy = obstacleResult.actor;
            }
        }

        // JUICE: Execution - Spear trail + whistle
        effects.push(...SKILL_JUICE_SIGNATURES.SPEAR_THROW.execution(getHexLine(shooter.position, hitPos)));

        if (hitEnemy) {
            // JUICE: Impact - Heavy (kill)
            effects.push(...SKILL_JUICE_SIGNATURES.SPEAR_THROW.impact(hitPos, true));

            effects.push({ type: 'Damage', target: hitEnemy.position, amount: 99 });
            messages.push(`Spear killed ${hitEnemy.subtype || 'enemy'}!`);
        } else if (obstacleResult.obstacle === 'wall') {
            messages.push('Spear hit a wall!');
        } else {
            // JUICE: Impact - Light (miss)
            effects.push(...SKILL_JUICE_SIGNATURES.SPEAR_THROW.impact(hitPos, false));

            messages.push('Spear thrown.');
        }

        // Spawn Spear Item at hit position
        effects.push({ type: 'SpawnItem', itemType: 'spear', position: hitPos });

        return { effects, messages };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const range = 3;
        return SpatialSystem.getAxialTargets(state, origin, range, {
            stopAtObstacles: true,
            includeActors: true,
            includeWalls: true
        });
    },
    upgrades: {
        SPEAR_RANGE: { id: 'SPEAR_RANGE', name: 'Extended Reach', description: 'Range +1', modifyRange: 1 },
    },
    scenarios: getSkillScenarios('SPEAR_THROW')
};
