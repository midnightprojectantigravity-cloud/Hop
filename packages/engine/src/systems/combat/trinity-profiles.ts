import type { TrinityStats } from './trinity-resolver';
import { listCompanionBalanceEntries } from '../../data/companions/content';
import { MVP_ENEMY_CONTENT } from '../../data/packs/mvp-enemy-content';

export const TRINITY_PROFILE_SET_VERSION = 'core-v2-live';

export interface TrinityProfile {
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

const ENEMY_TRINITY_PROFILE = withDefault(
    Object.fromEntries(
        Object.entries(MVP_ENEMY_CONTENT).map(([subtype, entry]) => [subtype, entry.bestiary.trinity])
    )
);
ENEMY_TRINITY_PROFILE.bomb = ZERO;

const COMPANION_TRINITY_PROFILE = withDefault(
    Object.fromEntries(
        listCompanionBalanceEntries().map(entry => [entry.subtype, entry.trinity])
    )
);

export const LIVE_TRINITY_PROFILE: TrinityProfile = {
    default: ZERO,
    archetype: withDefault({
        VANGUARD: { body: 30, mind: 5, instinct: 15 },
        SKIRMISHER: { body: 12, mind: 8, instinct: 14 },
        FIREMAGE: { body: 5, mind: 30, instinct: 15 },
        NECROMANCER: { body: 10, mind: 30, instinct: 10 },
        HUNTER: { body: 4, mind: 4, instinct: 9 },
        ASSASSIN: { body: 3, mind: 4, instinct: 10 },
    }),
    enemySubtype: ENEMY_TRINITY_PROFILE,
    companionSubtype: COMPANION_TRINITY_PROFILE,
};

export const getTrinityProfile = (): TrinityProfile => LIVE_TRINITY_PROFILE;
