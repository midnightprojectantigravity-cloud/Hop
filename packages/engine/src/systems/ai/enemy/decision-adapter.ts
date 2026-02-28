import { hexEquals } from '../../../hex';
import type { Entity, GameState, Point } from '../../../types';
import type { Intent } from '../../../types/intent';
import type { AiDecision, AiDecisionAction } from '../core/types';
import type { EnemyAiDecisionResult } from './types';

type PlannerResultShape = { entity: Entity; nextState: GameState; message?: string };

const resolvePrimaryTargetId = (
    gameState: GameState,
    actor: Entity,
    targetHex?: Point
): string | undefined => {
    if (!targetHex) return undefined;
    const targetUnit = gameState.player.position.q === targetHex.q && gameState.player.position.r === targetHex.r
        ? gameState.player
        : gameState.enemies.find(e => e.position.q === targetHex.q && e.position.r === targetHex.r);
    if (targetUnit && targetUnit.factionId !== actor.factionId) return targetUnit.id;
    return undefined;
};

const intentStringToAiDecisionAction = (
    actor: Entity,
    plannedActor: Entity,
    plannedIntent: string,
    gameState: GameState
): AiDecisionAction => {
    const targetHex = plannedActor.intentPosition;
    if (plannedIntent === 'Moving' || plannedIntent === 'Advancing' || plannedIntent === 'Repositioning' || plannedIntent === 'Lumbering' || plannedIntent === 'Following') {
        return { type: 'MOVE', skillId: 'BASIC_MOVE', targetHex: plannedActor.position };
    }
    if (plannedIntent === 'BASIC_ATTACK') {
        return {
            type: 'ATTACK',
            skillId: 'BASIC_ATTACK',
            targetHex,
            primaryTargetId: resolvePrimaryTargetId(gameState, actor, targetHex)
        };
    }
    if (plannedIntent === 'SPEAR_THROW') return { type: 'USE_SKILL', skillId: 'SPEAR_THROW', targetHex };
    if (plannedIntent === 'ARCHER_SHOT') return { type: 'USE_SKILL', skillId: 'ARCHER_SHOT', targetHex };
    if (plannedIntent === 'DASH') return { type: 'USE_SKILL', skillId: 'DASH', targetHex };
    if (plannedIntent === 'GRAPPLE_HOOK') return { type: 'USE_SKILL', skillId: 'GRAPPLE_HOOK', targetHex };
    if (plannedIntent === 'Bombing') return { type: 'USE_SKILL', skillId: 'BOMB_TOSS', targetHex };
    if (plannedIntent === 'SENTINEL_BLAST') return { type: 'USE_SKILL', skillId: 'SENTINEL_BLAST', targetHex };
    if (plannedIntent === 'SENTINEL_TELEGRAPH') return { type: 'USE_SKILL', skillId: 'SENTINEL_TELEGRAPH', targetHex };
    return { type: 'WAIT', skillId: 'WAIT_SKILL' };
};

export const plannedResultToEnemyAiDecisionResult = (
    actor: Entity,
    gameState: GameState,
    planned: PlannerResultShape
): EnemyAiDecisionResult => {
    const plannedIntent = String(planned.entity.intent || 'Waiting');
    const action = intentStringToAiDecisionAction(actor, planned.entity, plannedIntent, gameState);
    const rngBefore = gameState.rngCounter || 0;
    const rngAfter = planned.nextState.rngCounter || 0;
    const decision: AiDecision<GameState> = {
        action,
        reasoningCode: plannedIntent.toUpperCase().replace(/\s+/g, '_'),
        expectedValue: 0,
        nextState: planned.nextState,
        rngConsumption: Math.max(0, rngAfter - rngBefore)
    };

    return {
        plannedEntity: planned.entity,
        nextState: planned.nextState,
        message: planned.message,
        decision
    };
};

export const enemyAiDecisionToIntent = (
    decision: AiDecision,
    actor: Entity,
    gameState: GameState,
    priority = 10
): Intent => {
    const action = decision.action;
    let skillId = action.skillId || 'WAIT_SKILL';
    let type: Intent['type'] = action.type;
    if (type === 'WAIT') skillId = 'WAIT_SKILL';
    if (type === 'MOVE') skillId = 'BASIC_MOVE';
    if (type === 'ATTACK') skillId = 'BASIC_ATTACK';

    const targetHex = action.targetHex;
    let primaryTargetId = action.primaryTargetId;
    if (!primaryTargetId && targetHex && (type === 'ATTACK' || type === 'USE_SKILL')) {
        primaryTargetId = resolvePrimaryTargetId(gameState, actor, targetHex);
    }

    // If a MOVE action points at the actor's current position, treat it as WAIT for intent consumers.
    if (type === 'MOVE' && targetHex && hexEquals(targetHex, actor.position)) {
        type = 'WAIT';
        skillId = 'WAIT_SKILL';
    }

    return {
        type,
        actorId: actor.id,
        skillId,
        primaryTargetId,
        targetHex,
        priority,
        metadata: {
            expectedValue: decision.expectedValue || 0,
            reasoningCode: decision.reasoningCode || 'AI_DECISION_COMPAT',
            isGhost: false,
            rngConsumption: decision.rngConsumption || 0
        }
    };
};
