import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors, hexDistance, hexDirection, hexAdd, getDirectionFromTo } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { SpatialSystem } from '../systems/SpatialSystem';
import { UnifiedTileService } from '../systems/unified-tile-service';
import { getActorAt } from '../helpers';
import { calculateCombat, extractTrinityStats } from '../systems/combat-calculator';
// import { isBlockedByWall, isBlockedByLava, isBlockedByActor } from '../systems/validation';

/**
 * WITHDRAWAL Skill
 * 
 * Active: Range 1 shot + Axial Backroll (1-2 hexes to a calculated Safe Spot).
 * Passive Reaction: Auto-fires if an enemy enters an adjacent hex (triggers CD).
 * 
 * The backroll adds 0 momentum to the Hunter (pure displacement).
 */

const SHOT_RANGE = 1;
const SHOT_DAMAGE = 1;
const BACKROLL_MIN = 1;
const BACKROLL_MAX = 2;
const SKILL_COOLDOWN = 2;

/**
 * Calculate a safe backroll destination
 * Finds axial direction away from target, 1-2 hexes
 */
function calculateSafeSpot(
    state: GameState,
    origin: Point,
    threatPos: Point,
    maxDistance: number = BACKROLL_MAX
): Point | null {
    // Get direction FROM threat TO origin (away from threat)
    const dirIdx = getDirectionFromTo(threatPos, origin);
    if (dirIdx === -1) return null;

    const dirVec = hexDirection(dirIdx);

    // Try farthest legal retreat first.
    for (let dist = maxDistance; dist >= BACKROLL_MIN; dist--) {
        let pos = origin;
        let valid = true;

        for (let step = 0; step < dist; step++) {
            pos = hexAdd(pos, dirVec);

            // Check each step for validity
            if (!SpatialSystem.isWithinBounds(state, pos)) {
                valid = false;
                break;
            }
            if (!UnifiedTileService.isWalkable(state, pos)) {
                valid = false;
                break;
            }
        }

        if (valid && !getActorAt(state, pos)) {
            return pos;
        }
    }

    // Try adjacent alternate directions
    const alternateDirections = [(dirIdx + 1) % 6, (dirIdx + 5) % 6];
    for (const altDir of alternateDirections) {
        const altVec = hexDirection(altDir);
        let pos = hexAdd(origin, altVec);

        if (SpatialSystem.isWithinBounds(state, pos) &&
            UnifiedTileService.isWalkable(state, pos) &&
            !getActorAt(state, pos)) {
            return pos;
        }
    }

    return null;
}

export const WITHDRAWAL: SkillDefinition = {
    id: 'WITHDRAWAL',
    name: 'Withdrawal',
    description: 'Quick shot + tactical backroll. Auto-triggers when enemies close in.',
    slot: 'utility',
    icon: '↩️',
    baseVariables: {
        range: SHOT_RANGE,
        cost: 0,
        cooldown: SKILL_COOLDOWN,
        damage: SHOT_DAMAGE,
    },
    execute: (state: GameState, attacker: Actor, target?: Point, activeUpgrades: string[] = []) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];
        const hasPartingShot = activeUpgrades.includes('PARTING_SHOT');
        const hasNimbleFeet = activeUpgrades.includes('NIMBLE_FEET');

        if (!target) {
            return { effects, messages: ['No target!'], consumesTurn: false };
        }

        const dist = hexDistance(attacker.position, target);
        if (dist > SHOT_RANGE) {
            return { effects, messages: ['Target out of range!'], consumesTurn: false };
        }

        const targetActor = getActorAt(state, target);
        if (!targetActor) {
            return { effects, messages: ['No enemy at target!'], consumesTurn: false };
        }

        if (targetActor.factionId === attacker.factionId) {
            return { effects, messages: ['Cannot target allies!'], consumesTurn: false };
        }

        const combat = calculateCombat({
            attackerId: attacker.id,
            targetId: targetActor.id,
            skillId: 'WITHDRAWAL',
            basePower: SHOT_DAMAGE + (hasPartingShot ? 1 : 0),
            trinity: extractTrinityStats(attacker),
            targetTrinity: extractTrinityStats(targetActor),
            damageClass: 'physical',
            scaling: [{ attribute: 'instinct', coefficient: 0.2 }],
            statusMultipliers: []
        });

        // 1. Quick shot
        effects.push({ type: 'Damage', target: targetActor.id, amount: combat.finalPower, scoreEvent: combat.scoreEvent });
        effects.push({ type: 'Juice', effect: 'impact', target: target });
        messages.push(`Withdrawal shot hits ${targetActor.subtype || 'enemy'}!`);

        // 2. Calculate backroll
        const retreatDistance = hasNimbleFeet ? 3 : BACKROLL_MAX;
        const safeSpot = calculateSafeSpot(state, attacker.position, target, retreatDistance);

        if (safeSpot) {
            effects.push({
                type: 'Displacement',
                target: 'self',
                destination: safeSpot,
                source: attacker.position,
            });
            effects.push({
                type: 'Juice',
                effect: 'dashBlur',
                target: safeSpot,
                path: [attacker.position, safeSpot]
            });
            messages.push('Backroll!');
        } else {
            messages.push('No safe retreat available!');
        }

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        // Valid targets are adjacent enemies
        return getNeighbors(origin).filter(n => {
            const actor = getActorAt(state, n);
            return actor && actor.factionId === 'enemy';
        });
    },
    upgrades: {
        PARTING_SHOT: {
            id: 'PARTING_SHOT',
            name: 'Parting Shot',
            description: 'Withdrawal deals +1 damage.',
        },
        NIMBLE_FEET: {
            id: 'NIMBLE_FEET',
            name: 'Nimble Feet',
            description: 'Backroll distance increased to 3 hexes.',
        },
        HAIR_TRIGGER: {
            id: 'HAIR_TRIGGER',
            name: 'Hair Trigger',
            description: 'Passive reaction does not consume cooldown.',
        },
    },
    scenarios: getSkillScenarios('WITHDRAWAL'),
};

/**
 * Check if passive Withdrawal should trigger
 * Called when an enemy moves adjacent to a Hunter with this skill
 */
export function shouldTriggerPassiveWithdrawal(
    state: GameState,
    hunterId: string,
    enemyId: string
): boolean {
    const hunter = hunterId === state.player.id ? state.player : state.enemies.find(e => e.id === hunterId);
    if (!hunter || hunter.archetype !== 'HUNTER') return false;

    // Check if Hunter has Withdrawal skill off cooldown
    const withdrawalSkill = hunter.activeSkills?.find(s => s.id === 'WITHDRAWAL');
    if (!withdrawalSkill || withdrawalSkill.currentCooldown > 0) return false;

    // Check if enemy is now adjacent
    const enemy = state.enemies.find(e => e.id === enemyId);
    if (!enemy) return false;

    const dist = hexDistance(hunter.position, enemy.position);
    return dist === 1;
}

/**
 * Execute passive Withdrawal reaction
 */
export function executePassiveWithdrawal(
    state: GameState,
    hunterId: string,
    enemyPos: Point
): { effects: AtomicEffect[]; messages: string[] } {
    const hunter = hunterId === state.player.id ? state.player : state.enemies.find(e => e.id === hunterId);
    if (!hunter) return { effects: [], messages: [] };
    const withdrawalSkill = hunter.activeSkills?.find(s => s.id === 'WITHDRAWAL');
    const activeUpgrades = withdrawalSkill?.activeUpgrades || [];
    const hasHairTrigger = activeUpgrades.includes('HAIR_TRIGGER');

    // Execute the skill
    const result = WITHDRAWAL.execute(state, hunter, enemyPos, activeUpgrades);

    // Add cooldown effect
    if (!hasHairTrigger) {
        result.effects.push({ type: 'ModifyCooldown', skillId: 'WITHDRAWAL', amount: SKILL_COOLDOWN + 1, setExact: true });
    }

    return result;
}

// Export constants
export { SKILL_COOLDOWN as WITHDRAWAL_COOLDOWN, calculateSafeSpot };
