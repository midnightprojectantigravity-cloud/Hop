import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, hexEquals, getNeighbors, getDirectionFromTo, hexAdd, hexDirection } from '../hex';
import { getEnemyAt, isWalkable } from '../helpers';

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
        const dist = hexDistance(attacker.position, target);
        if (dist > 1) {
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

            const directionIdx = getDirectionFromTo(attacker.position, t);
            if (directionIdx === -1) continue;
            const dirVec = hexDirection(directionIdx);
            const pushDest = hexAdd(t, dirVec);

            // Check collision
            const blockedByWall = state.wallPositions.some(w => hexEquals(w, pushDest));
            const blockingEnemy = getEnemyAt(state.enemies, pushDest);
            const isOutOfBounds = !isWalkable(pushDest, [], [], state.gridWidth, state.gridHeight);

            if (blockedByWall || (blockingEnemy && blockingEnemy.id !== enemy.id) || isOutOfBounds) {
                anyCollision = true;
                effects.push({ type: 'ApplyStatus', target: t, status: 'stunned', duration: 1 });
                messages.push(`Bashed ${enemy.subtype || 'enemy'} into obstacle!`);
            } else if (state.lavaPositions.some(l => hexEquals(l, pushDest))) {
                effects.push({ type: 'Displacement', target: 'targetActor', destination: pushDest });
                effects.push({ type: 'Juice', effect: 'lavaSink', target: pushDest });
                messages.push(`${enemy.subtype || 'Enemy'} fell into Lava!`);
            } else {
                effects.push({ type: 'Displacement', target: 'targetActor', destination: pushDest });
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
    upgrades: {},
    scenarios: [
        {
            id: 'bash_push',
            title: 'Shield Push',
            description: 'Push an enemy 1 tile.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SHIELD_BASH']);
                engine.setTile({ q: 3, r: 4, s: -7 }, 'lava');
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'victim'); // North
            },
            run: (engine: any) => {
                engine.useSkill('SHIELD_BASH', { q: 3, r: 5, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemyGone = state.enemies.length === 0;
                const messageOk = logs.some(l => l.includes('fell into Lava!'));
                return enemyGone && messageOk;
            }
        },
        {
            id: 'bash_wall_stun',
            title: 'Wall Slam Stun',
            description: 'Bash enemy into wall causes stun.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SHIELD_BASH']);
                // Use ShieldBearer (HP 2) to survive the Player's passive Punch response (1 dmg)
                engine.spawnEnemy('shieldBearer', { q: 3, r: 5, s: -8 }, 'victim');
                engine.setTile({ q: 3, r: 4, s: -7 }, 'wall');
            },
            run: (engine: any) => {
                engine.useSkill('SHIELD_BASH', { q: 3, r: 5, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemy = state.enemies.find(e => e.id === 'victim');
                if (!enemy) return false;
                // Should stay in original position (blocked) and be stunned
                const inPlace = hexEquals(enemy.position, { q: 3, r: 5, s: -8 });
                // Stun might be cleared by turn end, so check log for confirmation
                const logConfirm = logs.some(l => l.includes('into obstacle'));
                return inPlace && logConfirm;
            }
        }
    ]
};
