import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors, hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { isBlockedByWall, validateRange, canLandOnHazard } from '../systems/validation';
import { SpatialSystem } from '../systems/SpatialSystem';
import { calculateCombat, extractTrinityStats } from '../systems/combat-calculator';

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

        if (!target) return { effects, messages, consumesTurn: false };
        if (!attacker || !attacker.position) return { effects, messages, consumesTurn: false };

        // 1. Upgrade Detection
        const hasRange = activeUpgrades.includes('JUMP_RANGE');
        const hasStun = activeUpgrades.includes('STUNNING_LANDING');
        const hasMeteor = activeUpgrades.includes('METEOR_IMPACT');
        const isFree = activeUpgrades.includes('FREE_JUMP');

        const range = 2 + (hasRange ? 1 : 0);

        // 2. Precise Range Validation
        if (!validateRange(attacker.position, target, range)) {
            messages.push('Target out of range!');
            return { effects, messages, consumesTurn: false };
        }

        // 3. Occupancy & Environmental Check
        const obstacle = getActorAt(state, target);
        const wall = isBlockedByWall(state, target);
        const canLand = canLandOnHazard(state, attacker, target);

        if (wall) {
            messages.push('Cannot jump into a wall!');
            return { effects, messages, consumesTurn: false };
        }
        if (!canLand) {
            messages.push('Cannot land on hazard!');
            return { effects, messages, consumesTurn: false };
        }

        if (obstacle && !hasMeteor) {
            messages.push('Target hex is blocked!');
            return { effects, messages, consumesTurn: false };
        }

        // 4. Execution: Displacement & Impact
        if (obstacle && hasMeteor) {
            const combat = calculateCombat({
                attackerId: attacker.id,
                targetId: obstacle.id,
                skillId: 'JUMP',
                basePower: 99,
                trinity: extractTrinityStats(attacker),
                targetTrinity: extractTrinityStats(obstacle),
                damageClass: 'physical',
                scaling: [{ attribute: 'body', coefficient: 0.15 }],
                statusMultipliers: []
            });
            effects.push({ type: 'Damage', target: obstacle.id, amount: combat.finalPower, scoreEvent: combat.scoreEvent });
            messages.push(`Meteor Impact killed ${obstacle.subtype || 'enemy'}!`);
        }

        // Jumps are "Airborne" - they ignore ground hazards and interim collisions
        effects.push({
            type: 'Message',
            text: 'Jumped!'
        });
        effects.push({
            type: 'Displacement',
            target: 'self',
            destination: target,
            ignoreCollision: true,
            ignoreGroundHazards: true,
            simulatePath: true
        });

        // 5. AoE Landing Effect: Stun adjacent enemies
        if (hasStun) {
            const neighbors = getNeighbors(target);
            let stunnedAny = false;
            for (const n of neighbors) {
                const enemy = getActorAt(state, n);
                if (enemy && enemy.id !== attacker.id) {
                    effects.push({
                        type: 'ApplyStatus',
                        target: enemy.id,
                        status: 'stunned',
                        duration: 1
                    });
                    stunnedAny = true;
                }
            }
            if (stunnedAny) messages.push('Enemies stunned by landing impact!');
        }

        effects.push({
            type: 'Juice',
            effect: 'shake',
            target: target,
            intensity: 'medium',
            metadata: {
                signature: 'MOVE.LEAP.NEUTRAL.JUMP_LAND',
                family: 'movement',
                primitive: 'leap',
                phase: 'impact',
                element: 'neutral',
                variant: 'jump_landing',
                targetRef: { kind: 'target_hex' },
                skillId: 'JUMP',
                camera: { shake: 'medium', kick: 'light' }
            }
        });

        return { effects, messages, consumesTurn: !isFree };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const actor = getActorAt(state, origin) as Actor | undefined;
        if (!actor) return [];
        const actorJumpSkill = actor.activeSkills?.find(s => s.id === 'JUMP');
        const upgrades = new Set(actorJumpSkill?.activeUpgrades || []);
        const range = 2 + (upgrades.has('JUMP_RANGE') ? 1 : 0);
        const hasMeteor = upgrades.has('METEOR_IMPACT');

        return SpatialSystem.getAreaTargets(state, origin, range).filter(p => {
            if (hexEquals(p, origin)) return false;
            if (isBlockedByWall(state, p)) return false;
            if (!canLandOnHazard(state, actor, p)) return false;
            const occupied = getActorAt(state, p);
            if (occupied && occupied.id !== actor.id && !hasMeteor) return false;
            return true;
        });
    },
    upgrades: {
        JUMP_RANGE: { id: 'JUMP_RANGE', name: 'Extended Jump', description: 'Jump range +1' },
        JUMP_COOLDOWN: { id: 'JUMP_COOLDOWN', name: 'Nimble', description: 'Jump cooldown -1', modifyCooldown: -1 },
        STUNNING_LANDING: { id: 'STUNNING_LANDING', name: 'Stunning Landing', description: 'All enemies within 1 hex of landing are stunned' },
        METEOR_IMPACT: { id: 'METEOR_IMPACT', name: 'Meteor Impact', description: 'Can land on enemies to kill them' },
        FREE_JUMP: { id: 'FREE_JUMP', name: 'Free Jump', description: 'Can move after jumping' },
    },
    scenarios: getSkillScenarios('JUMP')
};
