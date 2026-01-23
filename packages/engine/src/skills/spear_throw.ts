import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, getHexLine, hexEquals, isHexInRectangularGrid } from '../hex';
import { getEnemyAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { SKILL_JUICE_SIGNATURES } from '../systems/juice-manifest';

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

        const dist = hexDistance(shooter.position, target);
        let range = 3;
        if (activeUpgrades.includes('SPEAR_RANGE')) range += 1;

        if (dist > range) {
            messages.push('Out of range!');
            return { effects, messages, consumesTurn: false };
        }

        // JUICE: Anticipation - Red aiming laser
        effects.push(...SKILL_JUICE_SIGNATURES.SPEAR_THROW.anticipation(shooter.position, target));

        const line = getHexLine(shooter.position, target);

        // Find the first obstacle (enemy or wall)
        let hitPos = target;
        let hitEnemy = undefined;

        for (let i = 1; i < line.length; i++) {
            const p = line[i];
            const obstacle = getEnemyAt(state.enemies, p);
            const isWall = state.wallPositions.some(w => hexEquals(w, p));
            if (obstacle || isWall) {
                hitPos = p;
                hitEnemy = obstacle;
                break;
            }
        }

        // JUICE: Execution - Spear trail + whistle
        effects.push(...SKILL_JUICE_SIGNATURES.SPEAR_THROW.execution(getHexLine(shooter.position, hitPos)));

        if (hitEnemy) {
            // JUICE: Impact - Heavy (kill)
            effects.push(...SKILL_JUICE_SIGNATURES.SPEAR_THROW.impact(hitPos, true));

            effects.push({ type: 'Damage', target: hitEnemy.position, amount: 99 });
            messages.push(`Spear killed ${hitEnemy.subtype || 'enemy'}!`);
        } else if (state.wallPositions.some(w => hexEquals(w, hitPos))) {
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
        // Enforce straight line (axial) and range
        const range = 3;
        const valid: Point[] = [];
        for (let d = 0; d < 6; d++) {
            for (let i = 1; i <= range; i++) {
                const p = {
                    q: origin.q + i * [1, 1, 0, -1, -1, 0][d],
                    r: origin.r + i * [0, -1, -1, 0, 1, 1][d],
                    s: origin.s + i * [-1, 0, 1, 1, 0, -1][d]
                };
                if (!isHexInRectangularGrid(p, state.gridWidth, state.gridHeight)) break;

                const isWall = state.wallPositions.some(w => hexEquals(w, p));
                const enemy = getEnemyAt(state.enemies, p);

                valid.push(p);
                if (isWall || enemy) break; // Blocked
            }
        }
        return valid;
    },
    upgrades: {
        SPEAR_RANGE: { id: 'SPEAR_RANGE', name: 'Extended Reach', description: 'Range +1', modifyRange: 1 },
    },
    scenarios: getSkillScenarios('SPEAR_THROW')
};
