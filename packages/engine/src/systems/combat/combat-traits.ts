import type { Actor } from '../../types';
import type { CombatProfileComponent } from '../components';
import { getComponent } from '../components';
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

const PLAYER_ARCHETYPE_PROFILES: Record<string, CombatProfile> = {
    VANGUARD: DEFAULT_PROFILE,
    SKIRMISHER: DEFAULT_PROFILE,
    FIREMAGE: DEFAULT_PROFILE,
    NECROMANCER: DEFAULT_PROFILE,
    HUNTER: DEFAULT_PROFILE,
    ASSASSIN: DEFAULT_PROFILE,
};

const ENEMY_SUBTYPE_PROFILES: Record<string, CombatProfile> = {
    footman: { outgoingPhysical: 3.0, outgoingMagical: 1.0, incomingPhysical: 1.0, incomingMagical: 1.0 },
    sprinter: { outgoingPhysical: 2.8, outgoingMagical: 1.0, incomingPhysical: 1.0, incomingMagical: 1.0 },
    raider: { outgoingPhysical: 3.2, outgoingMagical: 1.0, incomingPhysical: 1.0, incomingMagical: 1.0 },
    pouncer: { outgoingPhysical: 3.2, outgoingMagical: 1.0, incomingPhysical: 1.0, incomingMagical: 1.0 },
    shieldBearer: { outgoingPhysical: 3.5, outgoingMagical: 1.0, incomingPhysical: 1.0, incomingMagical: 1.0 },
    archer: { outgoingPhysical: 2.6, outgoingMagical: 1.0, incomingPhysical: 1.0, incomingMagical: 1.0 },
    bomber: { outgoingPhysical: 2.8, outgoingMagical: 3.0, incomingPhysical: 1.0, incomingMagical: 1.0 },
    warlock: { outgoingPhysical: 1.5, outgoingMagical: 3.5, incomingPhysical: 1.0, incomingMagical: 1.0 },
    sentinel: { outgoingPhysical: 4.0, outgoingMagical: 4.0, incomingPhysical: 1.0, incomingMagical: 1.0 },
};

const COMPANION_SUBTYPE_PROFILES: Record<string, CombatProfile> = {
    falcon: { outgoingPhysical: 1.2, outgoingMagical: 1.0, incomingPhysical: 1.0, incomingMagical: 1.0 },
    skeleton: { outgoingPhysical: 1.1, outgoingMagical: 1.0, incomingPhysical: 1.0, incomingMagical: 1.0 },
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
        return cloneProfile(
            PLAYER_ARCHETYPE_PROFILES[(actorLike.archetype || 'VANGUARD').toUpperCase()] || DEFAULT_PROFILE
        );
    }

    if (actorLike.companionOf && actorLike.subtype) {
        return cloneProfile(COMPANION_SUBTYPE_PROFILES[actorLike.subtype] || DEFAULT_PROFILE);
    }

    if (actorLike.subtype) {
        return cloneProfile(ENEMY_SUBTYPE_PROFILES[actorLike.subtype] || DEFAULT_PROFILE);
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
