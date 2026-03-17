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

export const resolveExhaustionState = (
    ires: IresRuntimeState,
    config: IresRulesetConfig
): IresRuntimeState => {
    let isExhausted = ires.isExhausted;
    if (!isExhausted && ires.exhaustion >= config.enterExhaustedAt) {
        isExhausted = true;
    } else if (isExhausted && ires.exhaustion < config.exitExhaustedBelow) {
        isExhausted = false;
    }

    const currentState: IresActorState = isExhausted
        ? 'exhausted'
        : ires.exhaustion === 0
            ? 'rested'
            : 'base';

    return {
        ...ires,
        isExhausted,
        currentState
    };
};

export const createInitialIresState = (actor: Actor, config: IresRulesetConfig = resolveIresRuleset()): IresRuntimeState => {
    const trinity = extractTrinityStats(actor);
    const maxSpark = Math.max(100, 100 + (2 * Number(trinity.body || 0)));
    const maxMana = Math.max(10, Math.ceil(Number(trinity.mind || 0) * 2));
    return resolveExhaustionState({
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

    const next = resolveExhaustionState({
        ...initial,
        ...current,
        spark: clamp(Number(current.spark ?? initial.spark), 0, initial.maxSpark),
        maxSpark: initial.maxSpark,
        mana: clamp(Number(current.mana ?? initial.mana), 0, initial.maxMana),
        maxMana: initial.maxMana,
        exhaustion: clamp(Number(current.exhaustion ?? initial.exhaustion), 0, 100),
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
    const next = resolveExhaustionState({
        ...current,
        spark: clamp(current.spark + Number(mutation.sparkDelta || 0), 0, current.maxSpark),
        mana: clamp(current.mana + Number(mutation.manaDelta || 0), 0, current.maxMana),
        exhaustion: clamp(current.exhaustion + Number(mutation.exhaustionDelta || 0), 0, 100),
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
    const bonus = hydrated.ires?.pendingRestedBonus ? config.restedSparkBonus : 0;
    return applyIresMutationToActor(hydrated, {
        sparkDelta: bonus,
        actionCountDelta: -(hydrated.ires?.actionCountThisTurn || 0),
        sparkBurnActionsThisTurnDelta: -(hydrated.ires?.sparkBurnActionsThisTurn || 0),
        movedThisTurn: false,
        actedThisTurn: false,
        pendingRestedBonus: false,
        activeRestedCritBonusPct: hydrated.ires?.pendingRestedBonus ? config.restedCritBonusPct : 0,
        resetTurnFlags: true
    }, config);
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
        sparkDelta,
        manaDelta,
        exhaustionDelta,
        actionCountDelta: -current.actionCountThisTurn,
        sparkBurnActionsThisTurnDelta: -current.sparkBurnActionsThisTurn,
        movedThisTurn: false,
        actedThisTurn: false,
        pendingRestedBonus: projected.exhaustion === 0,
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
    return {
        ...current,
        spark: clamp(current.spark + preview.sparkDelta, 0, current.maxSpark),
        mana: clamp(current.mana + preview.manaDelta, 0, current.maxMana),
        exhaustion: clamp(current.exhaustion + preview.exhaustionDelta, 0, 100),
        currentState: preview.bandAfter,
        actionCountThisTurn: preview.nextActionCount
    };
};
