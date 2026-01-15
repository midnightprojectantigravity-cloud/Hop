import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, getNeighbors, hexEquals } from '../hex';
import { getEnemyAt } from '../helpers';

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
    scenarios: [
        {
            id: 'jump_basic',
            title: 'Basic Jump',
            description: 'Jump to a tile.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['JUMP']);
            },
            run: (engine: any) => {
                engine.useSkill('JUMP', { q: 3, r: 4, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                return hexEquals(state.player.position, { q: 3, r: 4, s: -7 }) && logs.some(l => l.includes('Jumped'));
            }
        },
        {
            id: 'jump_stunning_landing',
            title: 'Stunning Landing Test',
            description: 'Jump into a group of enemies and ensure neighbors are stunned.',
            setup: (engine: any) => {
                // Player starts at distance 2
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['JUMP']);
                engine.addUpgrade('JUMP', 'STUNNING_LANDING');

                // Target hex will be (0, 2, -2). 
                // We place enemies in the neighbors of that target hex.
                engine.spawnEnemy('shieldBearer', { q: 3, r: 7, s: -10 }, 'neighbor_1');
                engine.spawnEnemy('shieldBearer', { q: 4, r: 7, s: -11 }, 'neighbor_2');
                // This enemy is too far away to be stunned
                engine.spawnEnemy('shieldBearer', { q: 3, r: 5, s: -8 }, 'distant_enemy');
            },
            run: (engine: any) => {
                // Jump to the center of the neighbors
                engine.useSkill('JUMP', { q: 3, r: 8, s: -11 });
            },
            verify: (state: GameState, logs: string[]) => {
                // Stuns are cleared at end of enemy turn, so check logs instead
                const n1Stunned = logs.filter(l => l.includes('stunned by landing')).length >= 2;
                const distantNotStunned = !logs.some(l => l.includes('distant_enemy') && l.includes('stunned'));
                const playerAtTarget = state.player.position.r === 8;

                return n1Stunned && distantNotStunned && playerAtTarget;
            }
        }
    ]
};
