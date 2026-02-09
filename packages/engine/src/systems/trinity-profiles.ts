import type { TrinityStats } from './trinity-resolver';

export type TrinityProfileId = 'neutral' | 'live';

export interface TrinityProfile {
    id: TrinityProfileId;
    default: TrinityStats;
    archetype: Record<string, TrinityStats>;
    enemySubtype: Record<string, TrinityStats>;
    companionSubtype: Record<string, TrinityStats>;
}

const ZERO: TrinityStats = { body: 0, mind: 0, instinct: 0 };

const clone = (s: TrinityStats): TrinityStats => ({ body: s.body, mind: s.mind, instinct: s.instinct });

const withDefault = (values: Record<string, TrinityStats>): Record<string, TrinityStats> => {
    const out: Record<string, TrinityStats> = {};
    for (const [k, v] of Object.entries(values)) out[k] = clone(v);
    return out;
};

export const TRINITY_PROFILES: Record<TrinityProfileId, TrinityProfile> = {
    neutral: {
        id: 'neutral',
        default: ZERO,
        archetype: withDefault({
            VANGUARD: ZERO,
            SKIRMISHER: ZERO,
            FIREMAGE: ZERO,
            NECROMANCER: ZERO,
            HUNTER: ZERO,
            ASSASSIN: ZERO,
        }),
        enemySubtype: withDefault({
            footman: ZERO,
            sprinter: ZERO,
            raider: ZERO,
            pouncer: ZERO,
            shieldBearer: ZERO,
            archer: ZERO,
            bomber: ZERO,
            warlock: ZERO,
            sentinel: ZERO,
        }),
        companionSubtype: withDefault({
            falcon: ZERO,
            skeleton: ZERO,
        }),
    },
    live: {
        id: 'live',
        default: ZERO,
        archetype: withDefault({
            VANGUARD: { body: 8, mind: 2, instinct: 4 },
            SKIRMISHER: { body: 4, mind: 2, instinct: 8 },
            FIREMAGE: { body: 2, mind: 9, instinct: 4 },
            NECROMANCER: { body: 3, mind: 8, instinct: 4 },
            HUNTER: { body: 3, mind: 4, instinct: 8 },
            ASSASSIN: { body: 3, mind: 3, instinct: 9 },
        }),
        enemySubtype: withDefault({
            footman: { body: 6, mind: 1, instinct: 3 },
            sprinter: { body: 2, mind: 1, instinct: 8 },
            raider: { body: 4, mind: 1, instinct: 6 },
            pouncer: { body: 3, mind: 1, instinct: 8 },
            shieldBearer: { body: 9, mind: 1, instinct: 2 },
            archer: { body: 2, mind: 3, instinct: 8 },
            bomber: { body: 2, mind: 7, instinct: 3 },
            warlock: { body: 1, mind: 9, instinct: 3 },
            sentinel: { body: 10, mind: 8, instinct: 6 },
        }),
        companionSubtype: withDefault({
            falcon: { body: 2, mind: 2, instinct: 9 },
            skeleton: { body: 5, mind: 1, instinct: 4 },
        }),
    },
};

const normalizeProfileId = (id: string | undefined): TrinityProfileId =>
    id?.toLowerCase() === 'live' ? 'live' : 'neutral';

const readProfileEnv = (): string | undefined => {
    const maybeProcess = (globalThis as any)?.process;
    return maybeProcess?.env?.HOP_TRINITY_PROFILE;
};

export const getActiveTrinityProfileId = (): TrinityProfileId =>
    normalizeProfileId(readProfileEnv());

export const getTrinityProfile = (id?: string): TrinityProfile =>
    TRINITY_PROFILES[normalizeProfileId(id ?? readProfileEnv())];
