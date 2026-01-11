import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, hexEquals, hexAdd, hexDirection, getDirectionFromTo } from '../hex';
import { getEnemyAt, isWalkable } from '../helpers';

/**
 * Implementation of the Shield Throw skill (Enyo Secondary)
 * Range 4. Stuns and pushes target 4 tiles.
 */
export const SHIELD_THROW: SkillDefinition = {
    id: 'SHIELD_THROW',
    name: 'Shield Throw',
    description: 'Throw your shield to stun and push an enemy 4 tiles.',
    slot: 'defensive',
    icon: '🛡️',
    baseVariables: {
        range: 4,
        cost: 1,
        cooldown: 3,
    },
    execute: (state: GameState, attacker: Actor, target?: Point, _activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[] } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages };

        const dist = hexDistance(attacker.position, target);
        if (dist > 4) {
            messages.push('Out of range!');
            return { effects, messages };
        }

        const targetEnemy = getEnemyAt(state.enemies, target);
        if (!targetEnemy) {
            messages.push('No target found!');
            return { effects, messages };
        }

        const dirIdx = getDirectionFromTo(attacker.position, target);
        if (dirIdx === -1) return { effects, messages };
        const dirVec = hexDirection(dirIdx);

        // Stun immediately
        effects.push({ type: 'ApplyStatus', target: target, status: 'stunned', duration: 1 });

        // Push 4 tiles
        let pushDest = target;
        for (let i = 0; i < 4; i++) {
            const next = hexAdd(pushDest, dirVec);
            if (isWalkable(next, state.wallPositions, [], state.gridWidth, state.gridHeight)) {
                pushDest = next;
            } else {
                // Impact on wall/obstacle
                if (state.wallPositions.some(w => hexEquals(w, next))) {
                    effects.push({ type: 'Juice', effect: 'impact', target: next });
                    effects.push({ type: 'Juice', effect: 'shake' });
                }
                break;
            }
        }

        effects.push({ type: 'Displacement', target: 'targetActor', destination: pushDest });
        messages.push(`Threw shield! Stunned and pushed ${targetEnemy.subtype || 'enemy'}.`);

        return { effects, messages };
    },
    upgrades: {},
    scenarios: [
        {
            id: 'shield_stun_push',
            title: 'Shield Stun & Push',
            description: 'Verify shield throw stuns and pushes an enemy 4 tiles.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SHIELD_THROW']);
                engine.spawnEnemy('shieldBearer', { q: 3, r: 5, s: -8 }, 'victim');
                engine.applyStatus('victim', 'stunned'); // Prevent movement
            },
            run: (engine: any) => {
                engine.useSkill('SHIELD_THROW', { q: 3, r: 5, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemy = state.enemies.find((e: Actor) => e.id === 'victim');
                // Target at (3,5). Player at (3,6). Dir is (0,-1).
                // Push 4 tiles from (3,5) -> (3,4), (3,3), (3,2), (3,1)
                const pushed = enemy?.position.r === 1;
                const stunMsg = logs.some(l => l.includes('Stunned and pushed'));
                return !!pushed && stunMsg;
            }
        },
        {
            id: 'shield_wall_impact',
            title: 'Shield Wall Impact',
            description: 'Verify shield push stops at wall.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SHIELD_THROW']);
                engine.spawnEnemy('shieldBearer', { q: 3, r: 5, s: -8 }, 'victim');
                engine.setTile({ q: 3, r: 3, s: -6 }, 'wall');
                engine.applyStatus('victim', 'stunned');
            },
            run: (engine: any) => {
                engine.useSkill('SHIELD_THROW', { q: 3, r: 5, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemy = state.enemies.find((e: Actor) => e.id === 'victim');
                // Target at (3,5). Wall at (3,3). 
                // Push from (3,5) -> (3,4). Next is (3,3) which is wall. Stop at (3,4).
                const stopped = enemy?.position.r === 4;
                return !!stopped;
            }
        }
    ]
};
