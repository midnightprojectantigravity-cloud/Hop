import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors, hexEquals } from '../hex';
import { getEnemyAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { isBlockedByWall, isBlockedByLava, isBlockedByActor, validateRange } from '../systems/validation';
import { SpatialSystem } from '../systems/SpatialSystem';

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

        if (!validateRange(attacker.position, target, 2)) {
            messages.push('Target out of range!');
            return { effects, messages, consumesTurn: false };
        }

        if (isBlockedByWall(state, target) || isBlockedByLava(state, target) || isBlockedByActor(state, target)) {
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
    getValidTargets: (state: GameState, origin: Point) => {
        const range = 2;
        return SpatialSystem.getAreaTargets(state, origin, range).filter(p => {
            if (hexEquals(p, origin)) return false;
            return !isBlockedByWall(state, p) && !isBlockedByLava(state, p) && !isBlockedByActor(state, p);
        });
    },
    upgrades: {},
    scenarios: getSkillScenarios('JUMP')
};
