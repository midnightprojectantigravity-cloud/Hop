import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexEquals, getNeighbors } from '../hex';
import { getActorAt } from '../helpers';
import { applyEffects } from '../effectEngine';

/**
 * Auto Attack - A passive skill that triggers at the end of the entity's turn.
 * Hits all neighbors that were already neighbors at the beginning of the turn.
 * This is the "Punch" passive from classic Hoplite.
 * Can be attached to any entity (player or enemy).
 */
export const AUTO_ATTACK: SkillDefinition = {
    id: 'AUTO_ATTACK',
    name: 'Auto Attack',
    description: 'Automatically strike adjacent enemies that started the turn adjacent to you.',
    slot: 'passive',
    icon: '👊',
    baseVariables: {
        range: 1,
        cost: 0,
        cooldown: 0,
        damage: 1,
    },
    /**
     * Unlike other skills, AUTO_ATTACK is not directly executed via USE_SKILL action.
     * Instead, it's triggered by the game engine at the end of the entity's turn.
     * 
     * The execute function here is provided for consistency and can be used
     * to manually trigger the auto-attack if needed.
     * 
     * Parameters:
     * - state: Current game state
     * - attacker: The entity with this skill
     * - target: Not used (auto-attack hits all valid neighbors)
     * - activeUpgrades: Active upgrades for this skill
     * - context.previousNeighbors: Array of positions that were adjacent at turn start (legacy)
     * - context.attackerTurnStartPosition: Position of attacker at start of their individual turn (initiative-based)
     * - context.allActorsTurnStartPositions: Map of actorId -> turnStartPosition for all actors
     */
    execute: (
        state: GameState,
        attacker: Actor,
        _target?: Point,
        activeUpgrades: string[] = [],
        context?: {
            previousNeighbors?: Point[];
            attackerTurnStartPosition?: Point;
            allActorsTurnStartPositions?: Map<string, Point>;
        }
    ): { effects: AtomicEffect[]; messages: string[]; kills?: number } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];
        let kills = 0;

        // Get current neighbors
        const currentNeighbors = getNeighbors(attacker.position);

        // INITIATIVE-BASED TURN TRACKING:
        // Use the attacker's turn start position from the initiative queue (if available)
        // This is the position at the START of this actor's individual turn
        const attackerStartPos = context?.attackerTurnStartPosition
            || attacker.previousPosition
            || attacker.position;

        // Get previous neighbors from context, or compute from turn start position
        const previousNeighbors = context?.previousNeighbors || getNeighbors(attackerStartPos);

        // Calculate damage
        let damage = 1;
        if (activeUpgrades.includes('HEAVY_HANDS')) damage += 1;

        // Find actors that are currently adjacent AND were previously adjacent
        // WORLD-CLASS PERSISTENCE LOGIC:
        // - The target must be in a position that was one of our previous neighbors
        // - The target's previousPosition must ALSO have been adjacent to our previousPosition
        //   (This ensures neither party "just arrived" at the adjacency)
        for (const neighborPos of currentNeighbors) {
            const wasAdjacent = previousNeighbors.some(p => hexEquals(p, neighborPos));
            if (!wasAdjacent) continue;

            const targetActor = getActorAt(state, neighborPos);
            if (!targetActor || targetActor.id === attacker.id) continue;

            // WORLD-CLASS LOGIC: Only target if different factions (prevents friendly fire)
            const isEnemy = attacker.factionId !== targetActor.factionId;
            if (!isEnemy) continue;

            // PERSISTENCE CHECK: Target must have also been adjacent at turn start
            // INITIATIVE-BASED: Use the target's turn start position from the initiative queue
            // This ensures we check where the target was at the START of their turn, not just
            // their previousPosition (which may have changed during their turn)
            const targetTurnStartPos = context?.allActorsTurnStartPositions?.get(targetActor.id)
                || targetActor.previousPosition
                || targetActor.position;

            const targetWasAdjacentBefore = previousNeighbors.some(p =>
                hexEquals(p, targetTurnStartPos)
            );
            if (!targetWasAdjacentBefore) continue;

            // Apply damage using position-based targeting
            effects.push({ type: 'Damage', target: neighborPos, amount: damage });

            const attackerName = attacker.factionId === 'player' ? 'You' : (attacker.subtype || 'Enemy');
            const targetName = targetActor.factionId === 'player' ? 'you' : (targetActor.subtype || 'enemy');
            messages.push(`${attackerName} attacked ${targetName}!`);

            // Track kills
            if (targetActor.hp <= damage) {
                kills++;
            }
        }

        // Cleave upgrade: AoE damage to all neighbors, not just persistent ones
        if (activeUpgrades.includes('CLEAVE') && effects.length > 0) {
            for (const neighborPos of currentNeighbors) {
                // Skip positions we already hit
                const alreadyHit = effects.some(e =>
                    e.type === 'Damage' &&
                    typeof e.target === 'object' &&
                    'q' in e.target &&
                    hexEquals(e.target as Point, neighborPos)
                );
                if (alreadyHit) continue;

                const targetActor = getActorAt(state, neighborPos);
                if (!targetActor || targetActor.id === attacker.id) continue;

                // WORLD-CLASS LOGIC: Only target if different factions (prevents friendly fire)
                const isEnemy = attacker.factionId !== targetActor.factionId;
                if (!isEnemy) continue;

                effects.push({ type: 'Damage', target: neighborPos, amount: damage });

                const attackerName = attacker.factionId === 'player' ? 'You' : (attacker.subtype || 'Enemy');
                const targetName = targetActor.factionId === 'player' ? 'you' : (targetActor.subtype || 'enemy');
                messages.push(`${attackerName} cleaved ${targetName}!`);

                if (targetActor.hp <= damage) {
                    kills++;
                }
            }
        }

        return { effects, messages, kills };
    },
    upgrades: {
        HEAVY_HANDS: {
            id: 'HEAVY_HANDS',
            name: 'Heavy Hands',
            description: 'Auto-attack damage +1'
        },
        CLEAVE: {
            id: 'CLEAVE',
            name: 'Cleave',
            description: 'When auto-attack triggers, hit ALL adjacent enemies'
        },
    },
    scenarios: [
        {
            id: 'auto_attack_punch',
            title: 'Auto Attack Punch',
            description: 'Enemy that was adjacent and stays adjacent gets punched.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['AUTO_ATTACK']);
                // shieldBearer has 2 HP so survives the punch
                engine.spawnEnemy('shieldBearer', { q: 3, r: 5, s: -8 }, 'adjacent');
                // Set previous position to current (simulating start of turn)
                engine.state.player.previousPosition = { q: 3, r: 6, s: -9 };
            },
            run: (engine: any) => {
                // Use the wait action which triggers the turn cycle including auto-attack
                engine.wait();
            },
            verify: (state: GameState, logs: string[]) => {
                const enemy = state.enemies.find(e => e.id === 'adjacent');
                // Should have taken 1 damage (2 HP -> 1 HP)
                const tookDamage = !!(enemy && enemy.hp === 1);
                const punchMessage = logs.some(l => l.includes('attacked'));
                return tookDamage && punchMessage;
            }
        },
        {
            id: 'enemy_auto_attack',
            title: 'Enemy Auto Attack',
            description: 'Verify enemies use AUTO_ATTACK passive.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, []);
                // Spawn enemy with AUTO_ATTACK
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'puncher');
                const puncher = engine.state.enemies.find((e: any) => e.id === 'puncher');
                if (!puncher.activeSkills) puncher.activeSkills = [];
                puncher.activeSkills.push({
                    id: 'AUTO_ATTACK',
                    name: 'Auto Attack',
                    description: 'Passive strike',
                    slot: 'passive',
                    cooldown: 0,
                    currentCooldown: 0,
                    range: 1,
                    activeUpgrades: []
                });

                // Set previous positions to simulate staying adjacent
                // We need to set state.enemies in a way that includes previousPosition
                puncher.previousPosition = { q: 3, r: 5, s: -8 };
                engine.state.player.previousPosition = { q: 3, r: 6, s: -9 };
            },
            run: (engine: any) => {
                // Wait triggers end-of-turn passives
                engine.wait();
            },
            verify: (state: GameState, logs: string[]) => {
                // Player should have taken 1 damage
                const playerDamaged = state.player.hp === 2;
                const punchMessage = logs.some(l => l.includes('attacked'));
                return playerDamaged && punchMessage;
            }
        },
        {
            id: 'auto_attack_no_punch_new_neighbor',
            title: 'No Auto Attack on New Neighbor',
            description: 'Enemy that just became adjacent does NOT get punched by AUTO_ATTACK skill logic.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['AUTO_ATTACK']);
                // Enemy spawns adjacent but player "just moved here"
                engine.spawnEnemy('shieldBearer', { q: 3, r: 5, s: -8 }, 'new_neighbor');
                // Set previous position to somewhere else (simulating player moved in)
                engine.state.player.previousPosition = { q: 3, r: 7, s: -10 };
            },
            run: (engine: any) => {
                // Directly call this module's execute function 
                // to test AUTO_ATTACK logic in isolation (without game engine's hardcoded punch)
                const prevNeighbors = [
                    { q: 3, r: 8, s: -11 }, // Not the enemy position
                    { q: 2, r: 7, s: -9 },
                ];
                const result = AUTO_ATTACK.execute(
                    engine.state,
                    engine.state.player,
                    undefined,
                    [],
                    { previousNeighbors: prevNeighbors }
                );
                // Store result messages for verification
                engine.state.message = [...engine.state.message, ...result.messages];
            },
            verify: (_state: GameState, logs: string[]) => {
                // The AUTO_ATTACK execute() should NOT have generated any punch messages
                // because the enemy was not in previousNeighbors
                const noPunchFromAutoAttack = !logs.some(l => l.includes('attacked shieldBearer'));
                return noPunchFromAutoAttack;
            }
        },
        {
            id: 'auto_attack_multi_unit_stress',
            title: 'Symmetry & Persistence Stress Test',
            description: 'Validates friendly fire, persistence, and spatial boundaries in a crowded hex cluster.',
            setup: (engine: any) => {
                // 1. Setup Player at center (0,0)
                engine.setPlayer({ q: 0, r: 0, s: 0 }, ['AUTO_ATTACK']);
                engine.state.player.previousPosition = { q: 0, r: 0, s: 0 };

                // 2. Setup Persistent Enemy (Positive Case - Should be Hit)
                // shieldBearer has 2 HP so survives the punch
                engine.spawnEnemy('shieldBearer', { q: 1, r: 0, s: -1 }, 'persistent_foe');
                const e1 = engine.getEnemy('persistent_foe');
                e1.previousPosition = { q: 1, r: 0, s: -1 };

                // 3. Setup New Enemy (Negative Case: Persistence - Should NOT be Hit)
                engine.spawnEnemy('footman', { q: 0, r: 1, s: -1 }, 'new_foe');
                const e2 = engine.getEnemy('new_foe');
                e2.previousPosition = { q: 5, r: 5, s: -10 }; // Was far away

                // 4. Setup "Enemy-to-Enemy" neighbors - give persistent_foe AUTO_ATTACK to check friendly fire
                e1.activeSkills = e1.activeSkills || [];
                e1.activeSkills.push({
                    id: 'AUTO_ATTACK',
                    name: 'Auto Attack',
                    description: 'Passive strike',
                    slot: 'passive',
                    cooldown: 0,
                    currentCooldown: 0,
                    range: 1,
                    activeUpgrades: []
                });
            },
            run: (engine: any) => {
                // We trigger the end-of-turn processing via wait
                engine.wait();
            },
            verify: (state: GameState, _logs: string[]) => {
                const e1 = state.enemies.find(e => e.id === 'persistent_foe');
                const e2 = state.enemies.find(e => e.id === 'new_foe');

                // ASSERTION 1: Player hit the persistent adjacent enemy
                // shieldBearer has 2 maxHp, should have 1 hp after being punched
                const playerHitPersistent = !!(e1 && e1.hp === e1.maxHp - 1);

                // ASSERTION 2: Player ignored the new arrival
                const playerIgnoredNew = !!(e2 && e2.hp === e2.maxHp);

                // ASSERTION 3: Enemy-to-Enemy Friendly Fire Check
                // Since E1 has Auto-Attack and E2 is adjacent, if E1 hits E2, friendly fire logic is broken.
                // E2 should still have full HP (not attacked by E1)
                const enemiesDidNotFight = !!(e2 && e2.hp === e2.maxHp);

                return playerHitPersistent && playerIgnoredNew && enemiesDidNotFight;
            }
        }
    ]
};

/**
 * Helper function to apply auto-attack for an entity.
 * Called by the game engine at the end of an entity's turn.
 * 
 * @param state Current game state
 * @param entity The entity performing the auto-attack
 * @param previousNeighbors Positions that were adjacent at turn start
 * @returns Updated state and kill count
 */
export const applyAutoAttack = (
    state: GameState,
    entity: Actor,
    previousNeighbors?: Point[],
    attackerTurnStartPosition?: Point
): { state: GameState; kills: number; messages: string[] } => {
    // Check if entity has AUTO_ATTACK skill
    const hasAutoAttack = entity.activeSkills?.some(s => s.id === 'AUTO_ATTACK');
    if (!hasAutoAttack) {
        return { state, kills: 0, messages: [] };
    }

    const skill = entity.activeSkills?.find(s => s.id === 'AUTO_ATTACK');
    const activeUpgrades = skill?.activeUpgrades || [];

    // Collect all turn start positions from initiative queue
    const allActorsTurnStartPositions = new Map<string, Point>();
    if (state.initiativeQueue) {
        for (const entry of state.initiativeQueue.entries) {
            if (entry.turnStartPosition) {
                allActorsTurnStartPositions.set(entry.actorId, entry.turnStartPosition);
            }
        }
    }

    const result = AUTO_ATTACK.execute(state, entity, undefined, activeUpgrades, {
        previousNeighbors,
        attackerTurnStartPosition,
        allActorsTurnStartPositions
    });

    // Apply effects using the common effect engine
    const newState = applyEffects(state, result.effects, { targetId: undefined });

    return {
        state: newState,
        kills: result.kills || 0,
        messages: result.messages
    };
};
