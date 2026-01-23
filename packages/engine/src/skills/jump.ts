import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, getNeighbors, hexEquals } from '../hex';
import { getEnemyAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';

/**
 * Implementation of the Jump skill using the Compositional Skill Framework.
 */
export const JUMP: SkillDefinition = {
    id: 'JUMP',
    name: 'Jump',
    description: 'Leap to an empty tile within range. Can cross lava but not walls.',
    slot: 'utility',
    icon: '🦘',
    baseVariables: {
        range: 2,
        cost: 0,
        cooldown: 2,
    },
    execute: (state: GameState, attacker: Actor, target?: Point, _activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };
        if (!attacker || !attacker.position) return { effects, messages, consumesTurn: false };

        const dist = hexDistance(attacker.position, target);
        if (dist < 1 || dist > 2) {
            messages.push('Target out of range!');
            return { effects, messages, consumesTurn: false };
        }

        const isWall = state.wallPositions.some(w => hexEquals(w, target));
        const isLava = state.lavaPositions.some(l => hexEquals(l, target));
        const isOccupiedByEnemy = !!getEnemyAt(state.enemies, target);

        if (isWall || isLava || isOccupiedByEnemy) {
            messages.push('Blocked!');
            return { effects, messages, consumesTurn: false };
        }

        // Execute Jump
        effects.push({ type: 'Displacement', target: 'self', destination: target });
        messages.push('Jumped!');

        // AoE Stun (Neighbors)
        const neighbors = getNeighbors(target);
        for (const n of neighbors) {
            const enemy = getEnemyAt(state.enemies, n);
            if (enemy) {
                effects.push({ type: 'ApplyStatus', target: n, status: 'stunned', duration: 1 });
                messages.push(`${enemy.subtype || 'Enemy'} stunned by landing!`);
            }
        }
        effects.push({ type: 'Juice', effect: 'shake' });

        return { effects, messages };
    },
    upgrades: {},
    scenarios: getSkillScenarios('JUMP')
};
