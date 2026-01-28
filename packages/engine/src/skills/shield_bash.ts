import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors, hexAdd, hexDirection, hexDistance } from '../hex';
import { getEnemyAt, isWithinBounds } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { validateRange, validateAxialDirection, isBlockedByWall, isBlockedByLava } from '../systems/validation';

/**
 * Implementation of the Shield Bash skill using the Compositional Skill Framework.
 */
export const SHIELD_BASH: SkillDefinition = {
    id: 'SHIELD_BASH',
    name: 'Shield Bash',
    description: 'Push an enemy 1 tile. If they hit a wall or another enemy, they are stunned.',
    slot: 'defensive',
    icon: '🛡️',
    baseVariables: {
        range: 1,
        cost: 0,
        cooldown: 2,
    },
    execute: (state: GameState, attacker: Actor, target?: Point, _activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };
        if (!attacker || !attacker.position) return { effects, messages, consumesTurn: false };

        // 1. Validation
        if (!validateRange(attacker.position, target, 1)) {
            messages.push('Target out of range!');
            return { effects, messages, consumesTurn: false };
        }

        // 2. Identify Targets (3-hex Arc)
        // Arc includes target and its two neighbors closest to player
        const targetsToHit: Point[] = [target];
        const neighbors = getNeighbors(target);
        for (const n of neighbors) {
            if (hexDistance(n, attacker.position) === 1 && targetsToHit.length < 3) {
                targetsToHit.push(n);
            }
        }

        let anyCollision = false;

        // 3. Process Bash for each target
        for (const t of targetsToHit) {
            const enemy = getEnemyAt(state.enemies, t);
            if (!enemy) continue;

            const { directionIndex } = validateAxialDirection(attacker.position, t);
            if (directionIndex === -1) continue;
            const dirVec = hexDirection(directionIndex);
            const pushDest = hexAdd(t, dirVec);

            // Check collision
            const blockedByWall = isBlockedByWall(state, pushDest);
            const blockingEnemy = getEnemyAt(state.enemies, pushDest);
            const isOutOfBounds = !isWithinBounds(state, pushDest);

            if (blockedByWall || (blockingEnemy && blockingEnemy.id !== enemy.id) || isOutOfBounds) {
                anyCollision = true;
                effects.push({ type: 'ApplyStatus', target: t, status: 'stunned', duration: 1 });
                messages.push(`Bashed ${enemy.subtype || 'enemy'} into obstacle!`);
            } else if (isBlockedByLava(state, pushDest)) {
                effects.push({ type: 'Displacement', target: enemy.id, destination: pushDest });
                effects.push({ type: 'Juice', effect: 'lavaSink', target: pushDest });
                messages.push(`${enemy.subtype || 'Enemy'} fell into Lava!`);
            } else {
                effects.push({ type: 'Displacement', target: enemy.id, destination: pushDest });
                // MRD says: Pushes targets 1 tile + Stuns.
                effects.push({ type: 'ApplyStatus', target: t, status: 'stunned', duration: 1 });
                messages.push(`Pushed and stunned ${enemy.subtype || 'enemy'}!`);
            }
        }

        if (anyCollision || targetsToHit.length > 0) {
            effects.push({ type: 'Juice', effect: 'shake' });
        }

        return { effects, messages };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        // Can target adjacent hexes that contain someone to bash
        return getNeighbors(origin).filter(n => !!getEnemyAt(state.enemies, n));
    },
    upgrades: {},
    scenarios: getSkillScenarios('SHIELD_BASH')
};
