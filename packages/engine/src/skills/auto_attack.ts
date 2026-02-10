import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexEquals, getNeighbors } from '../hex';
import { getActorAt } from '../helpers';
import { applyEffects } from '../systems/effect-engine';
import { calculateCombat, extractTrinityStats } from '../systems/combat-calculator';
import { isStunned } from '../systems/status';

import { getSkillScenarios } from '../scenarios';

/**
 * Auto Attack - A passive skill that triggers at the end of the entity's turn.
 * Hits all neighbors that were already neighbors at the beginning of the turn.
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
            persistentTargetIds?: string[];
        }
    ): { effects: AtomicEffect[]; messages: string[]; kills?: number } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];
        let kills = 0;

        const stunnedThisStep = (state.timelineEvents || []).some(ev =>
            ev.phase === 'STATUS_APPLY'
            && ev.type === 'ApplyStatus'
            && ev.payload?.status === 'stunned'
            && (
                ev.payload?.target === attacker.id
                || (
                    typeof ev.payload?.target === 'object'
                    && ev.payload?.target
                    && hexEquals(ev.payload.target as Point, attacker.position)
                )
            )
        );

        if (isStunned(attacker) || stunnedThisStep) {
            return { effects, messages, kills: 0 };
        }

        // Get current neighbors
        const currentNeighbors = getNeighbors(attacker.position);

        // Calculate damage
        let damage = 1;
        if (activeUpgrades.includes('HEAVY_HANDS')) damage += 1;

        // WORLD-CLASS LOGIC: Identity Persistence
        // This list represents "Actors that were adjacent at the start of the action".
        // Using IDs avoids "The Great Swap" bug and temporal coupling with previousPosition.
        const persistentTargetIds = context?.persistentTargetIds || [];

        // If no persistent IDs are provided, we attempt to use legacy previousNeighbors.
        // This keeps scenarios and initialization states working.
        const previousNeighbors = context?.previousNeighbors || [];

        if (persistentTargetIds.length === 0 && previousNeighbors.length === 0) {
            return { effects, messages, kills: 0 };
        }

        for (const neighborPos of currentNeighbors) {
            const targetActor = getActorAt(state, neighborPos);
            if (!targetActor || targetActor.hp <= 0 || targetActor.id === attacker.id) continue;

            // Faction Check: Passive skills should NOT hit friendlies
            if (attacker.factionId === targetActor.factionId) continue;

            // Integrity Check: Use Identity Persistence (IDs)
            const isPersistent = persistentTargetIds.length > 0
                ? persistentTargetIds.includes(targetActor.id)
                : previousNeighbors.some(p => hexEquals(p, neighborPos));

            if (isPersistent) {
                // HIT!
                const combat = calculateCombat({
                    attackerId: attacker.id,
                    targetId: targetActor.id,
                    skillId: 'AUTO_ATTACK',
                    basePower: damage,
                    trinity: extractTrinityStats(attacker),
                    targetTrinity: extractTrinityStats(targetActor),
                    damageClass: 'physical',
                    scaling: [{ attribute: 'body', coefficient: 0.4 }],
                    statusMultipliers: []
                });
                effects.push({ type: 'Damage', target: neighborPos, amount: combat.finalPower, scoreEvent: combat.scoreEvent });

                const attackerName = attacker.factionId === 'player'
                    ? 'You'
                    : `${attacker.subtype || 'enemy'}#${attacker.id}`;
                const targetName = targetActor.factionId === 'player'
                    ? 'you'
                    : `${targetActor.subtype || 'enemy'}#${targetActor.id}`;
                messages.push(`${attackerName} attacked ${targetName}!`);

                if (targetActor.hp <= damage) {
                    kills++;
                }
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

                const isEnemy = attacker.factionId !== targetActor.factionId;
                if (!isEnemy) continue;

                const combat = calculateCombat({
                    attackerId: attacker.id,
                    targetId: targetActor.id,
                    skillId: 'AUTO_ATTACK',
                    basePower: damage,
                    trinity: extractTrinityStats(attacker),
                    targetTrinity: extractTrinityStats(targetActor),
                    damageClass: 'physical',
                    scaling: [{ attribute: 'body', coefficient: 0.4 }],
                    statusMultipliers: []
                });
                effects.push({ type: 'Damage', target: neighborPos, amount: combat.finalPower, scoreEvent: combat.scoreEvent });

                const attackerName = attacker.factionId === 'player'
                    ? 'You'
                    : `${attacker.subtype || 'enemy'}#${attacker.id}`;
                const targetName = targetActor.factionId === 'player'
                    ? 'you'
                    : `${targetActor.subtype || 'enemy'}#${targetActor.id}`;
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
    scenarios: getSkillScenarios('AUTO_ATTACK')
};

/**
 * Helper function to apply auto-attack for an entity.
 * Called by the game engine at the end of an entity's turn.
 * 
 * @param state Current game state
 * @param entity The entity performing the auto-attack
 * @param previousNeighbors Positions that were adjacent at turn start (Legacy)
 * @param attackerTurnStartPosition Position of attacker at turn start
 * @param persistentTargetIds IDs of enemies that were adjacent at turn start
 * @returns Updated state and kill count
 */
export const applyAutoAttack = (
    state: GameState,
    entity: Actor,
    previousNeighbors?: Point[],
    attackerTurnStartPosition?: Point,
    persistentTargetIds?: string[]
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
        allActorsTurnStartPositions,
        persistentTargetIds
    });

    // Apply effects using the common effect engine
    const newState = applyEffects(state, result.effects, { targetId: undefined });

    return {
        state: newState,
        kills: result.kills || 0,
        messages: result.messages
    };
};
