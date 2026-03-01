import type { Actor } from '../../types';
import type { AilmentID } from '../../types/registry';
import type { AilmentDefinition } from '../../data/ailments';
import type {
    AilmentHardeningGainResult
} from './types';
import type {
    AilmentProfileComponent,
    AilmentResilienceComponent
} from '../components';

const cloneComponents = (actor: Actor): Map<string, any> => new Map(actor.components || []);

const resolveProfile = (actor: Actor): AilmentProfileComponent => {
    const component = actor.components?.get('ailment_profile') as AilmentProfileComponent | undefined;
    if (component) return component;
    return {
        type: 'ailment_profile',
        baseResistancePct: {},
        resistanceGrowthRate: 1
    };
};

const resolveResilience = (actor: Actor): AilmentResilienceComponent => {
    const component = actor.components?.get('ailment_resilience') as AilmentResilienceComponent | undefined;
    if (component) return component;
    return {
        type: 'ailment_resilience',
        xp: {},
        resistancePct: {}
    };
};

const toResistanceFromXp = (xp: number, config: AilmentDefinition['hardening']): number => {
    const raw = xp / config.xpToResistance;
    return Math.max(0, Math.min(config.capPct, raw));
};

export const getAilmentBaseResistancePct = (actor: Actor, ailment: AilmentID): number => {
    const profile = resolveProfile(actor);
    return Math.max(0, Math.min(100, Number(profile.baseResistancePct?.[ailment] || 0)));
};

export const getAilmentSpecificResistancePct = (actor: Actor, ailment: AilmentID): number => {
    const resilience = resolveResilience(actor);
    return Math.max(0, Math.min(100, Number(resilience.resistancePct?.[ailment] || 0)));
};

export const gainAilmentResilienceXp = (
    actor: Actor,
    ailment: AilmentID,
    rawXpDelta: number,
    definition: AilmentDefinition
): AilmentHardeningGainResult => {
    const profile = resolveProfile(actor);
    const resilience = resolveResilience(actor);
    const growthRate = Math.max(0, Number(profile.resistanceGrowthRate || 1));
    const delta = Math.max(0, rawXpDelta * growthRate);
    const previousXp = Math.max(0, Number(resilience.xp?.[ailment] || 0));
    const previousPct = Math.max(0, Number(resilience.resistancePct?.[ailment] || 0));
    const nextXp = previousXp + delta;
    const nextPct = toResistanceFromXp(nextXp, definition.hardening);

    const nextResilience: AilmentResilienceComponent = {
        ...resilience,
        xp: {
            ...(resilience.xp || {}),
            [ailment]: nextXp
        },
        resistancePct: {
            ...(resilience.resistancePct || {}),
            [ailment]: nextPct
        }
    };

    const nextComponents = cloneComponents(actor);
    nextComponents.set('ailment_profile', profile);
    nextComponents.set('ailment_resilience', nextResilience);
    return {
        actor: {
            ...actor,
            components: nextComponents
        },
        previousPct,
        nextPct,
        gainedPct: Math.max(0, nextPct - previousPct),
        previousXp,
        nextXp
    };
};

