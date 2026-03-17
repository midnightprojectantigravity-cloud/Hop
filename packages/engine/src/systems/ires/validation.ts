import type { ActionResourcePreview, Actor, CombatPressureMode, GameState, SkillDefinition, SkillResourceProfile } from '../../types';
import { resolveIresRuleset } from './config';
import { resolveExhaustionTax, resolveEffectiveBfi, resolveIresWeightModifier } from './bfi';
import { resolveRuntimeSkillResourceProfile } from './skill-catalog';
import { computeSparkBurnHp, ensureActorIres, resolveExhaustionState } from './state';

export const MAX_IRES_ACTIONS_PER_TURN = 8;
export const MAX_IRES_SPARK_BURN_ACTIONS_PER_TURN = 1;

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const incrementsActionCount = (profile: SkillResourceProfile): boolean =>
    profile.countsAsAction || profile.countsAsMovement;

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
    const weight = resolveIresWeightModifier(hydrated.weightClass);
    const costAdjustment = profile.primaryResource === 'spark' && profile.countsAsMovement
        ? weight.movementSpark
        : 0;
    const primaryCost = Math.max(0, profile.primaryCost + costAdjustment);
    const actionCountIncrement = incrementsActionCount(profile) ? 1 : 0;
    const tax = actionCountIncrement > 0
        ? resolveExhaustionTax(hydrated, current.actionCountThisTurn)
        : 0;
    const exhaustionDelta = actionCountIncrement > 0 ? profile.baseStrain + tax : 0;
    const effectiveBfi = resolveEffectiveBfi(hydrated);
    const nextActionCount = current.actionCountThisTurn + actionCountIncrement;
    const blockedReason = current.actionCountThisTurn >= MAX_IRES_ACTIONS_PER_TURN
        ? `Action cap reached (${MAX_IRES_ACTIONS_PER_TURN})`
        : undefined;

    let sparkDelta = 0;
    let manaDelta = 0;
    let sparkBurnHpDelta = 0;
    let failure = blockedReason;

    if (!failure && profile.primaryResource === 'spark' && primaryCost > 0) {
        if (current.isExhausted) {
            if (current.sparkBurnActionsThisTurn >= MAX_IRES_SPARK_BURN_ACTIONS_PER_TURN) {
                failure = `Spark Burn action cap reached (${MAX_IRES_SPARK_BURN_ACTIONS_PER_TURN})`;
            } else {
                sparkBurnHpDelta = computeSparkBurnHp(hydrated, config);
            }
        } else if (current.spark < primaryCost) {
            failure = `Spark outage: requires ${primaryCost} SP`;
        } else {
            sparkDelta = -primaryCost;
        }
    }

    if (!failure && profile.primaryResource === 'mana' && primaryCost > 0) {
        if (current.mana < primaryCost) {
            failure = `Mana outage: requires ${primaryCost} MP`;
        } else {
            manaDelta = -primaryCost;
        }
    }

    const projected = resolveExhaustionState({
        ...current,
        spark: clamp(current.spark + sparkDelta, 0, current.maxSpark),
        mana: clamp(current.mana + manaDelta, 0, current.maxMana),
        exhaustion: clamp(current.exhaustion + exhaustionDelta, 0, 100)
    }, config);

    return {
        primaryResource: profile.primaryResource,
        primaryCost,
        sparkDelta,
        manaDelta,
        exhaustionDelta,
        sparkBurnHpDelta,
        tax,
        effectiveBfi,
        nextActionCount,
        blockedReason: failure,
        bandAfter: projected.currentState,
        modeBefore: mode,
        modeAfter: mode,
        travelRecoveryApplied: false,
        turnProjection: {
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
                delta: exhaustionDelta
            },
            stateAfter: projected.currentState,
            actionCountAfter: nextActionCount,
            wouldRest: false
        }
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
    const sparkDelta = current.isExhausted ? 0 : config.sparkRecoveryPerTurn;
    const manaDelta = config.manaRecoveryPerTurn;
    const exhaustionDelta = isRest ? -config.restExhaustionClear : 0;
    const projected = resolveExhaustionState({
        ...current,
        spark: clamp(current.spark + sparkDelta, 0, current.maxSpark),
        mana: clamp(current.mana + manaDelta, 0, current.maxMana),
        exhaustion: clamp(current.exhaustion + exhaustionDelta, 0, 100)
    }, config);

    return {
        primaryResource: 'none',
        primaryCost: 0,
        sparkDelta,
        manaDelta,
        exhaustionDelta,
        sparkBurnHpDelta: 0,
        tax: 0,
        effectiveBfi: resolveEffectiveBfi(hydrated),
        nextActionCount: 0,
        bandAfter: projected.currentState,
        modeBefore: mode,
        modeAfter: mode,
        travelRecoveryApplied: false,
        turnProjection: {
            spark: { current: current.spark, projected: projected.spark, delta: sparkDelta },
            mana: { current: current.mana, projected: projected.mana, delta: manaDelta },
            exhaustion: { current: current.exhaustion, projected: projected.exhaustion, delta: exhaustionDelta },
            stateAfter: projected.currentState,
            actionCountAfter: 0,
            wouldRest: isRest
        }
    };
};
