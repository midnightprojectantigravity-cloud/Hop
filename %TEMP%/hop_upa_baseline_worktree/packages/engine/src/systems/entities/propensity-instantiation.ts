import type { Actor, GameState, Point } from '../../types';
import type {
    BaseUnitDefinition,
    CompiledBaseUnitBlueprint,
    DerivedStatDefinition,
    PropensityDefinition
} from '../../data/contracts';
import { compileBaseUnitBlueprint } from '../../data/contract-parser';
import { randomFromSeed } from '../rng';
import { deriveMaxHpFromTrinity, type TrinityStats } from '../combat/trinity-resolver';
import { createEntity } from './entity-factory';

export interface PropensityRollTraceEntry {
    key: string;
    method: PropensityDefinition['method'];
    value: number;
    counterBefore: number;
    counterAfter: number;
}

export interface PropensityInstantiationResult {
    actor: Actor;
    stats: Record<string, number>;
    trinity: TrinityStats;
    speed: number;
    mass: number;
    nextState: GameState;
    rollTrace: PropensityRollTraceEntry[];
}

export interface InstantiateActorOptions {
    actorId?: string;
    position: Point;
    subtype?: string;
    factionId?: string;
}

export interface PropensityRngCursor {
    rngSeed: string;
    rngCounter: number;
}

export interface PropensityInstantiationCursorResult {
    actor: Actor;
    stats: Record<string, number>;
    trinity: TrinityStats;
    speed: number;
    mass: number;
    nextCursor: PropensityRngCursor;
    rollTrace: PropensityRollTraceEntry[];
}

const roundValue = (value: number, mode: PropensityDefinition['round'] = 'none'): number => {
    if (mode === 'floor') return Math.floor(value);
    if (mode === 'round') return Math.round(value);
    if (mode === 'ceil') return Math.ceil(value);
    return value;
};

const clampValue = (value: number, clamp?: { min: number; max: number }): number => {
    if (!clamp) return value;
    return Math.max(clamp.min, Math.min(clamp.max, value));
};

const finalizeRoll = (raw: number, propensity: PropensityDefinition): number =>
    clampValue(roundValue(raw, propensity.round), propensity.clamp);

const rollFromPropensity = (
    propensity: PropensityDefinition,
    nextRandom: () => { value: number; before: number; after: number }
): { value: number; before: number; after: number; usedRng: boolean } => {
    if (propensity.method === 'fixed') {
        return { value: finalizeRoll(propensity.value, propensity), before: -1, after: -1, usedRng: false };
    }
    if (propensity.method === 'uniform_int') {
        const draw = nextRandom();
        const span = (propensity.max - propensity.min) + 1;
        const raw = propensity.min + (Math.floor(draw.value * span) % Math.max(1, span));
        return { value: finalizeRoll(raw, propensity), before: draw.before, after: draw.after, usedRng: true };
    }
    if (propensity.method === 'triangular_int') {
        const draw = nextRandom();
        const min = propensity.min;
        const mode = propensity.mode;
        const max = propensity.max;
        const f = (mode - min) / Math.max(1e-9, (max - min));
        const raw = draw.value < f
            ? min + Math.sqrt(draw.value * (max - min) * (mode - min))
            : max - Math.sqrt((1 - draw.value) * (max - min) * (max - mode));
        return { value: finalizeRoll(raw, propensity), before: draw.before, after: draw.after, usedRng: true };
    }
    const draw = nextRandom();
    const totalWeight = propensity.table.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = draw.value * Math.max(1e-9, totalWeight);
    let chosen = propensity.table[propensity.table.length - 1]!.value;
    for (const entry of propensity.table) {
        cursor -= entry.weight;
        if (cursor <= 0) {
            chosen = entry.value;
            break;
        }
    }
    return { value: finalizeRoll(chosen, propensity), before: draw.before, after: draw.after, usedRng: true };
};

const evalDerivedStat = (
    derived: DerivedStatDefinition,
    baseStats: Record<string, number>,
    trinity: TrinityStats
): number => {
    if (derived.formula === 'trinity_hp_v1') return deriveMaxHpFromTrinity(trinity);
    const base = derived.base ?? 0;
    const terms = derived.terms || [];
    const raw = terms.reduce((sum, term) => sum + ((baseStats[term.stat] ?? 0) * term.coefficient), base);
    const rounded = roundValue(raw, derived.round);
    return clampValue(rounded, derived.clamp);
};

const applyStartCooldowns = (
    actor: Actor,
    startCooldowns: Record<string, number> | undefined
): Actor => {
    if (!startCooldowns || Object.keys(startCooldowns).length === 0) return actor;
    return {
        ...actor,
        activeSkills: (actor.activeSkills || []).map(skill => {
            const cooldown = startCooldowns[skill.id];
            if (cooldown === undefined) return skill;
            return {
                ...skill,
                currentCooldown: Math.max(0, cooldown)
            };
        })
    };
};

const defaultActorId = (def: BaseUnitDefinition): string => def.id.toLowerCase();

export const instantiateActorFromBlueprintWithCursor = (
    cursor: PropensityRngCursor,
    blueprint: CompiledBaseUnitBlueprint,
    options: InstantiateActorOptions
): PropensityInstantiationCursorResult => {
    const def = blueprint.definition;
    const rollTrace: PropensityRollTraceEntry[] = [];
    let nextCursor = {
        rngSeed: cursor.rngSeed || 'default',
        rngCounter: Math.max(0, cursor.rngCounter || 0)
    };
    let statelessCounter = 0;
    const seedBase = `${nextCursor.rngSeed}:${def.instantiate.rngStream}:${def.instantiate.seedSalt || def.id}`;

    const nextRandom = (): { value: number; before: number; after: number } => {
        if (def.instantiate.counterMode === 'consume_global') {
            const before = nextCursor.rngCounter;
            const value = randomFromSeed(nextCursor.rngSeed, before);
            nextCursor = {
                ...nextCursor,
                rngCounter: before + 1
            };
            return { value, before, after: nextCursor.rngCounter };
        }
        const before = statelessCounter;
        const value = randomFromSeed(seedBase, statelessCounter++);
        return { value, before, after: statelessCounter };
    };

    const rolledStats: Record<string, number> = {};
    for (const key of blueprint.drawOrder) {
        const propensity = def.propensities[key];
        if (!propensity) continue;
        const rolled = rollFromPropensity(propensity, nextRandom);
        rolledStats[key] = rolled.value;
        if (rolled.usedRng) {
            rollTrace.push({
                key,
                method: propensity.method,
                value: rolled.value,
                counterBefore: rolled.before,
                counterAfter: rolled.after
            });
        }
    }

    const trinity: TrinityStats = {
        body: rolledStats.body ?? 0,
        mind: rolledStats.mind ?? 0,
        instinct: rolledStats.instinct ?? 0
    };

    const derivedStats = def.derivedStats || {};
    const maxHpFromDerived = derivedStats.maxHp
        ? evalDerivedStat(derivedStats.maxHp, rolledStats, trinity)
        : deriveMaxHpFromTrinity(trinity);

    const speed = rolledStats.speed ?? 1;
    const mass = rolledStats.mass ?? 1;

    const startingHp = def.runtimeDefaults?.startingHp === 'explicit'
        ? Math.max(0, def.runtimeDefaults.explicitHp ?? maxHpFromDerived)
        : maxHpFromDerived;

    const actorBase = createEntity({
        id: options.actorId || defaultActorId(def),
        type: def.actorType,
        subtype: options.subtype || def.subtype,
        position: options.position,
        hp: startingHp,
        maxHp: maxHpFromDerived,
        speed,
        factionId: options.factionId || def.factionId,
        weightClass: def.weightClass,
        skills: [...blueprint.skillIds, ...blueprint.passiveSkillIds],
        trinity
    });

    let actor: Actor = applyStartCooldowns(actorBase, def.skillLoadout.startCooldowns);
    if (def.runtimeDefaults?.temporaryArmor !== undefined) {
        actor = { ...actor, temporaryArmor: Math.max(0, def.runtimeDefaults.temporaryArmor) };
    }
    if (def.runtimeDefaults?.isVisible !== undefined) {
        actor = { ...actor, isVisible: def.runtimeDefaults.isVisible };
    }

    rolledStats.maxHp = maxHpFromDerived;
    rolledStats.speed = speed;
    rolledStats.mass = mass;
    for (const [key, derived] of Object.entries(derivedStats)) {
        if (key === 'maxHp') continue;
        rolledStats[key] = evalDerivedStat(derived, rolledStats, trinity);
    }

    return {
        actor,
        stats: rolledStats,
        trinity,
        speed,
        mass,
        nextCursor,
        rollTrace
    };
};

export const instantiateActorFromBlueprint = (
    state: GameState,
    blueprint: CompiledBaseUnitBlueprint,
    options: InstantiateActorOptions
): PropensityInstantiationResult => {
    const cursor: PropensityRngCursor = {
        rngSeed: state.rngSeed || 'default',
        rngCounter: state.rngCounter || 0
    };
    const coreResult = instantiateActorFromBlueprintWithCursor(cursor, blueprint, options);
    const usesGlobalCounter = blueprint.definition.instantiate.counterMode === 'consume_global';
    const nextState = usesGlobalCounter
        ? {
            ...state,
            rngCounter: coreResult.nextCursor.rngCounter
        }
        : state;

    return {
        actor: coreResult.actor,
        stats: coreResult.stats,
        trinity: coreResult.trinity,
        speed: coreResult.speed,
        mass: coreResult.mass,
        nextState,
        rollTrace: coreResult.rollTrace
    };
};

export const instantiateActorFromDefinition = (
    state: GameState,
    definition: BaseUnitDefinition,
    options: InstantiateActorOptions
): PropensityInstantiationResult => instantiateActorFromBlueprint(state, compileBaseUnitBlueprint(definition), options);

export const instantiateActorFromDefinitionWithCursor = (
    cursor: PropensityRngCursor,
    definition: BaseUnitDefinition,
    options: InstantiateActorOptions
): PropensityInstantiationCursorResult =>
    instantiateActorFromBlueprintWithCursor(cursor, compileBaseUnitBlueprint(definition), options);
