import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors, hexEquals } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { validateAxialDirection, validateRange } from '../systems/validation';
import { SpatialSystem } from '../systems/SpatialSystem';
import { calculateCombat, extractTrinityStats } from '../systems/combat-calculator';
import { getActorAt } from '../helpers';
import { pointToKey } from '../hex';



/**
 * FIREBALL Skill
 * Range 3, Axial Only.
 * Deals 1 damage to target and neighbors.
 * Leaves fire at target.
 */
export const FIREBALL: SkillDefinition = {
    id: 'FIREBALL',
    name: 'Fireball',
    description: 'Launch a sphere of flame. Range 3, Axial. Deals damage and leaves fire.',
    slot: 'offensive',
    icon: '🔥',
    baseVariables: {
        range: 3,
        cost: 1,
        cooldown: 2,
    },
    execute: (_state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const { isAxial } = validateAxialDirection(attacker.position, target);

        if (!validateRange(attacker.position, target, 3) || !isAxial) {
            return { effects, messages: ['Invalid target! Range 3, Axial only.'], consumesTurn: false };
        }

        // Damage target and neighbors through centralized combat calculator.
        const affected = [target, ...getNeighbors(target)];
        const trinity = extractTrinityStats(attacker);
        const inDangerPreviewHex = !!_state.intentPreview?.dangerTiles?.some(p => hexEquals(p, attacker.position));
        for (const p of affected) {
            const actorAtPoint = getActorAt(_state, p);
            const combat = calculateCombat({
                attackerId: attacker.id,
                targetId: actorAtPoint?.id || pointToKey(p),
                skillId: 'FIREBALL',
                basePower: 1,
                trinity,
                targetTrinity: actorAtPoint ? extractTrinityStats(actorAtPoint) : undefined,
                damageClass: 'magical',
                scaling: [{ attribute: 'mind', coefficient: 0.2 }],
                statusMultipliers: [],
                inDangerPreviewHex,
                theoreticalMaxPower: 1
            });
            effects.push({ type: 'Damage', target: p, amount: combat.finalPower, reason: 'fireball', scoreEvent: combat.scoreEvent });
            effects.push({ type: 'PlaceFire', position: p, duration: 3 });
        }

        effects.push({ type: 'Juice', effect: 'flash', target, color: '#ff4400' });
        effects.push({ type: 'Juice', effect: 'shake', intensity: 'medium' });

        messages.push("Fireball!");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        return SpatialSystem.getAxialTargets(state, origin, 3);
    },
    upgrades: {},
    scenarios: getSkillScenarios('FIREBALL')
};
