import { listFloorSpawnProfiles, toLegacyEnemyStatsRecord } from '../data/enemies';

/**
 * Deprecated compatibility constants.
 * Runtime ownership is catalog/profile-based under `data/enemies/*`.
 * New runtime code should not depend on these exports.
 */

export const ENEMY_STATS = toLegacyEnemyStatsRecord();

const FLOOR_SPAWN_PROFILES = listFloorSpawnProfiles();
const MAX_FLOOR_PROFILE = FLOOR_SPAWN_PROFILES.reduce((max, profile) => Math.max(max, profile.floor), 0);

export const FLOOR_ENEMY_BUDGET = Array.from({ length: MAX_FLOOR_PROFILE + 1 }, (_, floor) =>
    FLOOR_SPAWN_PROFILES.find(profile => profile.floor === floor)?.budget ?? 0
);

export const FLOOR_ENEMY_TYPES: Record<number, string[]> = Object.fromEntries(
    FLOOR_SPAWN_PROFILES.map(profile => [profile.floor, [...profile.allowedSubtypes]])
);
