import type {
    CompositeAtomicEffectDefinition,
    CompositeSkillDefinition,
    CompositeSkillUpgradeDefinition,
    ScalarExpression
} from '../data/contracts';
import type { Actor, AtomicEffect, GameState, Point, SkillDefinition, SkillModifier } from '../types';
import { createHex, hexDistance, isHexInRectangularGrid } from '../hex';
import { getActorAt } from '../helpers';
import { validateLineOfSight } from './validation';
import { extractTrinityStats } from './combat/combat-calculator';
import { resolveForce } from './combat/force';

interface RuntimeScalarContext {
    body: number;
    mind: number;
    instinct: number;
    mass: number;
    speed: number;
    momentum: number;
}

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const applyRoundMode = (value: number, round: ScalarExpression['round']): number => {
    if (round === 'floor') return Math.floor(value);
    if (round === 'round') return Math.round(value);
    if (round === 'ceil') return Math.ceil(value);
    return value;
};

const evalScalar = (expr: ScalarExpression, ctx: RuntimeScalarContext): number => {
    let value = expr.base;
    for (const term of expr.scaling || []) value += (ctx[term.stat] ?? 0) * term.coefficient;
    value = applyRoundMode(value, expr.round);
    if (expr.min !== undefined) value = Math.max(expr.min, value);
    if (expr.max !== undefined) value = Math.min(expr.max, value);
    return value;
};

const setNestedNumber = (obj: Record<string, unknown>, fieldPath: string, mode: 'set' | 'add' | 'multiply', value: number): void => {
    const parts = fieldPath.split('.');
    let cursor: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i] as string;
        const current = cursor[part];
        if (!current || typeof current !== 'object') return;
        cursor = current as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1] as string;
    const current = Number(cursor[leaf]);
    if (!Number.isFinite(current)) return;
    if (mode === 'set') cursor[leaf] = value;
    if (mode === 'add') cursor[leaf] = current + value;
    if (mode === 'multiply') cursor[leaf] = current * value;
};

const materializeEffects = (
    def: CompositeSkillDefinition,
    activeUpgradeIds: string[],
    inhibitTags: Set<string>
): {
    effects: CompositeAtomicEffectDefinition[];
    reactions: CompositeSkillDefinition['reactivePassives'];
    keywords: Set<string>;
} => {
    let effects = deepClone(def.baseAction.effects);
    const reactions = deepClone(def.reactivePassives || []);
    const keywords = new Set(def.keywords);

    const upgradesById: Record<string, CompositeSkillUpgradeDefinition> = {};
    for (const upgrade of def.upgrades) upgradesById[upgrade.id] = upgrade;

    for (const upgradeId of activeUpgradeIds) {
        const upgrade = upgradesById[upgradeId];
        if (!upgrade) continue;
        for (const mod of upgrade.modifiers) {
            if (mod.op === 'add_effect') effects.push(deepClone(mod.effect));
            if (mod.op === 'remove_effect_by_tag') effects = effects.filter(e => !e.tags.includes(mod.tag));
            if (mod.op === 'modify_number') {
                const target = effects.find(e => e.id === mod.effectId) as unknown as Record<string, unknown> | undefined;
                if (target) setNestedNumber(target, mod.field, mod.mode, mod.value);
            }
            if (mod.op === 'add_keyword') keywords.add(mod.keyword);
            if (mod.op === 'remove_keyword') keywords.delete(mod.keyword);
            if (mod.op === 'add_reaction') reactions.push(deepClone(mod.reaction));
        }
    }

    if (def.inhibit?.filterMode === 'exclude_matching_tags' && inhibitTags.size > 0) {
        effects = effects.filter(effect => !effect.tags.some(tag => inhibitTags.has(tag)));
    }

    return { effects, reactions, keywords };
};

const buildScalarContext = (attacker: Actor, context?: Record<string, unknown>): RuntimeScalarContext => {
    const trinity = extractTrinityStats(attacker);
    const momentum = Number(context?.momentum ?? 0);
    const mass = Number(context?.mass ?? 1);
    return {
        body: trinity.body,
        mind: trinity.mind,
        instinct: trinity.instinct,
        mass: Number.isFinite(mass) ? mass : 1,
        speed: attacker.speed || 1,
        momentum: Number.isFinite(momentum) ? momentum : 0
    };
};

const resolveTargetActorId = (state: GameState, target?: Point): string | undefined => {
    if (!target) return undefined;
    const actor = getActorAt(state, target);
    return actor?.id;
};

const convertEffect = (
    state: GameState,
    attacker: Actor,
    target: Point | undefined,
    effect: CompositeAtomicEffectDefinition,
    scalarCtx: RuntimeScalarContext
): AtomicEffect[] => {
    if (effect.kind === 'MESSAGE') {
        return [{ type: 'Message', text: effect.text }];
    }
    if (effect.kind === 'DEAL_DAMAGE') {
        const amount = Math.max(0, Math.floor(evalScalar(effect.amount, scalarCtx)));
        const targetActorId = resolveTargetActorId(state, target);
        const effectTarget = effect.target.selector === 'targetActor'
            ? (targetActorId || 'targetActor')
            : (effect.target.selector === 'self' ? attacker.id : (target || 'targetActor'));
        return [{ type: 'Damage', target: effectTarget as any, amount, reason: effect.reason }];
    }
    if (effect.kind === 'APPLY_STATUS') {
        const targetActorId = resolveTargetActorId(state, target);
        const effectTarget = effect.target.selector === 'targetActor'
            ? (targetActorId || 'targetActor')
            : (effect.target.selector === 'self' ? attacker.id : (target || 'targetActor'));
        return [{ type: 'ApplyStatus', target: effectTarget as any, status: effect.statusId as any, duration: effect.duration }];
    }
    const targetActorId = resolveTargetActorId(state, target);
    if (!targetActorId) return [];
    const forceMagnitude = evalScalar(effect.force.magnitude, scalarCtx);
    const crushDamage = effect.force.collision.crushDamage
        ? evalScalar(effect.force.collision.crushDamage, scalarCtx)
        : 0;
    return resolveForce(state, {
        source: attacker.position,
        targetActorId,
        mode: effect.force.mode,
        magnitude: forceMagnitude,
        maxDistance: effect.force.maxDistance,
        collision: {
            onBlocked: effect.force.collision.onBlocked,
            crushDamage
        }
    }).effects;
};

const getSortedTargets = (state: GameState, origin: Point, range: number, sortMode: CompositeSkillDefinition['targeting']['deterministicSort']): Point[] => {
    const points: Point[] = [];
    for (let q = 0; q < state.gridWidth; q++) {
        for (let r = 0; r < state.gridHeight; r++) {
            const hex = createHex(q, r);
            if (!isHexInRectangularGrid(hex, state.gridWidth, state.gridHeight)) continue;
            if (hexDistance(origin, hex) <= range) points.push(hex);
        }
    }
    points.sort((a, b) => {
        if (sortMode === 'q_then_r') return a.q === b.q ? a.r - b.r : a.q - b.q;
        if (sortMode === 'r_then_q') return a.r === b.r ? a.q - b.q : a.r - b.r;
        const da = hexDistance(origin, a);
        const db = hexDistance(origin, b);
        if (da !== db) return da - db;
        return a.q === b.q ? a.r - b.r : a.q - b.q;
    });
    return points;
};

export const materializeCompositeSkill = (def: CompositeSkillDefinition): SkillDefinition => {
    const damageBase = def.baseAction.effects.find(e => e.kind === 'DEAL_DAMAGE') as any;
    const momentumBase = def.baseAction.effects.find(e => e.kind === 'APPLY_FORCE') as any;
    const upgrades: Record<string, SkillModifier> = {};
    def.upgrades.forEach(upgrade => {
        upgrades[upgrade.id] = {
            id: upgrade.id,
            name: upgrade.name,
            description: upgrade.description || upgrade.name
        };
    });

    return {
        id: def.id as any,
        name: def.name,
        description: def.description || def.name,
        slot: def.slot,
        icon: 'data-driven',
        baseVariables: {
            range: def.targeting.range,
            cost: def.baseAction.costs.energy,
            cooldown: def.baseAction.costs.cooldown,
            damage: damageBase?.amount?.base,
            momentum: momentumBase?.force?.magnitude?.base
        },
        execute: (state: GameState, attacker: Actor, target?: Point, activeUpgrades: string[] = [], context: Record<string, unknown> = {}) => {
            const inhibitTags = new Set<string>((context.inhibitTags as string[] | undefined) || []);
            const materialized = materializeEffects(def, activeUpgrades, inhibitTags);
            const scalarCtx = buildScalarContext(attacker, context);
            const declareReactions = (materialized.reactions || [])
                .filter(reaction => reaction.trigger === 'ON_DECLARE')
                .flatMap(reaction => reaction.effects);
            const effectStream = [...declareReactions, ...materialized.effects];
            const effects: AtomicEffect[] = [];
            for (const effect of effectStream) {
                effects.push(...convertEffect(state, attacker, target, effect, scalarCtx));
            }
            return {
                effects,
                messages: [],
                consumesTurn: def.baseAction.costs.consumesTurn
            };
        },
        getValidTargets: (state: GameState, origin: Point) => {
            if (def.targeting.mode === 'self') return [origin];
            let targets = getSortedTargets(state, origin, def.targeting.range, def.targeting.deterministicSort);
            if (def.targeting.mode === 'single' || def.targeting.mode === 'radius' || def.targeting.mode === 'line') {
                if (def.targeting.requiresLos) {
                    targets = targets.filter(target => validateLineOfSight(state, origin, target).isValid);
                }
                if (!def.targeting.allowOccupied) {
                    targets = targets.filter(target => !getActorAt(state, target));
                }
                return targets;
            }
            return targets;
        },
        upgrades
    };
};
