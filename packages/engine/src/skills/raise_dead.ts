import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, hexEquals } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { validateRange } from '../systems/validation';

/**
 * RAISE_DEAD Skill
 * Reanimate a corpse into a Skeleton minion.
 */
export const RAISE_DEAD: SkillDefinition = {
    id: 'RAISE_DEAD',
    name: 'Raise Dead',
    description: 'Reanimate a target corpse into a Skeleton minion (Faction: Player).',
    slot: 'utility',
    icon: '💀✨',
    baseVariables: {
        range: 4,
        cost: 1,
        cooldown: 3,
    },
    execute: (state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const corpses = state.dyingEntities || [];
        const hasCorpse = corpses.some(cp => hexEquals(cp.position, target));
        if (!hasCorpse) {
            return { effects, messages: ['A corpse is required!'], consumesTurn: false };
        }

        if (!validateRange(attacker.position, target, 4)) {
            return { effects, messages: ['Out of range!'], consumesTurn: false };
        }

        // 1. Remove the corpse
        effects.push({ type: 'RemoveCorpse', position: target });

        // 2. Spawn Skeleton
        const skeleton: Actor = {
            id: `skeleton_${Date.now()}`,
            type: 'enemy', // Technical type for initiative entry sorting
            subtype: 'skeleton',
            factionId: 'player', // CRITICAL: Friendly to player
            position: target,
            hp: 2,
            maxHp: 2,
            speed: 50,
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: [],
            weightClass: 'Standard'
        };

        effects.push({ type: 'SpawnActor', actor: skeleton });

        effects.push({ type: 'Juice', effect: 'flash', target, color: '#aaaaaa' });
        messages.push("Skeleton raised!");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        return (state.dyingEntities || []).filter(cp => hexDistance(origin, cp.position) <= 4).map(e => e.position);
    },
    upgrades: {},
    scenarios: getSkillScenarios('RAISE_DEAD')
};
