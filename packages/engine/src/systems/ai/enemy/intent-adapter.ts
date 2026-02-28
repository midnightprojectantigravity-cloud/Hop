import { SkillRegistry } from '../../../skillRegistry';
import { hexEquals } from '../../../hex';
import type { Entity, GameState } from '../../../types';
import type { Intent } from '../../../types/intent';
import type { AiDecision } from '../core/types';
import { enemyAiDecisionToIntent } from './decision-adapter';

/**
 * Converts a normalized enemy AI decision into the agency Intent contract,
 * while preserving legacy validation safeguards from WildStrategy.
 */
export const toEnemyIntent = (
    decision: AiDecision,
    actor: Entity,
    gameState: GameState
): Intent => {
    const intent = enemyAiDecisionToIntent(decision, actor, gameState);

    // Compatibility for archers spawned before ARCHER_SHOT rollout.
    if (
        intent.skillId === 'ARCHER_SHOT'
        && !(actor.activeSkills?.some(s => s.id === 'ARCHER_SHOT'))
        && actor.activeSkills?.some(s => s.id === 'SPEAR_THROW')
    ) {
        intent.skillId = 'SPEAR_THROW';
    }

    const hasSkill = intent.skillId === 'WAIT_SKILL'
        || actor.activeSkills?.some(s => s.id === intent.skillId);

    if (!hasSkill) {
        intent.type = 'WAIT';
        intent.skillId = 'WAIT_SKILL';
        intent.targetHex = undefined;
        intent.primaryTargetId = undefined;
        return intent;
    }

    if (intent.skillId !== 'WAIT_SKILL' && intent.targetHex) {
        const def = SkillRegistry.get(intent.skillId);
        if (def?.getValidTargets) {
            const validTargets = def.getValidTargets(gameState, actor.position);
            const isValid = validTargets.some(v => hexEquals(v, intent.targetHex!));
            if (!isValid) {
                intent.type = 'WAIT';
                intent.skillId = 'WAIT_SKILL';
                intent.targetHex = undefined;
                intent.primaryTargetId = undefined;
            }
        }
    }

    return intent;
};
