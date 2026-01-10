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
        range: 2,
        cost: 0,
        cooldown: 0,
    },
    execute: (state: GameState, shooter: Actor, target?: Point, activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[] } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages };

        // 1. Validation (Range, Line, Wall, Walkable) - partially duplicated from legacy for safety, but engine handles some
        const dist = hexDistance(shooter.position, target);

        // Custom range calculation if not passing down helpers
        let range = 2;
        if (activeUpgrades.includes('SPEAR_RANGE')) range += 1;

        if (dist > range) {
            messages.push('Out of range!');
            return { effects, messages };
        }

        const line = getHexLine(shooter.position, target);
        const isInLine = line.length > 0 && hexEquals(line[line.length - 1], target);

        if (!isInLine) {
            messages.push('Target must be in a straight line!');
            return { effects, messages };
        }

        // Add visual trail
        effects.push({ type: 'Juice', effect: 'spearTrail', path: line });

        // Check for hits
        const targetEnemy = getEnemyAt(state.enemies, target);

        if (targetEnemy) {
            // Kill Enemy
            effects.push({ type: 'Damage', target: targetEnemy.position, amount: 999 }); // Instakill
            effects.push({ type: 'Message', text: `Spear killed ${targetEnemy.subtype || 'enemy'}!` });

            // Deep Breath: Refresh Jump
            if (activeUpgrades.includes('DEEP_BREATH')) {
                effects.push({ type: 'ModifyCooldown', skillId: 'JUMP', amount: 0, setExact: true });
                messages.push('Deep Breath: Jump refreshed!');
            }

        } else if (state.wallPositions.some(w => hexEquals(w, target))) {
            messages.push('Hit a wall!');
            // Spear should stop before wall? Or just stick in it? 
            // Legacy says: "Target must be a valid walkable tile!"
            // If target is wall, fail?
            return { effects: [], messages: ['Cannot throw into a wall!'] };
        } else {
            // Miss / Ground
            messages.push('Spear thrown.');
        }

        // Handle Recall vs Spawning Item
        const hasRecall = activeUpgrades.includes('RECALL');
        const hasRecallDamage = activeUpgrades.includes('RECALL_DAMAGE');

        if (hasRecall || hasRecallDamage) {
            // Spear returns instantly
            if (hasRecallDamage) {
                // Damage everything on path except shooter
                const path = line.slice(1); // Exclude shooter
                path.forEach(pos => {
                    const enemy = getEnemyAt(state.enemies, pos);
                    if (enemy && (!targetEnemy || enemy.id !== targetEnemy.id)) {
                        effects.push({ type: 'Damage', target: pos, amount: 999 });
                        messages.push(`Spear recall hit ${enemy.subtype}!`);
                    }
                });
                messages.push('Spear recalled with force!');
            } else {
                messages.push('Spear recalled instantly!');
            }
        } else {
            // Spawn Spear Item at target
            effects.push({ type: 'SpawnItem', itemType: 'spear', position: target });
        }

        return { effects, messages };
    },
    upgrades: {
        SPEAR_RANGE: { id: 'SPEAR_RANGE', name: 'Extended Reach', description: 'Range +1', modifyRange: 1 },
        RECALL: { id: 'RECALL', name: 'Recall', description: 'Spear returns instantly' },
        RECALL_DAMAGE: { id: 'RECALL_DAMAGE', name: 'Recall Damage', description: 'Spear damages on return' },
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
                const enemyGone = state.enemies.length === 0;
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
