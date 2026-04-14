import type {
    CompositeAtomicEffectDefinition,
    CompositeSkillDefinition,
    CompositeSkillUpgradeDefinition,
    ScalarExpression
} from '../data/contracts';
import type {
    Actor,
    AtomicEffect,
    AtomicStackReactionHooks,
    AtomicStackReactionItem,
    GameState,
    Point,
    SkillDefinition,
    SkillExecutionResult,
    SkillModifier
} from '../types';
import { createHex, hexDistance, isHexInRectangularGrid } from '../hex';
import { getActorAt } from '../helpers';
import { validateLineOfSight } from './validation';
import { extractTrinityStats } from './combat/combat-calculator';
import { createDamageEffectFromCombat, resolveSkillCombatDamage } from './combat/combat-effect';
import { resolveForce } from './combat/force';
import { resolveActorForceScalars } from './combat/force-scalars';
import { normalizeCombatDamageTaxonomy } from './combat/damage-taxonomy';
import type { UpgradeModifier } from '../data/contracts';

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
    const scale = Number.isFinite(expr.coefficientScale) && Number(expr.coefficientScale || 0) > 0
        ? Number(expr.coefficientScale)
        : 1;
    let value = Number.isFinite(expr.scaledBase) ? Number(expr.scaledBase) / scale : Number(expr.base || 0);
    for (const term of expr.scaling || []) {
        const coefficient = Number.isFinite(term.scaledCoefficient)
            ? Number(term.scaledCoefficient) / scale
            : Number(term.coefficient || 0);
        value += (ctx[term.stat] ?? 0) * coefficient;
    }
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
    const derivedForce = resolveActorForceScalars(attacker);
    const momentum = Number(context?.momentum ?? derivedForce.momentum);
    const mass = Number(context?.mass ?? derivedForce.mass);
    const speed = Number(context?.speed ?? derivedForce.velocity);
    return {
        body: trinity.body,
        mind: trinity.mind,
        instinct: trinity.instinct,
        mass: Number.isFinite(mass) ? mass : derivedForce.mass,
        speed: Number.isFinite(speed) ? speed : derivedForce.velocity,
        momentum: Number.isFinite(momentum) ? momentum : 0
    };
};

const resolveAttackProfileFromSubClass = (damageSubClass: string | undefined): 'melee' | 'projectile' | 'spell' | 'status' => {
    if (damageSubClass === 'shot' || damageSubClass === 'piercing') return 'projectile';
    if (damageSubClass === 'blast' || damageSubClass === 'spell') return 'spell';
    if (damageSubClass === 'status') return 'status';
    return 'melee';
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
    scalarCtx: RuntimeScalarContext,
    skillId: string
): AtomicEffect[] => {
    if (effect.kind === 'MESSAGE') {
        return [{ type: 'Message', text: effect.text }];
    }
    if (effect.kind === 'DEAL_DAMAGE') {
        const amount = Math.max(0, Math.floor(evalScalar(effect.amount, scalarCtx)));
        const targetActorId = resolveTargetActorId(state, target);
        const targetActor = targetActorId ? getActorAt(state, target || attacker.position) : undefined;
        const taxonomy = normalizeCombatDamageTaxonomy({
            damageClass: effect.damageClass,
            damageSubClass: effect.damageSubClass,
            damageElement: effect.damageElement,
            attackProfile: resolveAttackProfileFromSubClass(effect.damageSubClass)
        });
        const effectTarget = effect.target.selector === 'targetActor'
            ? (targetActorId || 'targetActor')
            : (effect.target.selector === 'self' ? attacker.id : (target || 'targetActor'));
        const combat = resolveSkillCombatDamage({
            attacker,
            target: effect.target.selector === 'self' ? attacker : targetActor,
            targetId: targetActorId || (effect.target.selector === 'self' ? attacker.id : 'targetActor'),
            skillId: effect.reason || skillId,
            basePower: amount,
            skillDamageMultiplier: 0,
            damageClass: taxonomy.damageClass,
            damageSubClass: taxonomy.damageSubClass,
            damageElement: taxonomy.damageElement,
            combat: {
                damageClass: taxonomy.damageClass,
                damageSubClass: taxonomy.damageSubClass,
                damageElement: taxonomy.damageElement,
                attackProfile: taxonomy.damageClass === 'magical' ? 'spell' : 'melee',
                trackingSignature: taxonomy.damageClass === 'magical' ? 'magic' : 'melee',
                weights: taxonomy.damageClass === 'magical'
                    ? { body: 0, mind: 1, instinct: 0 }
                    : { body: 1, mind: 0, instinct: 0 }
            },
            theoreticalMaxPower: Math.max(1, amount)
        });
        return [createDamageEffectFromCombat(combat, effectTarget as any, effect.reason || skillId)];
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
    const forcePreview = resolveForce(state, {
        source: attacker.position,
        targetActorId,
        mode: effect.force.mode,
        magnitude: forceMagnitude,
        maxDistance: effect.force.maxDistance,
        collision: {
            onBlocked: effect.force.collision.onBlocked,
            crushDamage
        },
        attackerBody: scalarCtx.body,
        defenderBody: resolveTargetActorId(state, target)
            ? extractTrinityStats(getActorAt(state, target!)!).body
            : undefined
    });
    return [{
        type: 'ApplyForce',
        target: targetActorId,
        source: attacker.position,
        mode: effect.force.mode,
        magnitude: forceMagnitude,
        maxDistance: effect.force.maxDistance,
        collision: {
            onBlocked: effect.force.collision.onBlocked,
            crushDamage
        },
        expectedCollision: forcePreview.collided,
        attackerBody: scalarCtx.body,
        defenderBody: resolveTargetActorId(state, target)
            ? extractTrinityStats(getActorAt(state, target!)!).body
            : undefined
    }];
};

const isCollisionSignalEffect = (effect: AtomicEffect): boolean => {
    if (effect.type === 'ApplyForce') return effect.expectedCollision === true;
    if (effect.type !== 'Damage') return false;
    const reason = String(effect.reason || '').toLowerCase();
    if (!reason) return false;
    return reason.includes('crush') || reason.includes('collision') || reason.includes('wall_slam');
};

const getSortedTargets = (state: GameState, origin: Point, range: number, sortMode: CompositeSkillDefinition['targeting']['deterministicSort']): Point[] => {
    const points: Point[] = [];
    for (let q = 0; q < state.gridWidth; q++) {
        for (let r = 0; r < state.gridHeight; r++) {
            const hex = createHex(q, r);
            if (!isHexInRectangularGrid(hex, state.gridWidth, state.gridHeight, state.mapShape)) continue;
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
    const damageScale = Number.isFinite(damageBase?.amount?.coefficientScale) && Number(damageBase.amount.coefficientScale || 0) > 0
        ? Number(damageBase.amount.coefficientScale)
        : 1;
    const momentumScale = Number.isFinite(momentumBase?.force?.magnitude?.coefficientScale) && Number(momentumBase.force.magnitude.coefficientScale || 0) > 0
        ? Number(momentumBase.force.magnitude.coefficientScale)
        : 1;
    const upgrades: Record<string, SkillModifier> = {};
    def.upgrades.forEach(upgrade => {
        const numericModifiers = upgrade.modifiers.filter(
            (mod): mod is Extract<UpgradeModifier, { op: 'modify_number' }> => mod.op === 'modify_number'
        );
        upgrades[upgrade.id] = {
            id: upgrade.id,
            name: upgrade.name,
            description: upgrade.description || upgrade.name,
            tier: upgrade.tier,
            priority: upgrade.priority,
            groupId: upgrade.groupId,
            exclusiveGroup: upgrade.exclusiveGroup,
            requires: [...(upgrade.requires || [])],
            requiredUpgrades: [...(upgrade.requiredUpgrades || [])],
            compatibilityTags: [...(upgrade.compatibilityTags || [])],
            incompatibleWith: [...(upgrade.incompatibleWith || [])],
            modifyRange: numericModifiers
                .filter(mod => mod.field === 'baseAction.range')
                .reduce((sum, mod) => sum + (Number(mod.value) || 0), 0),
            modifyCooldown: numericModifiers
                .filter(mod => mod.field === 'baseAction.costs.cooldown')
                .reduce((sum, mod) => sum + (Number(mod.value) || 0), 0),
            modifyDamage: numericModifiers
                .filter(mod => mod.field === 'baseVariables.damage')
                .reduce((sum, mod) => sum + (Number(mod.value) || 0), 0),
            requiresStationary: upgrade.requiresStationary,
            patches: upgrade.patches?.map(patch => ({ ...patch })),
            extraEffects: []
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
            damage: damageBase
                ? (Number.isFinite(damageBase.amount?.scaledBase)
                    ? Number(damageBase.amount.scaledBase) / damageScale
                    : Number(damageBase.amount?.base || 0))
                : undefined,
            momentum: momentumBase
                ? (Number.isFinite(momentumBase.force?.magnitude?.scaledBase)
                    ? Number(momentumBase.force.magnitude.scaledBase) / momentumScale
                    : Number(momentumBase.force?.magnitude?.base || 0))
                : undefined
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
                effects.push(...convertEffect(state, attacker, target, effect, scalarCtx, def.id));
            }
            const baseEffectRefs = new Set<AtomicEffect>(effects);

            const toReactionItems = (
                trigger: 'BEFORE_RESOLVE' | 'ON_COLLISION' | 'AFTER_RESOLVE',
                hookState: GameState,
                resolvedEffect?: AtomicEffect
            ): AtomicStackReactionItem[] => {
                if (trigger === 'ON_COLLISION' && resolvedEffect && !isCollisionSignalEffect(resolvedEffect)) {
                    return [];
                }
                return (materialized.reactions || [])
                    .filter(reaction => reaction.trigger === trigger)
                    .flatMap(reaction =>
                        reaction.effects.flatMap(rEffect =>
                            convertEffect(hookState, attacker, target, rEffect, scalarCtx, def.id).map(item => ({
                                item,
                                enqueuePosition: reaction.enqueuePosition
                            }))
                        )
                    );
            };

            const hasRuntimeReactions = (materialized.reactions || []).some(
                reaction => reaction.trigger === 'BEFORE_RESOLVE' || reaction.trigger === 'AFTER_RESOLVE' || reaction.trigger === 'ON_COLLISION'
            );

            const stackReactions: AtomicStackReactionHooks | undefined = hasRuntimeReactions
                ? {
                    beforeResolve: (hookState, pendingEffect) => {
                        if (!baseEffectRefs.has(pendingEffect)) return [];
                        return toReactionItems('BEFORE_RESOLVE', hookState, pendingEffect);
                    },
                    afterResolve: (hookState, resolvedEffect) => {
                        if (!baseEffectRefs.has(resolvedEffect)) return [];
                        return [
                            ...toReactionItems('AFTER_RESOLVE', hookState, resolvedEffect),
                            ...toReactionItems('ON_COLLISION', hookState, resolvedEffect)
                        ];
                    }
                }
                : undefined;

            const execution: SkillExecutionResult = {
                effects,
                messages: [],
                consumesTurn: def.baseAction.costs.consumesTurn,
                stackReactions
            };
            return execution;
        },
        getValidTargets: (state: GameState, origin: Point) => {
            if (def.targeting.mode === 'self') return [origin];
            let targets = getSortedTargets(state, origin, def.targeting.range, def.targeting.deterministicSort);
            if (def.targeting.mode === 'single' || def.targeting.mode === 'radius' || def.targeting.mode === 'line') {
                if (def.targeting.requiresLos) {
                    const observer = getActorAt(state, origin) as Actor | undefined;
                    targets = targets.filter(target => validateLineOfSight(state, origin, target, {
                        observerActor: observer
                    }).isValid);
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
