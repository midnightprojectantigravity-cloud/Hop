import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexEquals, getNeighbors } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { getActorAt } from '../helpers';
import { SpatialSystem } from '../systems/SpatialSystem';
import { getFalconForHunter } from '../systems/falcon';
import { createFalcon } from '../systems/entity-factory';

/**
 * FALCON_COMMAND Skill
 * 
 * The Mark system with three modes:
 * - Mode 1: Scout (Mark Tile) - Falcon orbits target tile, pecks nearby enemies
 * - Mode 2: Predator (Mark Enemy) - Falcon pursues target, unlocks Apex Strike
 * - Mode 3: Roost (Mark Self/Idle) - Falcon returns to Hunter, heals + cleanses
 * 
 * Only one Mark can exist at a time. Using the command is an action.
 */
export const FALCON_COMMAND: SkillDefinition = {
    id: 'FALCON_COMMAND',
    name: (state: GameState) => {
        const falcon = getFalconForHunter(state, state.player.id);
        if (!falcon) return 'Summon Falcon';
        const mode = falcon.companionState?.mode || 'roost';
        return mode === 'scout' ? 'Falcon: Scout'
            : mode === 'predator' ? 'Falcon: Hunt'
                : 'Falcon: Roost';
    },
    description: (state: GameState) => {
        const falcon = getFalconForHunter(state, state.player.id);
        if (!falcon) return 'Call your Falcon companion.';
        const mode = falcon.companionState?.mode || 'roost';
        return mode === 'scout'
            ? 'Click tile to set patrol zone. Falcon orbits and attacks nearby enemies.'
            : mode === 'predator'
                ? 'Click enemy to mark as prey. Falcon pursues and uses Apex Strike.'
                : 'Falcon returns to you. Heals and cleanses 1 debuff on arrival.';
    },
    slot: 'offensive',
    icon: '🦅',
    baseVariables: {
        range: 6,
        cost: 0,
        cooldown: 0, // No cooldown, but consumes a turn
    },
    execute: (state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        // Get or spawn Falcon
        let falcon = getFalconForHunter(state, attacker.id);

        if (!falcon) {
            // First use: Spawn the Falcon
            const falconEntity = createFalcon({
                ownerId: attacker.id,
                position: getNeighbors(attacker.position)[0], // Will be validated
            });

            effects.push({
                type: 'SpawnActor',
                actor: falconEntity
            });

            effects.push({
                type: 'Message',
                text: 'Your Falcon companion awakens!'
            });

            messages.push('Falcon summoned!');
            return { effects, messages, consumesTurn: true };
        }

        // Determine mode based on target
        // Check if target is self or has a target actor that is the attacker
        const targetActor = target ? getActorAt(state, target) : undefined;
        const isTargetSelf = !target || hexEquals(target, attacker.position) || !!(targetActor && targetActor.id === attacker.id);

        if (isTargetSelf) {
            // No target or target self = Roost mode
            messages.push('Falcon returns to roost.');
            effects.push({ type: 'Juice', effect: 'combat_text', target: attacker.position, text: 'Roost' });
            effects.push({
                type: 'UpdateCompanionState',
                target: falcon.id,
                mode: 'roost',
            });
            return {
                effects,
                messages,
                consumesTurn: true,
            };
        }

        // Check if target is an enemy (Predator mode) or tile (Scout mode)

        if (targetActor && targetActor.factionId === 'enemy') {
            // Predator Mode: Mark enemy
            messages.push(`Falcon marks ${targetActor.subtype || 'enemy'} as prey!`);
            effects.push({ type: 'Juice', effect: 'combat_text', target: target, text: '🎯 Marked' });
            effects.push({ type: 'ApplyStatus', target: targetActor.id, status: 'marked_predator', duration: -1 });
            effects.push({
                type: 'UpdateCompanionState',
                target: falcon.id,
                mode: 'predator',
                markTarget: targetActor.id,
            });
            return {
                effects,
                messages,
                consumesTurn: true,
            };
        } else {
            // Scout Mode: Mark tile
            messages.push('Falcon set to patrol zone.');
            effects.push({ type: 'Juice', effect: 'combat_text', target: target, text: '👁️ Patrol' });
            effects.push({
                type: 'UpdateCompanionState',
                target: falcon.id,
                mode: 'scout',
                markTarget: target,
            });
            return {
                effects,
                messages,
                consumesTurn: true,
            };
        }
    },
    getValidTargets: (state: GameState, origin: Point) => {
        // Can target any tile within range, or enemies for predator mode
        const range = 6;
        return SpatialSystem.getAreaTargets(state, origin, range).filter(p => {
            if (hexEquals(p, origin)) return true; // Can target self for Roost
            return true; // All tiles valid for Scout mode
        });
    },
    upgrades: {
        KEEN_SIGHT: {
            id: 'KEEN_SIGHT',
            name: 'Keen Sight',
            description: 'Falcon reveals hidden enemies within 3 tiles of its position.',
        },
        TWIN_TALONS: {
            id: 'TWIN_TALONS',
            name: 'Twin Talons',
            description: 'Basic Peck hits 2 targets instead of 1.',
        },
        APEX_PREDATOR: {
            id: 'APEX_PREDATOR',
            name: 'Apex Predator',
            description: 'Apex Strike cooldown reduced by 1. Marked enemies take +1 damage from all sources.',
        },
    },
    scenarios: getSkillScenarios('FALCON_COMMAND'),
};
