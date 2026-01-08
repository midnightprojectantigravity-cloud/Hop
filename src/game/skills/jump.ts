import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, getNeighbors, hexEquals } from '../hex';
import { getEnemyAt, isWalkable, isOccupied } from '../helpers';

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
    execute: (state: GameState, attacker: Actor, target?: Point, activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];
        let consumesTurn = true;

        if (!target) return { effects, messages };
        if (!attacker || !attacker.position) return { effects, messages };

        // 1. Validation
        let range = 2;
        if (activeUpgrades.includes('JUMP_RANGE')) range += 1;

        const dist = hexDistance(attacker.position, target);
        if (dist < 1 || dist > range) {
            messages.push('Target out of range!');
            return { effects, messages };
        }

        // 2. Logic
        // Check Landing Spot
        const isWall = state.wallPositions.some(w => hexEquals(w, target));
        const isLava = state.lavaPositions.some(l => hexEquals(l, target));
        // Note: Legacy isWalkable checks walls and lava. We want to explicitely allow/disallow.
        // Legacy Jump: "Target must be a valid walkable tile (walls block jumps)!" and checks isWalkable.
        // isWalkable returns false for lava. So you cannot jump INTO lava.
        if (isWall) {
            messages.push('Target is a wall!');
            return { effects, messages };
        }
        if (isLava) {
            messages.push('Cannot jump into lava!');
            return { effects, messages };
        }

        // Bounds check
        if (!isWalkable(target, [], [], state.gridWidth, state.gridHeight)) { // Check bounds only
            messages.push('Target out of bounds!');
            return { effects, messages };
        }

        // Check Enemy Occupancy
        const enemyAtTarget = getEnemyAt(state.enemies, target);
        const hasMeteor = activeUpgrades.includes('METEOR_IMPACT');

        if (enemyAtTarget && !hasMeteor) {
            messages.push('Cannot land on enemy!');
            return { effects, messages };
        }

        if (enemyAtTarget && hasMeteor) {
            // Kill enemy
            effects.push({ type: 'Damage', target: 'targetActor', amount: 999 }); // Instant kill
            // Ideally we want to apply damage to specific ID. 
            // AtomicEffect 'Damage' target 'targetActor' usually implies 'the one at the target'?
            // Actually 'targetActor' in applyAtomicEffect uses 'context.targetId'.
            // So we rely on logic.ts passing targetEnemy?.id in context if we just say 'targetActor'.
            // However, with multiple effects, we might want to be specific?
            // The logic.ts snippet: `let newState = applyEffects(clearedState, execution.effects, { targetId: targetEnemy?.id });`
            // So yes, 'targetActor' refers to the enemy at 'target'.
            messages.push(`Meteor Impact killed ${enemyAtTarget.subtype || 'enemy'}!`);

            // Note: If we kill it, we can land there.
            // EffectEngine needs to process Damage first? 
            // applyEffects processes purely sequentially? Yes.
            // If damage kills it, does it remove from enemies list immediately so Displacement works?
            // EffectEngine 'Damage' maps over enemies. It filters `e.hp > 0`.
            // So yes, if we Damage first, it is removed, then Displacement happens.
        } else if (isOccupied(target, state) && !enemyAtTarget) {
            // Maybe another player? (multiplayer?) or logical error.
            messages.push('Tile occupied!');
            return { effects, messages };
        }

        // Execute Jump
        effects.push({ type: 'Displacement', target: 'self', destination: target });
        messages.push('Jumped!');

        // Stunning Landing
        if (activeUpgrades.includes('STUNNING_LANDING')) {
            const neighbors = getNeighbors(target);

            for (const n of neighbors) {
                const neighborEnemy = getEnemyAt(state.enemies, n);

                // Only stun if there is an enemy there, and it's NOT the one we just Meteor Impacted
                if (neighborEnemy && (!enemyAtTarget || neighborEnemy.id !== enemyAtTarget.id)) {
                    effects.push({
                        type: 'ApplyStatus',
                        target: n,           // This works now!
                        status: 'stunned',
                        duration: 1
                    });
                    messages.push(`${neighborEnemy.subtype || 'Enemy'} stunned by landing!`);
                }
            }
            effects.push({ type: 'Juice', effect: 'shake' });
        }

        // Free Jump
        if (activeUpgrades.includes('FREE_JUMP')) {
            consumesTurn = false;
            messages.push('Free Jump!');
        }

        // Cooldown Modifier logic is handled by 'logic.ts' reading baseVariables.
        // We can't dynamically change cooldown there yet without 'ModifyCooldown' effect.

        return { effects, messages, consumesTurn };
    },
    upgrades: {
        JUMP_RANGE: { id: 'JUMP_RANGE', name: 'Extended Jump', description: 'Range +1', modifyRange: 1 },
        JUMP_COOLDOWN: { id: 'JUMP_COOLDOWN', name: 'Nimble', description: 'Cooldown -1', modifyCooldown: -1 },
        STUNNING_LANDING: { id: 'STUNNING_LANDING', name: 'Stunning Landing', description: 'Neighbors stunned' },
        METEOR_IMPACT: { id: 'METEOR_IMPACT', name: 'Meteor Impact', description: 'Land on enemies to kill' },
        FREE_JUMP: { id: 'FREE_JUMP', name: 'Free Jump', description: 'No turn cost' },
    },
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
            id: 'jump_meteor',
            title: 'Meteor Impact',
            description: 'Jump on enemy to kill it.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['JUMP']);
                engine.spawnEnemy('footman', { q: 3, r: 4, s: -7 }, 'victim');
                engine.addUpgrade('JUMP', 'METEOR_IMPACT');
            },
            run: (engine: any) => {
                engine.useSkill('JUMP', { q: 3, r: 4, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemy = state.enemies.find(e => e.id === 'victim');
                // Enemy should be dead (hp <= 0 or removed)
                const dead = !enemy || enemy.hp <= 0;
                const playerAtTarget = hexEquals(state.player.position, { q: 3, r: 4, s: -7 });
                return dead && playerAtTarget && logs.some(l => l.includes('Meteor Impact killed'));
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
