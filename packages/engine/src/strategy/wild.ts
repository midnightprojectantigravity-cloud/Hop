import type { IStrategyProvider, Intent, IntentType } from '../types/intent';
import type { GameState, Actor } from '../types';
import { computeEnemyAction } from '../systems/ai';
import { SkillRegistry } from '../skillRegistry';
import { hexEquals } from '../hex';

export class WildStrategy implements IStrategyProvider {
    getIntent(gameState: GameState, actor: Actor): Intent {
        // 1. Prepare inputs for legacy AI
        // computeEnemyAction expects the player's *current* position (after they moved)
        // In the new turn order, the player might have already moved.
        const playerPos = gameState.player.position;

        // 2. Run the legacy AI simulation
        // We pass the current state. computeEnemyAction is pure-ish (returns new state/entity), 
        // so it won't mutate our input 'gameState'.
        // However, it consumes RNG from the state passed in. This is fine for the "Brain" decision.
        const result = computeEnemyAction(
            actor,
            playerPos,
            { ...gameState, occupiedCurrentTurn: gameState.occupiedCurrentTurn }
        );

        const { entity: plannedActor, message } = result;

        // 3. Map legacy "intent" string to new Intent object
        let type: IntentType = 'WAIT';
        let skillId = 'WAIT_SKILL';
        let targetHex: any = undefined; // Use Point or undefined
        let primaryTargetId = undefined;
        let priority = 10;

        // Legacy intents: 'Moving', 'BASIC_ATTACK', 'SPEAR_THROW', 'Bombing', 'SENTINEL_BLAST', etc.
        const legacyIntent = plannedActor.intent || 'Waiting';

        if (legacyIntent === 'Moving' || legacyIntent === 'Advancing' || legacyIntent === 'Repositioning' || legacyIntent === 'Lumbering') {
            type = 'MOVE';
            skillId = 'BASIC_MOVE';
            targetHex = plannedActor.position; // The AI returns the final position it wants to be at
        } else if (legacyIntent === 'BASIC_ATTACK') {
            type = 'ATTACK';
            skillId = 'BASIC_ATTACK';
            targetHex = plannedActor.intentPosition;
            if (targetHex) {
                // Try to resolve unit ID at target hex
                const targetUnit = gameState.player.position.q === targetHex.q && gameState.player.position.r === targetHex.r
                    ? gameState.player
                    : gameState.enemies.find(e => e.position.q === targetHex?.q && e.position.r === targetHex?.r);
                if (targetUnit && targetUnit.factionId !== actor.factionId) {
                    primaryTargetId = targetUnit.id;
                }
            }
        } else if (legacyIntent === 'SPEAR_THROW') {
            type = 'USE_SKILL';
            skillId = 'SPEAR_THROW';
            targetHex = plannedActor.intentPosition;
        } else if (legacyIntent === 'Bombing') {
            type = 'USE_SKILL';
            skillId = 'BOMB_TOSS'; // Assuming skill ID
            targetHex = plannedActor.intentPosition;
        } else if (legacyIntent === 'SENTINEL_BLAST') {
            type = 'USE_SKILL';
            skillId = 'SENTINEL_BLAST';
            targetHex = plannedActor.intentPosition;
        } else if (legacyIntent === 'Charging Power' || legacyIntent === 'Preparing') {
            type = 'WAIT';
            skillId = 'WAIT_SKILL';
        }

        // Validate intent against skill loadout + valid targets to avoid zero-effect loops.
        const hasSkill = skillId === 'WAIT_SKILL'
            || skillId === 'BASIC_MOVE'
            || actor.activeSkills?.some(s => s.id === skillId);

        if (!hasSkill) {
            type = 'WAIT';
            skillId = 'WAIT_SKILL';
            targetHex = undefined;
            primaryTargetId = undefined;
        } else if (skillId !== 'WAIT_SKILL') {
            const def = SkillRegistry.get(skillId);
            if (def?.getValidTargets && targetHex) {
                const validTargets = def.getValidTargets(gameState, actor.position);
                const isValid = validTargets.some(v => hexEquals(v, targetHex));
                if (!isValid) {
                    type = 'WAIT';
                    skillId = 'WAIT_SKILL';
                    targetHex = undefined;
                    primaryTargetId = undefined;
                }
            }
        }

        return {
            type,
            actorId: actor.id,
            skillId,
            primaryTargetId,
            targetHex,
            priority,
            metadata: {
                expectedValue: 0, // Legacy AI doesn't give a score easily
                reasoningCode: legacyIntent.toUpperCase().replace(' ', '_'),
                isGhost: false,
                // Track RNG consumed during decision making to ensure TacticalEngine doesn't reuse same values
                rngConsumption: (message?.includes('teleports') || message?.includes('Bombing')) ?
                    ((result.nextState.rngCounter || 0) - (gameState.rngCounter || 0)) :
                    ((result.nextState.rngCounter || 0) - (gameState.rngCounter || 0))
            }
        };
    }
}
