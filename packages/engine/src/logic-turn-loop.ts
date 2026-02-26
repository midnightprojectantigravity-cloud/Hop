import type { Entity, GameState } from './types';
import type { Intent } from './types/intent';
import { getNeighbors } from './hex';
import { resolveTelegraphedAttacks } from './systems/combat';
import { tickActorSkills } from './systems/entities/actor';
import { applyEffects } from './systems/effect-engine';
import { SpatialSystem } from './systems/spatial-system';
import {
    advanceInitiative,
    startActorTurn,
    endActorTurn,
    removeFromQueue,
    getTurnStartPosition,
    getTurnStartNeighborIds,
    getCurrentEntry,
} from './systems/initiative';
import { isStunned, tickStatuses } from './systems/status';
import { buildIntentPreview } from './systems/telegraph-projection';
import { buildRunSummary } from './systems/run-objectives';
import { appendTaggedMessage, appendTaggedMessages } from './systems/engine-messages';
import { StrategyRegistry } from './systems/ai/strategy-registry';
import { processIntent } from './systems/intent-middleware';
import { TacticalEngine } from './systems/tactical-engine';
import { applyAutoAttack } from './skills/auto_attack';

type ExecuteStatusWindowFn = (
    state: GameState,
    actorId: string,
    window: 'START_OF_TURN' | 'END_OF_TURN',
    stepId?: string
) => { state: GameState; messages: string[] };

type WithPendingFrameFn = (
    state: GameState,
    pendingStatus: NonNullable<GameState['pendingStatus']>,
    frameType: any,
    framePayload?: Record<string, unknown>
) => GameState;

type ApplyPlayerEndOfTurnRulesFn = (
    state: GameState,
    actorStepId: string,
    deps: { withPendingFrame: WithPendingFrameFn }
) => { state: GameState; messages: string[]; haltTurnLoop: boolean };

export type ProcessNextTurnFactoryDeps = {
    executeStatusWindow: ExecuteStatusWindowFn;
    withPendingFrame: WithPendingFrameFn;
    applyPlayerEndOfTurnRules: ApplyPlayerEndOfTurnRulesFn;
    warnTurnStackInvariant: (message: string, payload?: Record<string, unknown>) => void;
    engineDebug: boolean;
    engineWarn: boolean;
};

export const createProcessNextTurn = (deps: ProcessNextTurnFactoryDeps) => {
    const processNextTurn = (state: GameState, isResuming: boolean = false): GameState => {
        if (state.pendingStatus || (state.pendingFrames?.length ?? 0) > 0) {
            deps.warnTurnStackInvariant('Blocked processNextTurn while pendingStatus is active.', {
                status: state.pendingStatus?.status,
                pendingFrames: state.pendingFrames?.length ?? 0,
                turnNumber: state.turnNumber
            });
            return state;
        }
        let curState = state;
        const messages: string[] = [];
        const dyingEntities: Entity[] = [];

        let iterations = 0;
        const MAX_ITERATIONS = 100;

        let skipAdvance = false;

        while (iterations < MAX_ITERATIONS) {
            iterations++;

            if (curState.player.hp <= 0 && curState.pendingStatus?.status !== 'lost') {
                const completedRun = buildRunSummary(curState);
                return deps.withPendingFrame(
                    {
                        ...curState,
                        message: appendTaggedMessage(curState.message, 'You have fallen...', 'CRITICAL', 'COMBAT')
                    },
                    {
                        status: 'lost',
                        completedRun
                    },
                    'RUN_LOST',
                    { reason: 'GLOBAL_DEATH_CHECK' }
                );
            }
            curState.occupancyMask = SpatialSystem.refreshOccupancyMask(curState);

            let actorId: string | undefined;

            if (((isResuming && iterations === 1) || skipAdvance) && curState.initiativeQueue) {
                skipAdvance = false;
                const q = curState.initiativeQueue;
                if (q.entries.length > 0 && q.currentIndex >= 0 && q.currentIndex < q.entries.length) {
                    actorId = q.entries[q.currentIndex].actorId;
                }
            } else {
                const res = advanceInitiative(curState);
                curState = { ...curState, initiativeQueue: res.queue };
                actorId = res.actorId ?? undefined;
            }

            if (!actorId) break;

            const actor = actorId === 'player' ? curState.player : curState.enemies.find(e => e.id === actorId);
            const actorStepId = `${curState.turnNumber}:${curState.initiativeQueue?.round ?? 0}:${actorId}:${iterations}`;

            if (!actor || actor.hp <= 0) {
                curState = { ...curState, initiativeQueue: removeFromQueue(curState.initiativeQueue!, actorId) };
                continue;
            }

            const entry = getCurrentEntry(curState.initiativeQueue!);
            if (!entry?.turnStartPosition) {
                curState = { ...curState, initiativeQueue: startActorTurn(curState, actor) };
            }

            if (!isResuming || iterations > 1) {
                const sotResult = deps.executeStatusWindow(curState, actorId, 'START_OF_TURN', actorStepId);
                curState = sotResult.state;
                messages.push(...sotResult.messages);

                if (actorId === 'player' && curState.upgrades?.includes('RELIC_STEADY_PLATES')) {
                    const boostedArmor = Math.min(2, (curState.player.temporaryArmor || 0) + 1);
                    if (boostedArmor !== (curState.player.temporaryArmor || 0)) {
                        curState = {
                            ...curState,
                            player: {
                                ...curState.player,
                                temporaryArmor: boostedArmor
                            }
                        };
                        messages.push(appendTaggedMessage([], 'Steady Plates harden your stance.', 'INFO', 'COMBAT')[0]);
                    }
                }

                if (actorId === 'player') {
                    const shieldSkill = curState.player.activeSkills?.find(s => s.id === 'SHIELD_BASH');
                    const hasPassiveProtection = !!shieldSkill?.activeUpgrades?.includes('PASSIVE_PROTECTION');
                    if (hasPassiveProtection && (shieldSkill?.currentCooldown || 0) === 0) {
                        const hardenedArmor = Math.max(curState.player.temporaryArmor || 0, 1);
                        if (hardenedArmor !== (curState.player.temporaryArmor || 0)) {
                            curState = {
                                ...curState,
                                player: {
                                    ...curState.player,
                                    temporaryArmor: hardenedArmor
                                }
                            };
                            messages.push(appendTaggedMessage([], 'Passive Protection braces your guard.', 'INFO', 'COMBAT')[0]);
                        }
                    }
                }

                const tele = resolveTelegraphedAttacks(curState, curState.player.position, actorId, actorStepId);
                curState = tele.state;
                messages.push(...tele.messages);
            }

            const activeActor = actorId === 'player' ? curState.player : curState.enemies.find(e => e.id === actorId);
            if (!activeActor || activeActor.hp <= 0) {
                curState = {
                    ...curState,
                    initiativeQueue: removeFromQueue(curState.initiativeQueue!, actorId),
                    message: appendTaggedMessages(curState.message, messages, 'INFO', 'SYSTEM')
                };
                continue;
            }

            const actorForIntent = actorId === 'player' ? curState.player : curState.enemies.find(e => e.id === actorId);
            if (!actorForIntent || actorForIntent.hp <= 0) {
                continue;
            }
            let intent: Intent;
            let forcedStunSkip = false;
            if (isStunned(actorForIntent)) {
                forcedStunSkip = true;
                intent = {
                    type: 'WAIT',
                    actorId: actorForIntent.id,
                    skillId: 'WAIT_SKILL',
                    priority: 0,
                    metadata: {
                        expectedValue: 0,
                        reasoningCode: 'STATUS_STUNNED_AUTOSKIP',
                        isGhost: false
                    }
                };
                if (actorId === 'player') {
                    messages.push('You are stunned and skip your turn.');
                } else {
                    messages.push(`${actorForIntent.subtype || 'Enemy'} is stunned and skips its turn.`);
                }
            } else {
                const strategy = StrategyRegistry.resolve(actorForIntent);
                const intentOrPromise = strategy.getIntent(curState, actorForIntent);

                if (intentOrPromise instanceof Promise) {
                    const intentPreview = buildIntentPreview(curState);
                    return {
                        ...curState,
                        intentPreview,
                        message: appendTaggedMessages(curState.message, messages, 'INFO', 'SYSTEM'),
                        dyingEntities: [...(curState.dyingEntities || []), ...dyingEntities]
                    };
                }

                intent = intentOrPromise as Intent;
            }

            const loadoutStr = activeActor.activeSkills.map(s => s.id).join(', ');
            if (deps.engineDebug) {
                console.log(`[ENGINE] Actor: ${actorId} | Loadout: [${loadoutStr}] | Pos: ${JSON.stringify(activeActor.position)}`);
                console.log(`[ENGINE] Intent: ${intent.type} | Skill: ${intent.skillId} | TargetHex: ${intent.targetHex ? JSON.stringify(intent.targetHex) : 'none'} | TargetId: ${intent.primaryTargetId || 'none'}`);
            }

            if (intent.metadata.rngConsumption) {
                curState = {
                    ...curState,
                    rngCounter: (curState.rngCounter || 0) + intent.metadata.rngConsumption
                };
            }

            intent = processIntent(intent, curState, actorForIntent);

            const { effects, messages: tacticalMessages, consumesTurn, targetId, kills } = TacticalEngine.execute(intent, actorForIntent, curState);
            if (deps.engineDebug) {
                console.log(`[ENGINE] ${actorId} intends ${intent.type} (${intent.skillId}) onto ${targetId || (intent.targetHex ? JSON.stringify(intent.targetHex) : 'self')}`);
            }

            if (deps.engineWarn && effects.length === 0 && intent.type !== 'WAIT') {
                const warnMsg = `[ENGINE] WARNING: Intent ${intent.type} (${intent.skillId}) for actor ${actorId} produced ZERO effects!`;
                console.warn(warnMsg);
            }

            const stateBeforeEffects = curState;
            const nextState = applyEffects(curState, effects, { sourceId: actorId, targetId, stepId: actorStepId });

            if (actorId === 'player') {
                nextState.kills = (nextState.kills || 0) + (kills || 0);
            }

            if (consumesTurn === false) {
                curState = {
                    ...stateBeforeEffects,
                    message: appendTaggedMessages(curState.message, tacticalMessages, 'INFO', 'COMBAT')
                };
                skipAdvance = true;
                continue;
            }

            curState = nextState;
            messages.push(...tacticalMessages);

            if (actorId !== 'player') {
                const actingEnemy = curState.enemies.find(e => e.id === actorId);
                if (actingEnemy?.subtype === 'bomber') {
                    const nextCooldown = intent.skillId === 'BOMB_TOSS'
                        ? 2
                        : Math.max(0, (actingEnemy.actionCooldown ?? 0) - 1);
                    if (actingEnemy.actionCooldown !== nextCooldown) {
                        curState = {
                            ...curState,
                            enemies: curState.enemies.map(e => e.id === actorId ? { ...e, actionCooldown: nextCooldown } : e)
                        };
                    }
                }
            }

            const postActionActor = actorId === 'player' ? curState.player : curState.enemies.find(e => e.id === actorId);
            if (!postActionActor || postActionActor.hp <= 0) {
                if (actorId === 'player') {
                    const completedRun = buildRunSummary(curState);
                    return deps.withPendingFrame(
                        {
                            ...curState,
                            message: appendTaggedMessage(
                                appendTaggedMessages(curState.message, messages, 'INFO', 'SYSTEM'),
                                'You have fallen...',
                                'CRITICAL',
                                'COMBAT'
                            )
                        },
                        { status: 'lost', completedRun },
                        'RUN_LOST',
                        { reason: 'SELF_ACTION_DEATH' }
                    );
                }
                curState = {
                    ...curState,
                    enemies: curState.enemies.filter(e => e.id !== actorId),
                    initiativeQueue: removeFromQueue(curState.initiativeQueue!, actorId),
                    message: appendTaggedMessages(curState.message, messages, 'INFO', 'SYSTEM')
                };
                continue;
            }

            const eotResult = deps.executeStatusWindow(curState, actorId, 'END_OF_TURN', actorStepId);
            curState = eotResult.state;
            messages.push(...eotResult.messages);

            curState = {
                ...curState,
                enemies: curState.enemies.map(e => e.id === actorId ? tickActorSkills(tickStatuses(e)) : e),
                player: actorId === 'player' ? tickActorSkills(tickStatuses(curState.player)) : curState.player,
                initiativeQueue: endActorTurn(curState, actorId)
            };

            const actorAfterTurn = actorId === 'player' ? curState.player : curState.enemies.find(e => e.id === actorId);
            const skipPassivesThisTurn =
                forcedStunSkip
                || intent.metadata?.reasoningCode === 'STATUS_STUNNED'
                || intent.metadata?.reasoningCode === 'STATUS_STUNNED_AUTOSKIP';

            if (!skipPassivesThisTurn && actorAfterTurn && actorAfterTurn.hp > 0) {
                const playerStartPos = getTurnStartPosition(curState, actorId) || actorAfterTurn.previousPosition || actorAfterTurn.position;
                const persistentNeighborIds = getTurnStartNeighborIds(curState, actorId) ?? undefined;

                const autoAttackResult = applyAutoAttack(
                    curState,
                    actorAfterTurn,
                    getNeighbors(playerStartPos),
                    playerStartPos,
                    persistentNeighborIds,
                    actorStepId
                );
                curState = autoAttackResult.state;
                messages.push(...autoAttackResult.messages);
                if (actorId === 'player') {
                    curState.kills = (curState.kills || 0) + autoAttackResult.kills;
                }
            }

            if (actorId === 'player') {
                const playerTurnRules = deps.applyPlayerEndOfTurnRules(curState, actorStepId, { withPendingFrame: deps.withPendingFrame });
                curState = playerTurnRules.state;
                if (playerTurnRules.haltTurnLoop) {
                    return curState;
                }
                messages.push(...playerTurnRules.messages);
            }
        }

        const intentPreview = buildIntentPreview(curState);
        return {
            ...curState,
            intentPreview,
            message: appendTaggedMessages(curState.message, messages, 'INFO', 'SYSTEM'),
            dyingEntities: [...(curState.dyingEntities || []), ...dyingEntities]
        };
    };

    return processNextTurn;
};
