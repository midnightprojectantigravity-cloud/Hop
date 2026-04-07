import type { Actor } from '../../types';
import type { CombatProfileComponent } from '../components';
import { getComponent } from '../components';
import { getEnemyCatalogEntry } from '../../data/enemies';
import { getCompanionBalanceEntry } from '../../data/companions/content';
export const COMBAT_PROFILE_SET_VERSION = 'mvp-v1';

export interface CombatProfile {
    outgoingPhysical: number;
    outgoingMagical: number;
    incomingPhysical: number;
    incomingMagical: number;
}

const DEFAULT_PROFILE: CombatProfile = {
    outgoingPhysical: 1,
    outgoingMagical: 1,
    incomingPhysical: 1,
    incomingMagical: 1,
};

const cloneProfile = (profile: CombatProfile): CombatProfile => ({
    outgoingPhysical: profile.outgoingPhysical,
    outgoingMagical: profile.outgoingMagical,
    incomingPhysical: profile.incomingPhysical,
    incomingMagical: profile.incomingMagical,
});

export const resolveDefaultCombatProfile = (actorLike: {
    type: 'player' | 'enemy';
    archetype?: string;
    subtype?: string;
    companionOf?: string;
}): CombatProfile => {
    if (actorLike.type === 'player') {
        return cloneProfile(DEFAULT_PROFILE);
    }

    if (actorLike.companionOf && actorLike.subtype) {
        const companion = getCompanionBalanceEntry(actorLike.subtype);
        if (companion?.combatProfile) return cloneProfile(companion.combatProfile);
        return cloneProfile(DEFAULT_PROFILE);
    }

    if (actorLike.subtype) {
        const enemy = getEnemyCatalogEntry(actorLike.subtype);
        if (enemy?.combatProfile) return cloneProfile(enemy.combatProfile);
        return cloneProfile(DEFAULT_PROFILE);
    }

    return cloneProfile(DEFAULT_PROFILE);
};

export const extractCombatProfile = (actor: Actor): CombatProfile => {
    const c = getComponent<CombatProfileComponent>(actor.components, 'combat_profile');
    if (!c) return cloneProfile(DEFAULT_PROFILE);
    return {
        outgoingPhysical: Number.isFinite(c.outgoingPhysical) ? c.outgoingPhysical : 1,
        outgoingMagical: Number.isFinite(c.outgoingMagical) ? c.outgoingMagical : 1,
        incomingPhysical: Number.isFinite(c.incomingPhysical) ? c.incomingPhysical : 1,
        incomingMagical: Number.isFinite(c.incomingMagical) ? c.incomingMagical : 1,
    };
};

export const getOutgoingDamageMultiplier = (actor: Actor, damageClass: 'physical' | 'magical'): number => {
    const p = extractCombatProfile(actor);
    return damageClass === 'magical' ? p.outgoingMagical : p.outgoingPhysical;
};

export const getIncomingDamageMultiplier = (actor: Actor, damageClass: 'physical' | 'magical'): number => {
    const p = extractCombatProfile(actor);
    return damageClass === 'magical' ? p.incomingMagical : p.incomingPhysical;
};
