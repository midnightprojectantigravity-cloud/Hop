import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, getNeighbors, hexEquals } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { validateRange } from '../systems/validation';
import { pointToKey } from '../hex';
import { createDamageEffectFromCombat, resolveSkillCombatDamage } from '../systems/combat/combat-effect';
import { getActorAt } from '../helpers';

const hasCorpseAt = (state: GameState, target: Point): boolean => {
    const tile = state.tiles.get(pointToKey(target));
    return !!tile?.traits?.has('CORPSE');
};

const getCorpseTargetsInRange = (state: GameState, origin: Point, range: number): Point[] => {
    const targets: Point[] = [];
    state.tiles.forEach(tile => {
        if (tile.traits.has('CORPSE') && hexDistance(origin, tile.position) <= range) {
            targets.push(tile.position);
        }
    });
    return targets;
};

/**
 * CORPSE_EXPLOSION Skill
 * Detonate a corpse for AoE damage.
 */
export const CORPSE_EXPLOSION: SkillDefinition = {
    id: 'CORPSE_EXPLOSION',
    name: 'Corpse Explosion',
    description: 'Detonate a target corpse, dealing damage in a 1-tile radius.',
    slot: 'offensive',
    icon: '🧨💀',
    baseVariables: {
        range: 4,
        cost: 1,
        cooldown: 2,
        basePower: 2,
        damage: 1,
    },
    combat: {
        damageClass: 'magical',
        attackProfile: 'spell',
        trackingSignature: 'magic',
        weights: { mind: 1 }
    },
    execute: (state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const hasCorpse = hasCorpseAt(state, target);
        if (!hasCorpse) {
            return { effects, messages: ['A corpse is required!'], consumesTurn: false };
        }

        if (!validateRange(attacker.position, target, 4)) {
            return { effects, messages: ['Out of range!'], consumesTurn: false };
        }

        // 1. Remove the corpse
        effects.push({ type: 'RemoveCorpse', position: target });

        // 2. Damage AoE through centralized combat calculator.
        const affected = [target, ...getNeighbors(target)];
        const inDangerPreviewHex = !!state.intentPreview?.dangerTiles?.some(p => hexEquals(p, attacker.position));
        for (const p of affected) {
            const actorAtPoint = getActorAt(state, p);
            const combat = resolveSkillCombatDamage({
                attacker,
                target: actorAtPoint || ({ ...attacker, id: pointToKey(p), position: p, hp: 0, maxHp: 0 } as Actor),
                skillId: 'CORPSE_EXPLOSION',
                basePower: CORPSE_EXPLOSION.baseVariables.basePower ?? 0,
                skillDamageMultiplier: CORPSE_EXPLOSION.baseVariables.damage ?? 1,
                ...CORPSE_EXPLOSION.combat,
                engagementContext: { distance: hexDistance(attacker.position, p) },
                statusMultipliers: [],
                inDangerPreviewHex,
                theoreticalMaxPower: 2
            });
            effects.push(createDamageEffectFromCombat(combat, p, 'corpse_explosion'));
        }

        effects.push({
            type: 'Juice',
            effect: 'explosion_ring',
            target,
            metadata: {
                signature: 'ATK.BLAST.VOID.CORPSE_EXPLOSION',
                family: 'attack',
                primitive: 'blast',
                phase: 'impact',
                element: 'void',
                variant: 'corpse_explosion',
                targetRef: { kind: 'target_hex' },
                skillId: 'CORPSE_EXPLOSION'
            }
        });
        effects.push({
            type: 'Juice',
            effect: 'shake',
            intensity: 'high',
            metadata: {
                signature: 'UI.SHAKE.VOID.CORPSE_EXPLOSION',
                family: 'ui',
                primitive: 'shake',
                phase: 'impact',
                element: 'void',
                variant: 'corpse_explosion_shake',
                skillId: 'CORPSE_EXPLOSION',
                camera: { shake: 'high' }
            }
        });
        effects.push({
            type: 'Juice',
            effect: 'combat_text',
            target,
            text: 'BOOM!',
            metadata: {
                signature: 'UI.TEXT.VOID.CORPSE_EXPLOSION',
                family: 'ui',
                primitive: 'text',
                phase: 'impact',
                element: 'void',
                variant: 'corpse_explosion_text',
                targetRef: { kind: 'target_hex' },
                skillId: 'CORPSE_EXPLOSION',
                textTone: 'damage'
            }
        });

        messages.push("Corpse exploded!");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        return getCorpseTargetsInRange(state, origin, 4);
    },
    upgrades: {},
    scenarios: getSkillScenarios('CORPSE_EXPLOSION')
};
