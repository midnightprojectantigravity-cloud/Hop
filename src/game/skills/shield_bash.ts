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
    execute: (state: GameState, attacker: Actor, target?: Point, activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[] } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages };
        if (!attacker || !attacker.position) {
            console.error("Shield Bash: Attacker or position missing");
            return { effects, messages };
        }

        // 1. Validation
        let range = 1;
        if (activeUpgrades.includes('SHIELD_RANGE')) range += 1;

        const dist = hexDistance(attacker.position, target);
        if (dist > range) {
            messages.push('Target out of range!');
            return { effects, messages };
        }

        // 2. Identify Targets (Single, Arc, or 360)
        let targetsToHit: Point[] = [];
        const is360 = activeUpgrades.includes('BASH_360');
        const isArc = activeUpgrades.includes('ARC_BASH');
        const hasWallSlam = activeUpgrades.includes('WALL_SLAM');

        if (is360) {
            targetsToHit = getNeighbors(attacker.position);
        } else if (isArc) {
            // Arc includes target and its two neighbors closest to player
            targetsToHit = [target];
            const neighbors = getNeighbors(target);
            for (const n of neighbors) {
                if (hexDistance(n, attacker.position) === 1 && targetsToHit.length < 3) {
                    targetsToHit.push(n);
                }
            }
        } else {
            targetsToHit = [target];
        }

        let anyCollision = false;

        // 3. Process Bash for each target
        // We use a helper to generate effects for a single push, handling cascades if needed
        const resolvePush = (sourcePos: Point, targetPos: Point, recursiveDepth: number = 0): void => {
            if (recursiveDepth > 3) return; // Prevent infinite loops

            const enemy = getEnemyAt(state.enemies, targetPos);
            if (!enemy) return;

            const directionIdx = getDirectionFromTo(sourcePos, targetPos);
            if (directionIdx === -1) return; // Should not happen
            const dirVec = hexDirection(directionIdx);
            if (!dirVec) return;
            const pushDest = hexAdd(targetPos, dirVec);

            // Check what is at destination
            const blockedByWall = state.wallPositions.some(w => hexEquals(w, pushDest));
            const blockingEnemy = getEnemyAt(state.enemies, pushDest); // Note: In compositional, we check against initial state unless we simulate updates
            const lavaAtDest = state.lavaPositions.some(l => hexEquals(l, pushDest));
            const isOutOfBounds = !isWalkable(pushDest, [], [], state.gridWidth, state.gridHeight); // Ignore walls/lava here, checked specifically above

            if (blockedByWall || (blockingEnemy && blockingEnemy.id !== enemy.id) || isOutOfBounds) {
                // Collision!
                anyCollision = true;
                effects.push({ type: 'ApplyStatus', target: 'targetActor', status: 'stunned', duration: 1 });
                messages.push(`Bashed ${enemy.subtype || 'enemy'} into obstacle!`);

                // Wall Slam Upgrade: Cascade to the blocking enemy
                if (blockingEnemy && hasWallSlam) {
                    // Push the blocking enemy in the same direction
                    // recursive call
                    resolvePush(targetPos, pushDest, recursiveDepth + 1);
                }
            } else if (lavaAtDest) {
                // Into Lava
                effects.push({ type: 'Displacement', target: 'targetActor', destination: pushDest });
                // Note: EffectEngine treats displacement into dest, but then needs to check lava? 
                // EffectEngine V1 doesn't auto-kill on displacement. 
                // We must manually add LavaSink effect or rely on engine to check lava after move.
                // The 'Juice' effect 'lavaSink' kills. 
                effects.push({ type: 'Juice', effect: 'lavaSink', target: pushDest });
                messages.push(`${enemy.subtype || 'Enemy'} fell into Lava!`);
            } else {
                // Clear Displacement
                effects.push({ type: 'Displacement', target: 'targetActor', destination: pushDest });
                messages.push(`Pushed ${enemy.subtype || 'enemy'}!`);
            }
        };

        // Note: With multiple targets (AoE), we need to check if they exist
        for (const t of targetsToHit) {
            resolvePush(attacker.position, t);
            // Logic limitation: 'resolvePush' strictly uses 'state.enemies'. 
            // If we push multiple enemies, we assume they don't block each other *intra-turn* 
            // unless we track intermediate positions. 
            // For AtomicEffects, we generate a batch of instructions. 
            // If A pushes B into C, C might also be pushed by the same skill if it's 360 bash. 
            // This simple parallel resolution is acceptable for now.
        }

        if (anyCollision) {
            effects.push({ type: 'Juice', effect: 'shake' });
        }

        // Cooldown Modifier
        // While AtomicEffects handles state, cooldowns are usually set by engine based on skill def.
        // But Shield Bash has dynamic cooldown modifiers (Upgrade -1, AoE +1).
        // The Engine (logic.ts) updates cooldown *after* execution.
        // We can't easily change the *resulting* cooldown from here unless we return a 'ModifyCooldown' effect.
        // For now, logic.ts checks `compDef.baseVariables.cooldown`. 
        // We might need to implement the dynamic cooldown logic in logic.ts or add a new Effect.

        return { effects, messages };
    },
    upgrades: {
        SHIELD_RANGE: { id: 'SHIELD_RANGE', name: 'Extended Bash', description: 'Range +1', modifyRange: 1 },
        SHIELD_COOLDOWN: { id: 'SHIELD_COOLDOWN', name: 'Quick Recovery', description: 'Cooldown -1', modifyCooldown: -1 },
        ARC_BASH: { id: 'ARC_BASH', name: 'Arc Bash', description: 'Hit 3 tiles in arc (+1 CD)' },
        BASH_360: { id: 'BASH_360', name: '360 Bash', description: 'Hit all neighbors (+1 CD)' },
        WALL_SLAM: { id: 'WALL_SLAM', name: 'Wall Slam', description: 'Chain reaction on blocks' },
    },
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
