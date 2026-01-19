import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, getHexLine, hexEquals, isHexInRectangularGrid } from '../hex';
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
    execute: (state: GameState, shooter: Actor, target?: Point, activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const dist = hexDistance(shooter.position, target);
        let range = 3;
        if (activeUpgrades.includes('SPEAR_RANGE')) range += 1;

        if (dist > range) {
            messages.push('Out of range!');
            return { effects, messages, consumesTurn: false };
        }

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

        // Add visual trail to hit point
        effects.push({ type: 'Juice', effect: 'spearTrail', path: getHexLine(shooter.position, hitPos) });

        if (hitEnemy) {
            effects.push({ type: 'Damage', target: hitEnemy.position, amount: 99 });
            messages.push(`Spear killed ${hitEnemy.subtype || 'enemy'}!`);
        } else if (state.wallPositions.some(w => hexEquals(w, hitPos))) {
            messages.push('Spear hit a wall!');
        } else {
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
