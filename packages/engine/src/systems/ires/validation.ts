import type { ActionResourcePreview, Actor, CombatPressureMode, GameState, SkillDefinition, SkillResourceProfile } from '../../types';
import { resolveIresRuleset } from './config';
import { resolveExhaustionTax, resolveEffectiveBfi, resolveWalkUnit } from './bfi';
import { resolveRuntimeSkillResourceProfile } from './skill-catalog';
import {
    computeManaRecoveryIfEndedNow,
    computeSparkBurnHp,
    computeSparkRecoveryIfEndedNow,
    ensureActorIres,
    resolveExhaustionState
} from './state';

export const MAX_IRES_ACTIONS_PER_TURN = 8;
export const MAX_IRES_SPARK_BURN_ACTIONS_PER_TURN = 1;

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const incrementsActionCount = (profile: SkillResourceProfile): boolean =>
    profile.countsAsAction || profile.countsAsMovement;

const resolveProjection = (
    actor: Actor,
    current: NonNullable<Actor['ires']>,
    sparkDelta: number,
    manaDelta: number,
    nextActionCount: number,
    config: ReturnType<typeof resolveIresRuleset>
): ActionResourcePreview['turnProjection'] => {
    const projected = resolveExhaustionState({
        ...current,
        spark: clamp(current.spark + sparkDelta, 0, current.maxSpark),
        mana: clamp(current.mana + manaDelta, 0, current.maxMana),
        exhaustion: 0
    }, config);

    return {
        spark: {
            current: current.spark,
            projected: projected.spark,
            delta: sparkDelta
        },
        mana: {
            current: current.mana,
            projected: projected.mana,
            delta: manaDelta
        },
        exhaustion: {
            current: current.exhaustion,
            projected: projected.exhaustion,
            delta: projected.exhaustion - current.exhaustion
        },
        sparkStateBefore: current.currentState,
        sparkStateAfter: projected.currentState,
        projectedSparkRecoveryIfEndedNow: computeSparkRecoveryIfEndedNow(actor, projected, config),
        stateAfter: projected.currentState,
        actionCountAfter: nextActionCount,
        wouldRest: false
    };
};

export const resolveIresActionPreview = (
    actor: Actor,
    skillId: string,
    profileInput?: SkillResourceProfile,
    ruleset?: GameState['ruleset'],
    mode: CombatPressureMode = 'battle',
    skillDefInput?: Pick<SkillDefinition, 'resourceProfile' | 'metabolicBandProfile'>
): ActionResourcePreview => {
    const config = resolveIresRuleset(ruleset);
    const hydrated = ensureActorIres(actor, config);
    const current = hydrated.ires!;
    const profile = resolveRuntimeSkillResourceProfile(
        skillId,
        skillDefInput || (profileInput ? { resourceProfile: profileInput } : undefined),
        ruleset
    );

    const actionCountIncrement = incrementsActionCount(profile) ? 1 : 0;
    const effectiveBfi = resolveEffectiveBfi(hydrated, ruleset);
    const tempoSparkCost = actionCountIncrement > 0
        ? resolveExhaustionTax(hydrated, current.actionCountThisTurn, ruleset)
        : 0;
    const walkUnit = resolveWalkUnit(hydrated, ruleset);
    const skillSparkSurcharge = Math.max(0, Math.round(walkUnit * Number(profile.sparkWalkScalar || 0)));
    const sparkCostTotal = tempoSparkCost + skillSparkSurcharge;
    const manaCost = Math.max(0, Number(profile.manaCost || 0));
    const nextActionCount = current.actionCountThisTurn + actionCountIncrement;
    const blockedReason = current.actionCountThisTurn >= MAX_IRES_ACTIONS_PER_TURN
        ? `Action cap reached (${MAX_IRES_ACTIONS_PER_TURN})`
        : undefined;

    let sparkDelta = 0;
    let manaDelta = 0;
    let sparkBurnHpDelta = 0;
    let sparkBurnOutcome: NonNullable<ActionResourcePreview['sparkBurnOutcome']> = 'none';
    let failure = blockedReason;

    if (!failure && sparkCostTotal > current.spark) {
        failure = `Spark outage: requires ${sparkCostTotal} SP`;
    }

    if (!failure && manaCost > current.mana) {
        failure = `Mana outage: requires ${manaCost} MP`;
    }

    if (!failure) {
        sparkDelta = -sparkCostTotal;
        manaDelta = -manaCost;
        const projectedAfterSpend = resolveExhaustionState({
            ...current,
            spark: clamp(current.spark + sparkDelta, 0, current.maxSpark),
            mana: clamp(current.mana + manaDelta, 0, current.maxMana),
            exhaustion: 0
        }, config);
        const taxingAction = actionCountIncrement > 0 && (tempoSparkCost > 0 || skillSparkSurcharge > 0 || manaCost > 0);

        if (taxingAction && current.currentState === 'exhausted') {
            if (mode === 'travel' && config.travelSuppressesSparkBurn) {
                sparkBurnOutcome = 'travel_suppressed';
            } else if (current.sparkBurnActionsThisTurn >= MAX_IRES_SPARK_BURN_ACTIONS_PER_TURN) {
                sparkBurnOutcome = 'burn_blocked_cap';
            } else {
                sparkBurnOutcome = 'burn_now';
                sparkBurnHpDelta = computeSparkBurnHp(hydrated, config);
            }
        } else if (taxingAction && current.currentState !== 'exhausted' && projectedAfterSpend.currentState === 'exhausted') {
            sparkBurnOutcome = 'enter_exhausted_free';
        }
    }

    const turnProjection = resolveProjection(
        hydrated,
        current,
        sparkDelta,
        manaDelta,
        nextActionCount,
        config
    );

    return {
        primaryResource: profile.primaryResource,
        primaryCost: profile.primaryResource === 'mana' ? manaCost : sparkCostTotal,
        sparkDelta,
        manaDelta,
        exhaustionDelta: turnProjection.exhaustion.delta,
        tempoSparkCost,
        skillSparkSurcharge,
        sparkCostTotal,
        manaCost,
        sparkBurnOutcome,
        sparkBurnHpDelta,
        tax: tempoSparkCost,
        effectiveBfi,
        nextActionCount,
        blockedReason: failure,
        bandAfter: turnProjection.stateAfter,
        modeBefore: mode,
        modeAfter: mode,
        travelRecoveryApplied: false,
        turnProjection
    };
};

export const resolveWaitPreview = (
    actor: Actor,
    ruleset?: GameState['ruleset'],
    mode: CombatPressureMode = 'battle'
): ActionResourcePreview => {
    const config = resolveIresRuleset(ruleset);
    const hydrated = ensureActorIres(actor, config);
    const current = hydrated.ires!;
    const isRest = !current.actedThisTurn && !current.movedThisTurn;
    const sparkDelta = computeSparkRecoveryIfEndedNow(hydrated, current, config);
    const manaDelta = computeManaRecoveryIfEndedNow(hydrated, current, config);
    const projected = resolveExhaustionState({
        ...current,
        spark: clamp(current.spark + sparkDelta, 0, current.maxSpark),
        mana: clamp(current.mana + manaDelta, 0, current.maxMana),
        exhaustion: 0
    }, config);

    return {
        primaryResource: 'none',
        primaryCost: 0,
        sparkDelta,
        manaDelta,
        exhaustionDelta: projected.exhaustion - current.exhaustion,
        tempoSparkCost: 0,
        skillSparkSurcharge: 0,
        sparkCostTotal: 0,
        manaCost: 0,
        sparkBurnOutcome: 'none',
        sparkBurnHpDelta: 0,
        tax: 0,
        effectiveBfi: resolveEffectiveBfi(hydrated, ruleset),
        nextActionCount: 0,
        bandAfter: projected.currentState,
        modeBefore: mode,
        modeAfter: mode,
        travelRecoveryApplied: false,
        turnProjection: {
            spark: { current: current.spark, projected: projected.spark, delta: sparkDelta },
            mana: { current: current.mana, projected: projected.mana, delta: manaDelta },
            exhaustion: {
                current: current.exhaustion,
                projected: projected.exhaustion,
                delta: projected.exhaustion - current.exhaustion
            },
            sparkStateBefore: current.currentState,
            sparkStateAfter: projected.currentState,
            projectedSparkRecoveryIfEndedNow: sparkDelta,
            stateAfter: projected.currentState,
            actionCountAfter: 0,
            wouldRest: isRest
        }
    };
};
