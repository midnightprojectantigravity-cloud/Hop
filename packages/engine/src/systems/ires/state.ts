import type {
    ActionResourcePreview,
    Actor,
    GameState,
    IresActorState,
    IresRulesetConfig,
    IresRuntimeState
} from '../../types';
import { resolveTrinityLevers } from '../combat/trinity-resolver';
import { extractTrinityStats } from '../combat/combat-calculator';
import { resolveIresRuleset, withResolvedIresRuleset } from './config';

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const roundUp = (value: number): number => Math.ceil(value);

const formulaValue = (
    formula: IresRulesetConfig['sparkPoolFormula'],
    actor: Actor
): number => {
    if (!formula) return 0;
    const trinity = extractTrinityStats(actor);
    const raw = Number(formula.base || 0)
        + (Number(formula.bodyScale || 0) * Number(trinity.body || 0))
        + (Number(formula.mindScale || 0) * Number(trinity.mind || 0))
        + (Number(formula.instinctScale || 0) * Number(trinity.instinct || 0));

    let rounded = raw;
    if (formula.rounding === 'floor') rounded = Math.floor(raw);
    if (formula.rounding === 'ceil') rounded = Math.ceil(raw);
    if (formula.rounding === 'round') rounded = Math.round(raw);

    return clamp(
        rounded,
        formula.min ?? Number.NEGATIVE_INFINITY,
        formula.max ?? Number.POSITIVE_INFINITY
    );
};

const resolveSparkRatio = (spark: number, maxSpark: number): number =>
    clamp(spark / Math.max(1, maxSpark), 0, 1);

const deriveCompatibilityExhaustion = (spark: number, maxSpark: number): number =>
    clamp(Math.round((1 - resolveSparkRatio(spark, maxSpark)) * 100), 0, 100);

const computeMaxSpark = (actor: Actor, config: IresRulesetConfig): number => {
    if (config.sparkPoolFormula) {
        return Math.max(1, Math.round(formulaValue(config.sparkPoolFormula, actor)));
    }
    const trinity = extractTrinityStats(actor);
    return Math.max(100, 100 + (2 * Number(trinity.body || 0)));
};

const computeMaxMana = (actor: Actor): number => {
    const trinity = extractTrinityStats(actor);
    return Math.max(12, Math.round(12 + (2.2 * Number(trinity.mind || 0))));
};

const computeBaseSparkRecovery = (
    actor: Actor,
    config: IresRulesetConfig,
    maxSpark: number
): number => {
    if (!config.sparkRecoveryFlatFormula || !config.sparkRecoveryPctFormula) {
        return config.sparkRecoveryPerTurn;
    }
    const flat = formulaValue(config.sparkRecoveryFlatFormula, actor);
    const pct = formulaValue(config.sparkRecoveryPctFormula, actor);
    return Math.max(0, Math.round(flat + (maxSpark * pct)));
};

const computeBaseManaRecovery = (actor: Actor, config: IresRulesetConfig): number => {
    if (config.manaRecoveryPerTurn > 0) return config.manaRecoveryPerTurn;
    const trinity = extractTrinityStats(actor);
    return Math.max(3, Math.round(3 + (0.45 * Number(trinity.mind || 0))));
};

const resolveStateMultiplier = (state: IresActorState, config: IresRulesetConfig): number => {
    const multipliers = config.sparkRecoveryStateMultipliers;
    if (!multipliers) return 1;
    return multipliers[state] ?? 1;
};

const resolveLegacyExhaustionSparkDelta = (
    current: IresRuntimeState,
    exhaustionDelta: number
): number => {
    if (!exhaustionDelta) return 0;
    const currentExhaustion = deriveCompatibilityExhaustion(current.spark, current.maxSpark);
    const targetExhaustion = clamp(currentExhaustion + exhaustionDelta, 0, 100);
    const targetSpark = Math.round(current.maxSpark * (1 - (targetExhaustion / 100)));
    return clamp(targetSpark, 0, current.maxSpark) - current.spark;
};

const resolveSparkState = (
    ires: IresRuntimeState,
    config: IresRulesetConfig
): IresRuntimeState => {
    const sparkRatio = resolveSparkRatio(ires.spark, ires.maxSpark);
    const previousState = ires.currentState || 'rested';
    const restedEnter = config.restedEnterSparkRatio ?? 0.8;
    const restedExitBelow = config.restedExitSparkBelow ?? 0.5;
    const exhaustedEnter = config.exhaustedEnterSparkRatio ?? 0.2;
    const exhaustedExitAbove = config.exhaustedExitSparkAbove ?? 0.5;

    let currentState: IresActorState = 'base';
    if (sparkRatio <= exhaustedEnter || (previousState === 'exhausted' && sparkRatio <= exhaustedExitAbove)) {
        currentState = 'exhausted';
    } else if (sparkRatio >= restedEnter || (previousState === 'rested' && sparkRatio >= restedExitBelow)) {
        currentState = 'rested';
    }

    return {
        ...ires,
        exhaustion: deriveCompatibilityExhaustion(ires.spark, ires.maxSpark),
        isExhausted: currentState === 'exhausted',
        currentState
    };
};

export const resolveExhaustionState = (
    ires: IresRuntimeState,
    config: IresRulesetConfig
): IresRuntimeState => resolveSparkState(ires, config);

export const createInitialIresState = (actor: Actor, config: IresRulesetConfig = resolveIresRuleset()): IresRuntimeState => {
    const maxSpark = computeMaxSpark(actor, config);
    const maxMana = computeMaxMana(actor);
    return resolveSparkState({
        spark: maxSpark,
        maxSpark,
        mana: maxMana,
        maxMana,
        exhaustion: 0,
        actionCountThisTurn: 0,
        sparkBurnActionsThisTurn: 0,
        actedThisTurn: false,
        movedThisTurn: false,
        isExhausted: false,
        currentState: 'rested',
        pendingRestedBonus: false,
        activeRestedCritBonusPct: 0
    }, config);
};

export const ensureActorIres = (actor: Actor, config: IresRulesetConfig = resolveIresRuleset()): Actor => {
    const initial = createInitialIresState(actor, config);
    const current = actor.ires;
    if (!current) {
        return { ...actor, ires: initial };
    }

    const next = resolveSparkState({
        ...initial,
        ...current,
        spark: clamp(Number(current.spark ?? initial.spark), 0, initial.maxSpark),
        maxSpark: initial.maxSpark,
        mana: clamp(Number(current.mana ?? initial.mana), 0, initial.maxMana),
        maxMana: initial.maxMana,
        exhaustion: 0,
        actionCountThisTurn: Math.max(0, Math.floor(Number(current.actionCountThisTurn || 0))),
        sparkBurnActionsThisTurn: Math.max(0, Math.floor(Number(current.sparkBurnActionsThisTurn || 0))),
        activeRestedCritBonusPct: Math.max(0, Number(current.activeRestedCritBonusPct || 0)),
        pendingRestedBonus: current.pendingRestedBonus === true
    }, config);

    return actor.ires === next ? actor : { ...actor, ires: next };
};

export const hydrateGameStateIres = (state: GameState): GameState => {
    const withRules = withResolvedIresRuleset(state);
    const config = resolveIresRuleset(withRules.ruleset);
    return {
        ...withRules,
        player: ensureActorIres(withRules.player, config),
        enemies: withRules.enemies.map(actor => ensureActorIres(actor, config)),
        companions: withRules.companions?.map(actor => ensureActorIres(actor, config))
    };
};

export const applyIresMutationToActor = (
    actor: Actor,
    mutation: {
        sparkDelta?: number;
        manaDelta?: number;
        exhaustionDelta?: number;
        actionCountDelta?: number;
        sparkBurnActionsThisTurnDelta?: number;
        movedThisTurn?: boolean;
        actedThisTurn?: boolean;
        pendingRestedBonus?: boolean;
        activeRestedCritBonusPct?: number;
        resetTurnFlags?: boolean;
    },
    config: IresRulesetConfig = resolveIresRuleset()
): Actor => {
    const hydrated = ensureActorIres(actor, config);
    const current = hydrated.ires as IresRuntimeState;
    const resetTurnFlags = mutation.resetTurnFlags === true;
    const legacySparkDelta = resolveLegacyExhaustionSparkDelta(current, Number(mutation.exhaustionDelta || 0));
    const next = resolveSparkState({
        ...current,
        spark: clamp(current.spark + Number(mutation.sparkDelta || 0) + legacySparkDelta, 0, current.maxSpark),
        mana: clamp(current.mana + Number(mutation.manaDelta || 0), 0, current.maxMana),
        exhaustion: 0,
        actionCountThisTurn: Math.max(0, current.actionCountThisTurn + Math.floor(Number(mutation.actionCountDelta || 0))),
        sparkBurnActionsThisTurn: Math.max(0, current.sparkBurnActionsThisTurn + Math.floor(Number(mutation.sparkBurnActionsThisTurnDelta || 0))),
        movedThisTurn: mutation.movedThisTurn === undefined
            ? current.movedThisTurn
            : resetTurnFlags
                ? mutation.movedThisTurn
                : (current.movedThisTurn || mutation.movedThisTurn),
        actedThisTurn: mutation.actedThisTurn === undefined
            ? current.actedThisTurn
            : resetTurnFlags
                ? mutation.actedThisTurn
                : (current.actedThisTurn || mutation.actedThisTurn),
        pendingRestedBonus: mutation.pendingRestedBonus === undefined ? current.pendingRestedBonus : mutation.pendingRestedBonus,
        activeRestedCritBonusPct: mutation.activeRestedCritBonusPct === undefined
            ? current.activeRestedCritBonusPct
            : Math.max(0, mutation.activeRestedCritBonusPct)
    }, config);

    return {
        ...hydrated,
        ires: next
    };
};

export const beginActorTurnIres = (actor: Actor, config: IresRulesetConfig = resolveIresRuleset()): Actor => {
    const hydrated = ensureActorIres(actor, config);
    return applyIresMutationToActor(hydrated, {
        actionCountDelta: -(hydrated.ires?.actionCountThisTurn || 0),
        sparkBurnActionsThisTurnDelta: -(hydrated.ires?.sparkBurnActionsThisTurn || 0),
        movedThisTurn: false,
        actedThisTurn: false,
        pendingRestedBonus: false,
        activeRestedCritBonusPct: hydrated.ires?.pendingRestedBonus ? config.restedCritBonusPct : 0,
        resetTurnFlags: true
    }, config);
};

export const computeSparkRecoveryIfEndedNow = (
    actor: Actor,
    ires: IresRuntimeState,
    config: IresRulesetConfig = resolveIresRuleset()
): number => {
    const baseRecovery = computeBaseSparkRecovery(actor, config, ires.maxSpark);
    return Math.max(0, Math.round(baseRecovery * resolveStateMultiplier(ires.currentState, config)));
};

export const computeManaRecoveryIfEndedNow = (
    actor: Actor,
    ires: IresRuntimeState,
    config: IresRulesetConfig = resolveIresRuleset()
): number => {
    void ires;
    return computeBaseManaRecovery(actor, config);
};

export const buildEndTurnIresMutation = (
    actor: Actor,
    config: IresRulesetConfig = resolveIresRuleset()
): {
    sparkDelta: number;
    manaDelta: number;
    exhaustionDelta: number;
    actionCountDelta: number;
    sparkBurnActionsThisTurnDelta: number;
    movedThisTurn: boolean;
    actedThisTurn: boolean;
    pendingRestedBonus: boolean;
    activeRestedCritBonusPct: number;
    isRest: boolean;
} => {
    const hydrated = ensureActorIres(actor, config);
    const current = hydrated.ires as IresRuntimeState;
    const isRest = !current.actedThisTurn && !current.movedThisTurn;
    const sparkDelta = computeSparkRecoveryIfEndedNow(hydrated, current, config);
    const manaDelta = computeManaRecoveryIfEndedNow(hydrated, current, config);
    const projected = resolveSparkState({
        ...current,
        spark: clamp(current.spark + sparkDelta, 0, current.maxSpark),
        mana: clamp(current.mana + manaDelta, 0, current.maxMana),
        exhaustion: 0
    }, config);

    return {
        sparkDelta,
        manaDelta,
        exhaustionDelta: 0,
        actionCountDelta: -current.actionCountThisTurn,
        sparkBurnActionsThisTurnDelta: -current.sparkBurnActionsThisTurn,
        movedThisTurn: false,
        actedThisTurn: false,
        pendingRestedBonus: isRest && projected.currentState === 'rested',
        activeRestedCritBonusPct: 0,
        isRest
    };
};

export const computeSparkBurnHp = (
    actor: Actor,
    config: IresRulesetConfig = resolveIresRuleset()
): number => {
    const levers = resolveTrinityLevers(extractTrinityStats(actor));
    return Math.max(1, roundUp(actor.maxHp * config.sparkBurnHpPct * (1 - levers.bodyMitigation)));
};

export const formatIresProjection = (
    actor: Actor,
    preview: Pick<ActionResourcePreview, 'sparkDelta' | 'manaDelta' | 'exhaustionDelta' | 'bandAfter' | 'nextActionCount'>
): IresRuntimeState => {
    const hydrated = ensureActorIres(actor);
    const current = hydrated.ires as IresRuntimeState;
    const legacySparkDelta = resolveLegacyExhaustionSparkDelta(current, Number(preview.exhaustionDelta || 0));
    const spark = clamp(current.spark + preview.sparkDelta + legacySparkDelta, 0, current.maxSpark);
    return {
        ...current,
        spark,
        mana: clamp(current.mana + preview.manaDelta, 0, current.maxMana),
        exhaustion: deriveCompatibilityExhaustion(spark, current.maxSpark),
        isExhausted: preview.bandAfter === 'exhausted',
        currentState: preview.bandAfter,
        actionCountThisTurn: preview.nextActionCount
    };
};
