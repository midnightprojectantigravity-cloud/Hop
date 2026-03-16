import type {
    IresMetabolicConfig,
    MetabolicActionClass,
    MetabolicActionClassId,
    MetabolicCadenceResult,
    MetabolicPrimaryResource,
    MetabolicSimulationState,
    MetabolicStatProfile,
    MetabolicWorkload
} from './metabolic-types';
import {
    resolveMetabolicActionProfile,
    resolveMetabolicPrimaryResource
} from './metabolic-action-catalog';
import { resolveMetabolicDerivedStats } from './metabolic-formulas';
import { resolveMetabolicTax } from './metabolic-tax-ladder';
import { createInitialMetabolicState, resolveMetabolicState, withResolvedMetabolicState } from './metabolic-state';

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const round3 = (value: number): number => Number(value.toFixed(3));

const averageGap = (turns: number[]): number | null => {
    if (turns.length <= 1) return null;
    const gaps = turns.slice(1).map((turn, index) => turn - turns[index]!);
    return round3(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
};

interface ResolvedBeatActionCost {
    sparkCost: number;
    manaCost: number;
    baseExhaustion: number;
    primaryResource: MetabolicPrimaryResource;
}

interface ResolvedBeatOutcome {
    state: MetabolicSimulationState;
    actionsExecuted: MetabolicActionClassId[];
    beatEventCount: number;
    immediateBurnTriggered: boolean;
    sparkSpentOnMovement: number;
    sparkSpentOnNonMovement: number;
    manaSpent: number;
    failureMode: 'spark' | 'mana' | 'exhaustion' | 'none';
}

const isRestBeat = (
    actions: MetabolicActionClassId[],
    actionCatalog: IresMetabolicConfig['actionCatalog']
): boolean => actions.length === 0 || actions.every((actionId) => actionCatalog[actionId]?.kind === 'rest');

const resolveActionCosts = (
    action: MetabolicActionClass,
    config: IresMetabolicConfig,
    profile: MetabolicStatProfile,
    sparkEfficiencyMultiplier: number
): ResolvedBeatActionCost => {
    const baseProfile = resolveMetabolicActionProfile(config, action);
    let sparkCost = 0;
    let manaCost = 0;

    if (action.resourceMode === 'spark_only' || action.resourceMode === 'hybrid') {
        sparkCost = Math.max(0, Math.round(baseProfile.sparkCost * sparkEfficiencyMultiplier));
        if (action.countsAsMovement) {
            sparkCost = Math.max(0, sparkCost + config.weightMovementSparkAdjustments[profile.weightClass]);
        }
    }
    if (action.resourceMode === 'mana_only' || action.resourceMode === 'hybrid') {
        manaCost = Math.max(0, baseProfile.manaCost);
    }

    return {
        sparkCost,
        manaCost,
        baseExhaustion: baseProfile.baseExhaustion,
        primaryResource: resolveMetabolicPrimaryResource(action)
    };
};

const resolveTravelOverlay = (
    state: MetabolicSimulationState,
    config: IresMetabolicConfig,
    actionsExecuted: MetabolicActionClassId[],
    actionCatalog: IresMetabolicConfig['actionCatalog'],
    mode: MetabolicWorkload['mode']
): MetabolicSimulationState => {
    if (!config.travelMode.enabled || mode !== 'travel' || actionsExecuted.length === 0) {
        return state;
    }
    const eligible = actionsExecuted.every((actionId) => {
        const action = actionCatalog[actionId];
        return action?.countsAsMovement && !action?.countsAsAction && action?.travelEligible;
    });
    if (config.travelMode.movementOnly && !eligible) {
        return state;
    }
    return {
        ...state,
        spark: clamp(state.spark + config.travelMode.sparkRecovery, 0, state.maxSpark),
        mana: clamp(state.mana + config.travelMode.manaRecovery, 0, state.maxMana),
        exhaustion: clamp(state.exhaustion - config.travelMode.exhaustionClear, 0, 100)
    };
};

const resolveBeatOutcome = ({
    state,
    actions,
    config,
    profile,
    workloadMode,
    restedBeat
}: {
    state: MetabolicSimulationState;
    actions: MetabolicActionClassId[];
    config: IresMetabolicConfig;
    profile: MetabolicStatProfile;
    workloadMode: MetabolicWorkload['mode'];
    restedBeat: boolean;
}): ResolvedBeatOutcome => {
    const derived = resolveMetabolicDerivedStats(config, profile);
    let nextState: MetabolicSimulationState = { ...state };
    let beatEventOrdinal = 0;
    let beatEventCount = 0;
    let immediateBurnTriggered = false;
    let sparkSpentOnMovement = 0;
    let sparkSpentOnNonMovement = 0;
    let manaSpent = 0;

    const actionsExecuted: MetabolicActionClassId[] = [];

    for (const actionId of actions) {
        const action = config.actionCatalog[actionId];
        if (!action) continue;

        const costs = resolveActionCosts(action, config, profile, derived.sparkEfficiencyMultiplier);
        if (costs.sparkCost > nextState.spark) {
            return {
                state: nextState,
                actionsExecuted,
                beatEventCount,
                immediateBurnTriggered,
                sparkSpentOnMovement,
                sparkSpentOnNonMovement,
                manaSpent,
                failureMode: 'spark'
            };
        }
        if (costs.manaCost > nextState.mana) {
            return {
                state: nextState,
                actionsExecuted,
                beatEventCount,
                immediateBurnTriggered,
                sparkSpentOnMovement,
                sparkSpentOnNonMovement,
                manaSpent,
                failureMode: 'mana'
            };
        }

        nextState.spark = clamp(nextState.spark - costs.sparkCost, 0, nextState.maxSpark);
        nextState.mana = clamp(nextState.mana - costs.manaCost, 0, nextState.maxMana);
        if (costs.sparkCost > 0) {
            if (action.countsAsMovement) {
                sparkSpentOnMovement += costs.sparkCost;
            } else {
                sparkSpentOnNonMovement += costs.sparkCost;
            }
        }
        manaSpent += costs.manaCost;

        const tax = action.beatEventDelta > 0 || action.countsAsMovement || action.countsAsAction
            ? resolveMetabolicTax(config.metabolicTaxLadder, derived.effectiveBfi, beatEventOrdinal)
            : 0;
        const beforeExhaustion = nextState.exhaustion;
        nextState.exhaustion = clamp(nextState.exhaustion + costs.baseExhaustion + tax, 0, 100);

        if (
            config.immediateBurnOnRedlineCross.enabled
            && beatEventOrdinal >= config.immediateBurnOnRedlineCross.minActionIndex
            && beforeExhaustion < config.enterExhaustedAt
            && nextState.exhaustion >= config.enterExhaustedAt
            && costs.primaryResource !== 'none'
            && config.immediateBurnOnRedlineCross.resources.includes(costs.primaryResource as 'spark' | 'mana')
        ) {
            immediateBurnTriggered = true;
        }

        const resolvedAfterAction = resolveMetabolicState(nextState.exhaustion, nextState.isExhausted, config);
        nextState = {
            ...nextState,
            ...resolvedAfterAction
        };

        actionsExecuted.push(actionId);
        beatEventCount += action.beatEventDelta;
        beatEventOrdinal += action.beatEventDelta;
    }

    nextState = withResolvedMetabolicState(nextState, config);
    nextState.spark = clamp(nextState.spark + derived.sparkRecoveryPerTurn, 0, nextState.maxSpark);
    nextState.mana = clamp(nextState.mana + derived.manaRecoveryPerTurn, 0, nextState.maxMana);
    nextState.exhaustion = clamp(
        nextState.exhaustion - derived.exhaustionBleedByState[nextState.currentState],
        0,
        100
    );

    if (restedBeat) {
        nextState.spark = clamp(nextState.spark + config.waitSparkBonus, 0, nextState.maxSpark);
        nextState.exhaustion = clamp(nextState.exhaustion - config.waitExhaustionBonus, 0, 100);
    }

    nextState = resolveTravelOverlay(nextState, config, actionsExecuted, config.actionCatalog, workloadMode);
    nextState = withResolvedMetabolicState(nextState, config);

    return {
        state: nextState,
        actionsExecuted,
        beatEventCount,
        immediateBurnTriggered,
        sparkSpentOnMovement,
        sparkSpentOnNonMovement,
        manaSpent,
        failureMode: 'none'
    };
};

const projectWorkloadBeat = (
    state: MetabolicSimulationState,
    config: IresMetabolicConfig,
    profile: MetabolicStatProfile,
    workload: MetabolicWorkload,
    actions: MetabolicActionClassId[]
): { shouldRest: boolean; failureMode: 'spark' | 'mana' | 'exhaustion' | 'none' } => {
    const projected = resolveBeatOutcome({
        state,
        actions,
        config,
        profile,
        workloadMode: workload.mode,
        restedBeat: false
    });

    if (projected.failureMode !== 'none') {
        return { shouldRest: true, failureMode: projected.failureMode };
    }
    if (projected.state.exhaustion > workload.restRule.maxProjectedExhaustionBeforeRest) {
        return { shouldRest: true, failureMode: 'exhaustion' };
    }
    if (state.isExhausted && projected.state.exhaustion >= state.exhaustion) {
        return { shouldRest: true, failureMode: 'exhaustion' };
    }
    if (projected.state.spark < workload.restRule.minSparkBeforeRest) {
        return { shouldRest: true, failureMode: 'spark' };
    }
    if (projected.state.mana < workload.restRule.minManaBeforeRest) {
        return { shouldRest: true, failureMode: 'mana' };
    }
    return { shouldRest: false, failureMode: 'none' };
};

export const simulateMetabolicWorkload = ({
    config,
    profile,
    workload,
    turnLimit = 12
}: {
    config: IresMetabolicConfig;
    profile: MetabolicStatProfile;
    workload: MetabolicWorkload;
    turnLimit?: number;
}): MetabolicCadenceResult => {
    let state = createInitialMetabolicState(config, profile);

    const actionsPerTurn: number[] = [];
    const restTurns: number[] = [];
    const bonusTurns: number[] = [];
    const sparkRemainingTurnByTurn: number[] = [];
    const manaRemainingTurnByTurn: number[] = [];
    const exhaustionTurnByTurn: number[] = [];
    const stateTurnByTurn: MetabolicCadenceResult['stateTurnByTurn'] = [];
    const turnTrace: MetabolicCadenceResult['turnTrace'] = [];

    let sparkSpentOnMovementOpening5 = 0;
    let sparkSpentOnNonMovementOpening5 = 0;
    let manaSpentOpening5 = 0;
    let peakExhaustionOpening5 = 0;
    let enteredExhaustedByTurn5 = false;
    let firstFailureMode: MetabolicCadenceResult['firstFailureMode'] = 'none';
    let firstImmediateBurnTurn: number | null = null;

    for (let turn = 1; turn <= turnLimit; turn += 1) {
        const workloadTurnIndex = workload.repeat
            ? (turn - 1) % workload.turns.length
            : Math.min(turn - 1, workload.turns.length - 1);
        const plannedActions = workload.turns[workloadTurnIndex]?.actions || [];
        const explicitRestBeat = isRestBeat(plannedActions, config.actionCatalog);
        const projection = explicitRestBeat
            ? { shouldRest: true, failureMode: 'none' as const }
            : projectWorkloadBeat(state, config, profile, workload, plannedActions);

        const restedBeat = explicitRestBeat || projection.shouldRest;
        if (firstFailureMode === 'none' && projection.failureMode !== 'none') {
            firstFailureMode = projection.failureMode;
        }
        if (restedBeat) {
            restTurns.push(turn);
        }

        const beatOutcome = resolveBeatOutcome({
            state,
            actions: restedBeat ? ['rest'] : plannedActions,
            config,
            profile,
            workloadMode: workload.mode,
            restedBeat
        });

        state = beatOutcome.state;

        if (turn <= 5) {
            sparkSpentOnMovementOpening5 += beatOutcome.sparkSpentOnMovement;
            sparkSpentOnNonMovementOpening5 += beatOutcome.sparkSpentOnNonMovement;
            manaSpentOpening5 += beatOutcome.manaSpent;
            peakExhaustionOpening5 = Math.max(peakExhaustionOpening5, state.exhaustion);
            enteredExhaustedByTurn5 = enteredExhaustedByTurn5 || state.currentState === 'exhausted';
        }
        if (beatOutcome.immediateBurnTriggered && firstImmediateBurnTurn === null) {
            firstImmediateBurnTurn = turn;
        }
        if (beatOutcome.beatEventCount > 1) {
            bonusTurns.push(turn);
        }

        actionsPerTurn.push(beatOutcome.beatEventCount);
        sparkRemainingTurnByTurn.push(state.spark);
        manaRemainingTurnByTurn.push(state.mana);
        exhaustionTurnByTurn.push(state.exhaustion);
        stateTurnByTurn.push(state.currentState);
        turnTrace.push({
            turn,
            workloadTurnIndex,
            mode: workload.mode,
            actionsPlanned: restedBeat ? ['rest'] : plannedActions,
            actionsExecuted: restedBeat ? ['rest'] : beatOutcome.actionsExecuted,
            rested: restedBeat,
            state: state.currentState,
            spark: state.spark,
            mana: state.mana,
            exhaustion: state.exhaustion,
            immediateBurnTriggered: beatOutcome.immediateBurnTriggered
        });
    }

    const opening3 = actionsPerTurn.slice(0, 3);
    const opening5 = actionsPerTurn.slice(0, 5);
    const totalSparkSpentOpening5 = sparkSpentOnMovementOpening5 + sparkSpentOnNonMovementOpening5;

    return {
        profileId: profile.id,
        workloadId: workload.id,
        turnsSimulated: turnLimit,
        avgActionsPerTurnOpening3: round3(opening3.reduce((sum, value) => sum + value, 0) / Math.max(1, opening3.length)),
        avgActionsPerTurnOpening5: round3(opening5.reduce((sum, value) => sum + value, 0) / Math.max(1, opening5.length)),
        firstRestTurn: restTurns[0] ?? null,
        avgTurnsBetweenRests: averageGap(restTurns),
        avgTurnsBetweenBonusActions: averageGap(bonusTurns),
        peakExhaustionOpening5: round3(peakExhaustionOpening5),
        enteredExhaustedByTurn5,
        firstImmediateBurnTurn,
        firstFailureMode,
        sparkSpentOnMovementOpening5,
        sparkSpentOnNonMovementOpening5,
        manaSpentOpening5,
        movementShareOfSparkSpend: totalSparkSpentOpening5 > 0
            ? round3(sparkSpentOnMovementOpening5 / totalSparkSpentOpening5)
            : 0,
        sparkRemainingTurnByTurn,
        manaRemainingTurnByTurn,
        exhaustionTurnByTurn,
        stateTurnByTurn,
        turnTrace
    };
};
