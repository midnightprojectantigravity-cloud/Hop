import type { SkillDefinition, Point, GameState, AtomicEffect, Actor } from '../types';
import { getNeighbors } from '../hex';
import { pointToKey } from '../hex';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { SpatialSystem } from '../systems/spatial-system';
import { calculateCombat, extractTrinityStats } from '../systems/combat/combat-calculator';

/**
 * SENTINEL_BLAST
 * The Sentinel's unique attack. A wide-area blast that is telegraphed.
 */
export const SENTINEL_BLAST: SkillDefinition = {
    id: 'SENTINEL_BLAST',
    name: 'Sentinel Blast',
    description: 'A massive energy surge from the Sentinel.',
    slot: 'offensive',
    icon: '💥',
    baseVariables: {
        range: 3,
        cost: 0,
        cooldown: 0,
        damage: 2
    },
    execute: (_state: GameState, _attacker: Actor, target?: Point) => {
        if (!target) return { effects: [], messages: [] };
        const trinity = extractTrinityStats(_attacker);
        const primaryTarget = getActorAt(_state, target);
        const primaryCombat = calculateCombat({
            attackerId: _attacker.id,
            targetId: primaryTarget?.id || pointToKey(target),
            skillId: 'SENTINEL_BLAST',
            basePower: 2,
            trinity,
            targetTrinity: primaryTarget ? extractTrinityStats(primaryTarget) : undefined,
            damageClass: 'magical',
            scaling: [{ attribute: 'mind', coefficient: 0.2 }],
            statusMultipliers: []
        });

        const effects: AtomicEffect[] = [
            { type: 'Damage', target: target, amount: primaryCombat.finalPower, scoreEvent: primaryCombat.scoreEvent },
            {
                type: 'Juice',
                effect: 'shake',
                intensity: 'high',
                metadata: {
                    signature: 'ATK.BLAST.ARCANE.SENTINEL_BLAST',
                    family: 'attack',
                    primitive: 'blast',
                    phase: 'impact',
                    element: 'arcane',
                    variant: 'sentinel_blast',
                    targetRef: { kind: 'target_hex' },
                    skillId: 'SENTINEL_BLAST',
                    camera: { shake: 'high' }
                }
            }
        ];

        // Also hit neighbors
        const neighbors = getNeighbors(target);
        neighbors.forEach(n => {
            const neighborTarget = getActorAt(_state, n);
            const combat = calculateCombat({
                attackerId: _attacker.id,
                targetId: neighborTarget?.id || pointToKey(n),
                skillId: 'SENTINEL_BLAST',
                basePower: 1,
                trinity,
                targetTrinity: neighborTarget ? extractTrinityStats(neighborTarget) : undefined,
                damageClass: 'magical',
                scaling: [{ attribute: 'mind', coefficient: 0.1 }],
                statusMultipliers: []
            });
            effects.push({ type: 'Damage', target: n, amount: combat.finalPower, scoreEvent: combat.scoreEvent });
        });

        return {
            effects,
            messages: ['The Sentinel unleashed a massive blast!'],
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const range = 3;
        return SpatialSystem.getAreaTargets(state, origin, range);
    },
    upgrades: {},
    scenarios: getSkillScenarios('SENTINEL_BLAST')
};
