import type { Actor } from '../../types';
import type { AtomicEffectHandlerMap } from './types';
import { applyIresMutationToActor, ensureActorIres, resolveIresRuleset } from '../ires';

export const actorStateEffectHandlers: AtomicEffectHandlerMap = {
    ModifyCooldown: (state, effect, context) => {
        const applyToActor = (actor: Actor): Actor => ({
            ...actor,
            activeSkills: actor.activeSkills?.map(s => {
                if (s.id !== effect.skillId) return s;
                return {
                    ...s,
                    currentCooldown: effect.setExact ? effect.amount : Math.max(0, s.currentCooldown + effect.amount)
                };
            })
        });

        const actorId = context.sourceId || state.player.id;
        if (actorId === state.player.id) {
            return { ...state, player: applyToActor(state.player) };
        }

        return {
            ...state,
            enemies: state.enemies.map(e => e.id === actorId ? applyToActor(e) : e),
            companions: state.companions?.map(e => e.id === actorId ? applyToActor(e) : e)
        };
    },
    SetStealth: (state, effect) => {
        const updateStealth = (actor: Actor) => ({ ...actor, stealthCounter: (actor.stealthCounter || 0) + effect.amount });

        if (effect.target === 'self') {
            return { ...state, player: updateStealth(state.player) };
        }

        return {
            ...state,
            enemies: state.enemies.map(e => e.id === effect.target ? updateStealth(e) : e),
            companions: state.companions?.map(e => e.id === effect.target ? updateStealth(e) : e)
        };
    },
    UpdateCompanionState: (state, effect, context) => {
        const targetId = effect.target === 'self' ? (context.sourceId || state.player.id) : effect.target;
        const updateFunc = (e: Actor) => {
            if (e.id !== targetId) return e;
            return {
                ...e,
                companionState: {
                    ...e.companionState,
                    mode: effect.mode || e.companionState?.mode,
                    markTarget: effect.markTarget !== undefined ? effect.markTarget : e.companionState?.markTarget,
                    orbitStep: effect.mode === 'scout' ? 0 : e.companionState?.orbitStep,
                    apexStrikeCooldown: effect.apexStrikeCooldown !== undefined ? effect.apexStrikeCooldown : e.companionState?.apexStrikeCooldown,
                    healCooldown: effect.healCooldown !== undefined ? effect.healCooldown : e.companionState?.healCooldown,
                }
            } as Actor;
        };

        return {
            ...state,
            enemies: state.enemies.map(updateFunc),
            companions: state.companions?.map(updateFunc)
        };
    },
    ApplyResources: (state, effect, context, api) => {
        const config = resolveIresRuleset(state.ruleset);
        const actorId = effect.target === 'self'
            ? (context.sourceId || state.player.id)
            : effect.target;
        const currentActor = actorId === state.player.id
            ? state.player
            : state.enemies.find(e => e.id === actorId) || state.companions?.find(e => e.id === actorId);
        if (!currentActor) return state;

        const beforeActor = ensureActorIres(currentActor, config);
        const before = beforeActor.ires!;
        const resetTurnFlags =
            effect.resetTurnFlags === true
            || effect.debug?.actionKind === 'rest'
            || effect.debug?.actionKind === 'end_turn'
            || effect.debug?.actionKind === 'travel';
        const afterActor = applyIresMutationToActor(beforeActor, {
            sparkDelta: effect.sparkDelta,
            manaDelta: effect.manaDelta,
            exhaustionDelta: effect.exhaustionDelta,
            actionCountDelta: effect.actionCountDelta,
            movedThisTurn: effect.movedThisTurn,
            actedThisTurn: effect.actedThisTurn,
            pendingRestedBonus: effect.nextPendingRestedBonus,
            activeRestedCritBonusPct: effect.nextActiveRestedCritBonusPct,
            resetTurnFlags
        }, config);
        const after = afterActor.ires!;

        let nextState = actorId === state.player.id
            ? { ...state, player: afterActor }
            : {
                ...state,
                enemies: state.enemies.map(e => e.id === actorId ? afterActor : e),
                companions: state.companions?.map(e => e.id === actorId ? afterActor : e)
            };

        nextState = api.appendTimelineEvent(
            nextState,
            'RESOURCE_APPLY',
            'ApplyResources',
            {
                actorId,
                sparkDelta: effect.sparkDelta,
                manaDelta: effect.manaDelta,
                exhaustionDelta: effect.exhaustionDelta,
                actionCountDelta: effect.actionCountDelta,
                debug: effect.debug
            },
            context,
            false,
            90
        );

        if (effect.sparkDelta || effect.manaDelta || effect.exhaustionDelta || effect.actionCountDelta) {
            nextState = api.appendSimulationEvent(nextState, {
                type: 'ResourceChanged',
                actorId,
                targetId: actorId,
                position: afterActor.position,
                payload: {
                    spark: { before: before.spark, after: after.spark, delta: effect.sparkDelta },
                    mana: { before: before.mana, after: after.mana, delta: effect.manaDelta },
                    exhaustion: { before: before.exhaustion, after: after.exhaustion, delta: effect.exhaustionDelta },
                    actionCount: { before: before.actionCountThisTurn, after: after.actionCountThisTurn, delta: effect.actionCountDelta },
                    debug: effect.debug
                }
            });
        }

        if (before.isExhausted !== after.isExhausted || before.currentState !== after.currentState) {
            nextState = api.appendSimulationEvent(nextState, {
                type: 'ExhaustionStateChanged',
                actorId,
                targetId: actorId,
                position: afterActor.position,
                payload: {
                    before: before.currentState,
                    after: after.currentState,
                    wasExhausted: before.isExhausted,
                    isExhausted: after.isExhausted,
                    exhaustion: after.exhaustion
                }
            });
        }

        nextState.runTelemetry = {
            ...(nextState.runTelemetry || {
                damageTaken: 0,
                healingReceived: 0,
                forcedDisplacementsTaken: 0,
                controlIncidents: 0,
                hazardDamageEvents: 0,
                sparkSpent: 0,
                sparkRecovered: 0,
                manaSpent: 0,
                manaRecovered: 0,
                exhaustionGained: 0,
                exhaustionCleared: 0,
                sparkBurnHpLost: 0,
                redlineActions: 0,
                exhaustedTurns: 0,
                sparkOutageBlocks: 0,
                manaOutageBlocks: 0,
                restTurns: 0,
                actionsTaken: 0
            }),
            sparkSpent: (nextState.runTelemetry?.sparkSpent || 0) + Math.max(0, -(effect.sparkDelta || 0)),
            sparkRecovered: (nextState.runTelemetry?.sparkRecovered || 0) + Math.max(0, effect.sparkDelta || 0),
            manaSpent: (nextState.runTelemetry?.manaSpent || 0) + Math.max(0, -(effect.manaDelta || 0)),
            manaRecovered: (nextState.runTelemetry?.manaRecovered || 0) + Math.max(0, effect.manaDelta || 0),
            exhaustionGained: (nextState.runTelemetry?.exhaustionGained || 0) + Math.max(0, effect.exhaustionDelta || 0),
            exhaustionCleared: (nextState.runTelemetry?.exhaustionCleared || 0) + Math.max(0, -(effect.exhaustionDelta || 0)),
            sparkBurnHpLost: (nextState.runTelemetry?.sparkBurnHpLost || 0) + Math.max(0, effect.debug?.sparkBurnHpDelta || 0),
            redlineActions: (nextState.runTelemetry?.redlineActions || 0) + ((effect.debug?.sparkBurnHpDelta || 0) > 0 ? 1 : 0),
            exhaustedTurns: (nextState.runTelemetry?.exhaustedTurns || 0) + (
                (effect.debug?.actionKind === 'rest' || effect.debug?.actionKind === 'end_turn')
                && after.isExhausted
                    ? 1
                    : 0
            ),
            restTurns: (nextState.runTelemetry?.restTurns || 0) + (effect.debug?.actionKind === 'rest' ? 1 : 0),
            actionsTaken: (nextState.runTelemetry?.actionsTaken || 0) + (effect.actionCountDelta > 0 ? effect.actionCountDelta : 0)
        };

        if ((effect.debug?.sparkBurnHpDelta || 0) > 0) {
            nextState = api.appendSimulationEvent(nextState, {
                type: 'SparkBurnTriggered',
                actorId,
                targetId: actorId,
                position: afterActor.position,
                payload: {
                    amount: effect.debug?.sparkBurnHpDelta || 0,
                    skillId: effect.debug?.skillId
                }
            });
        }

        if (effect.debug?.actionKind === 'rest') {
            nextState = api.appendSimulationEvent(nextState, {
                type: 'RestTriggered',
                actorId,
                targetId: actorId,
                position: afterActor.position,
                payload: {
                    sparkDelta: effect.sparkDelta,
                    manaDelta: effect.manaDelta,
                    exhaustionDelta: effect.exhaustionDelta
                }
            });
        }

        return nextState;
    }
};
