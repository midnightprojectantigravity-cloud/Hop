import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors, hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { validateRange } from '../systems/validation';
import { SpatialSystem } from '../systems/spatial-system';
import { createDamageEffectFromCombat, resolveSkillCombatDamage } from '../systems/combat/combat-effect';
import {
    resolveSkillMovementPolicy,
    validateMovementDestination
} from '../systems/capabilities/movement-policy';

const resolveJumpLandingPolicy = (
    movementPolicy: ReturnType<typeof resolveSkillMovementPolicy>
) => ({
    ignoreWalls: movementPolicy.ignoreWalls,
    movementModel: {
        ...movementPolicy.movementModel,
        pathing: 'walk' as const,
        ignoreGroundHazards: false
    }
});

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
        basePower: 99,
        damage: 1,
    },
    combat: {
        damageClass: 'physical',
        attackProfile: 'melee',
        trackingSignature: 'melee',
        weights: { body: 1 }
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

        const movementPolicy = resolveSkillMovementPolicy(state, attacker, {
            skillId: 'JUMP',
            target,
            baseRange: 2 + (hasRange ? 1 : 0),
            basePathing: 'flight',
            baseIgnoreGroundHazards: true
        });
        const landingPolicy = resolveJumpLandingPolicy(movementPolicy);
        const range = movementPolicy.range;

        // 2. Precise Range Validation
        if (!validateRange(attacker.position, target, range)) {
            messages.push('Target out of range!');
            return { effects, messages, consumesTurn: false };
        }

        // 3. Occupancy & Environmental Check
        const destination = validateMovementDestination(state, attacker, target, landingPolicy, {
            occupancy: hasMeteor ? 'enemy' : 'none'
        });
        if (!destination.isValid) {
            messages.push(
                destination.blockedBy === 'wall'
                    ? 'Cannot jump into a wall!'
                    : destination.blockedBy === 'hazard'
                        ? 'Cannot land on hazard!'
                        : 'Target hex is blocked!'
            );
            return { effects, messages, consumesTurn: false };
        }
        const obstacle = hasMeteor ? getActorAt(state, target) : null;

        // 4. Execution: Displacement & Impact
        if (obstacle && hasMeteor) {
            const combat = resolveSkillCombatDamage({
                attacker,
                target: obstacle,
                skillId: 'JUMP',
                basePower: JUMP.baseVariables.basePower ?? 0,
                skillDamageMultiplier: JUMP.baseVariables.damage ?? 1,
                ...JUMP.combat,
                statusMultipliers: []
            });
            effects.push(createDamageEffectFromCombat(combat, obstacle.id));
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
            source: attacker.position,
            path: [attacker.position, target],
            ignoreCollision: true,
            ignoreWalls: movementPolicy.ignoreWalls,
            ignoreGroundHazards: movementPolicy.ignoreGroundHazards,
            simulatePath: movementPolicy.simulatePath,
            presentationKind: 'jump',
            pathStyle: 'arc',
            presentationSequenceId: `${attacker.id}:JUMP:${target.q},${target.r},${target.s}:${state.turnNumber}`
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
        const movementPolicy = resolveSkillMovementPolicy(state, actor, {
            skillId: 'JUMP',
            baseRange: 2 + (upgrades.has('JUMP_RANGE') ? 1 : 0),
            basePathing: 'flight',
            baseIgnoreGroundHazards: true
        });
        const landingPolicy = resolveJumpLandingPolicy(movementPolicy);
        const range = movementPolicy.range;
        const hasMeteor = upgrades.has('METEOR_IMPACT');

        return SpatialSystem.getAreaTargets(state, origin, range).filter(p => {
            if (hexEquals(p, origin)) return false;
            return validateMovementDestination(state, actor, p, landingPolicy, {
                occupancy: hasMeteor ? 'enemy' : 'none'
            }).isValid;
        });
    },
    upgrades: {
        JUMP_RANGE: { id: 'JUMP_RANGE', name: 'Extended Jump', description: 'Jump range +1' },
        JUMP_COOLDOWN: { id: 'JUMP_COOLDOWN', name: 'Nimble', description: 'Jump cooldown -1', modifyCooldown: -1 },
        STUNNING_LANDING: { id: 'STUNNING_LANDING', name: 'Stunning Landing', description: 'All enemies within 1 hex of landing are stunned' },
        METEOR_IMPACT: { id: 'METEOR_IMPACT', name: 'Meteor Impact', description: 'Can land on enemies to kill them' },
        FREE_JUMP: { id: 'FREE_JUMP', name: 'Free Jump', description: 'Can move after jumping' },
    },
};
