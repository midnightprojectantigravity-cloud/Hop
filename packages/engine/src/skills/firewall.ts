import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexAdd, hexDirection } from '../hex';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { validateAxialDirection, isBlockedByWall } from '../systems/validation';
import { SpatialSystem } from '../systems/SpatialSystem';
import { calculateCombat, extractTrinityStats } from '../systems/combat-calculator';

/**
 * FIREWALL Skill
 * Creates a line of 5 fire tiles perpendicular to the player.
 */
export const FIREWALL: SkillDefinition = {
    id: 'FIREWALL',
    name: 'Firewall',
    description: 'Create a wall of flames 5 tiles wide. Area denial.',
    slot: 'utility',
    icon: '🧱',
    baseVariables: {
        range: 4,
        cost: 1,
        cooldown: 4,
    },
    execute: (state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const { isAxial, directionIndex } = validateAxialDirection(attacker.position, target);
        if (!isAxial) {
            return { effects, messages: ['Axial targeting only!'], consumesTurn: false };
        }

        const perp1 = (directionIndex + 2) % 6;
        const perp2 = (directionIndex + 5) % 6;

        const wallPoints: Point[] = [target];

        // Extend in both directions
        let p1 = target;
        for (let i = 0; i < 2; i++) {
            p1 = hexAdd(p1, hexDirection(perp1));
            if (SpatialSystem.isWithinBounds(state, p1)) wallPoints.push(p1);
        }

        let p2 = target;
        for (let i = 0; i < 2; i++) {
            p2 = hexAdd(p2, hexDirection(perp2));
            if (SpatialSystem.isWithinBounds(state, p2)) wallPoints.push(p2);
        }

        for (const p of wallPoints) {
            // Check for existing walls (optional: firewall doesn't overwrite walls)
            if (!isBlockedByWall(state, p)) {
                effects.push({ type: 'PlaceFire', position: p, duration: 3 });
                // If an actor is there, damage them immediately
                const actor = getActorAt(state, p);
                if (actor) {
                    const combat = calculateCombat({
                        attackerId: attacker.id,
                        targetId: actor.id,
                        skillId: 'FIREWALL',
                        basePower: 1,
                        trinity: extractTrinityStats(attacker),
                        targetTrinity: extractTrinityStats(actor),
                        damageClass: 'magical',
                        scaling: [{ attribute: 'mind', coefficient: 0.15 }],
                        statusMultipliers: []
                    });
                    effects.push({ type: 'Damage', target: actor.id, amount: combat.finalPower, reason: 'firewall_impact', scoreEvent: combat.scoreEvent });
                }
            }
        }

        effects.push({ type: 'Juice', effect: 'flash', target, color: '#ffaa00' });
        messages.push("Firewall raised!");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        return SpatialSystem.getAxialTargets(state, origin, 4);
    },
    upgrades: {},
    scenarios: getSkillScenarios('FIREWALL')
};
