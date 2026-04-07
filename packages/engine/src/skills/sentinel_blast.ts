import type { SkillDefinition, Point, GameState, AtomicEffect, Actor } from '../types';
import { getNeighbors, hexDistance } from '../hex';
import { pointToKey } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { SpatialSystem } from '../systems/spatial-system';
import { createDamageEffectFromCombat, resolveSkillCombatDamage } from '../systems/combat/combat-effect';

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
        basePower: 2,
        damage: 1
    },
    combat: {
        damageClass: 'magical',
        attackProfile: 'spell',
        trackingSignature: 'magic',
        weights: { mind: 1 }
    },
    execute: (_state: GameState, _attacker: Actor, target?: Point) => {
        if (!target) return { effects: [], messages: [] };
        const primaryTarget = { ..._attacker, id: pointToKey(target), position: target, hp: 0, maxHp: 0 } as Actor;
        const primaryCombat = resolveSkillCombatDamage({
            attacker: _attacker,
            target: primaryTarget,
            skillId: 'SENTINEL_BLAST',
            basePower: SENTINEL_BLAST.baseVariables.basePower ?? 0,
            skillDamageMultiplier: SENTINEL_BLAST.baseVariables.damage ?? 1,
            ...SENTINEL_BLAST.combat,
            engagementContext: { distance: hexDistance(_attacker.position, target) },
            statusMultipliers: []
        });

        const effects: AtomicEffect[] = [
            createDamageEffectFromCombat(primaryCombat, target, 'sentinel_blast'),
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
            const neighborTarget = { ..._attacker, id: pointToKey(n), position: n, hp: 0, maxHp: 0 } as Actor;
            const combat = resolveSkillCombatDamage({
                attacker: _attacker,
                target: neighborTarget,
                skillId: 'SENTINEL_BLAST',
                basePower: SENTINEL_BLAST.baseVariables.basePower ?? 0,
                skillDamageMultiplier: SENTINEL_BLAST.baseVariables.damage ?? 1,
                ...SENTINEL_BLAST.combat,
                engagementContext: { distance: hexDistance(_attacker.position, n) },
                statusMultipliers: []
            });
            effects.push(createDamageEffectFromCombat(combat, n, 'sentinel_blast'));
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
