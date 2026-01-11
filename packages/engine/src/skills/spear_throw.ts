import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, getHexLine, hexEquals } from '../hex';
import { getEnemyAt } from '../helpers';

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
    execute: (state: GameState, shooter: Actor, target?: Point, activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[] } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages };

        const dist = hexDistance(shooter.position, target);
        let range = 3;
        if (activeUpgrades.includes('SPEAR_RANGE')) range += 1;

        if (dist > range) {
            messages.push('Out of range!');
            return { effects, messages };
        }

        const line = getHexLine(shooter.position, target);

        // Add visual trail
        effects.push({ type: 'Juice', effect: 'spearTrail', path: line });

        // Check for hits
        const targetEnemy = getEnemyAt(state.enemies, target);

        if (targetEnemy) {
            effects.push({ type: 'Damage', target: targetEnemy.position, amount: 99 });
            messages.push(`Spear killed ${targetEnemy.subtype || 'enemy'}!`);
        } else if (state.wallPositions.some(w => hexEquals(w, target))) {
            return { effects: [], messages: ['Cannot throw into a wall!'] };
        } else {
            messages.push('Spear thrown.');
        }

        // Spawn Spear Item at target (Projectile stays on the ground)
        effects.push({ type: 'SpawnItem', itemType: 'spear', position: target });

        return { effects, messages };
    },
    upgrades: {
        SPEAR_RANGE: { id: 'SPEAR_RANGE', name: 'Extended Reach', description: 'Range +1', modifyRange: 1 },
    },
    scenarios: [
        {
            id: 'spear_kill',
            title: 'Spear Kill',
            description: 'Throw spear to kill an enemy.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SPEAR_THROW']);
                engine.spawnEnemy('footman', { q: 3, r: 4, s: -7 }, 'target');
            },
            run: (engine: any) => {
                engine.useSkill('SPEAR_THROW', { q: 3, r: 4, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemyGone = !state.enemies.find(e => e.id === 'target');
                const messageOk = logs.some(l => l.includes('Spear killed'));
                return enemyGone && messageOk;
            }
        },
        {
            id: 'spear_miss_spawn',
            title: 'Spear Miss & Spawn',
            description: 'Throw spear at empty tile, spawning the item.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SPEAR_THROW']);
            },
            run: (engine: any) => {
                engine.useSkill('SPEAR_THROW', { q: 3, r: 4, s: -7 });
            },
            verify: (state: GameState) => {
                const hasItem = hexEquals(state.spearPosition!, { q: 3, r: 4, s: -7 });
                const notHasSpear = state.hasSpear === false;
                return hasItem && notHasSpear;
            }
        }
    ]
};
