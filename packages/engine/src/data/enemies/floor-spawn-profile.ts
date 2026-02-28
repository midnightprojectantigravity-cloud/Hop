import type { EnemySubtypeId } from '../packs/mvp-enemy-content';

export interface FloorSpawnProfile {
    floor: number;
    budget: number;
    allowedSubtypes: EnemySubtypeId[];
}

const FLOOR_SPAWN_PROFILES: Record<number, Omit<FloorSpawnProfile, 'floor'>> = {
    0: { budget: 0, allowedSubtypes: [] },
    1: { budget: 2, allowedSubtypes: ['footman'] },
    2: { budget: 3, allowedSubtypes: ['footman', 'sprinter'] },
    3: { budget: 5, allowedSubtypes: ['footman', 'archer'] },
    4: { budget: 7, allowedSubtypes: ['footman', 'archer', 'bomber', 'raider'] },
    5: { budget: 10, allowedSubtypes: ['footman', 'archer', 'bomber', 'shieldBearer', 'raider'] },
    6: { budget: 12, allowedSubtypes: ['footman', 'archer', 'bomber', 'shieldBearer', 'warlock', 'pouncer'] },
    7: { budget: 15, allowedSubtypes: ['footman', 'archer', 'bomber', 'shieldBearer', 'warlock', 'sprinter', 'pouncer'] },
    8: { budget: 18, allowedSubtypes: ['footman', 'archer', 'bomber', 'shieldBearer', 'warlock', 'sprinter', 'pouncer'] },
    9: { budget: 22, allowedSubtypes: ['footman', 'archer', 'bomber', 'shieldBearer', 'warlock', 'sprinter', 'pouncer'] },
    10: { budget: 0, allowedSubtypes: [] },
};

const MAX_PROFILE_FLOOR = Math.max(...Object.keys(FLOOR_SPAWN_PROFILES).map(Number));

export const getFloorSpawnProfile = (floor: number): FloorSpawnProfile => {
    const normalizedFloor = Math.max(0, Math.floor(floor));
    const profileFloor = Math.min(normalizedFloor, MAX_PROFILE_FLOOR);
    const profile = FLOOR_SPAWN_PROFILES[profileFloor] || FLOOR_SPAWN_PROFILES[MAX_PROFILE_FLOOR];
    return {
        floor: profileFloor,
        budget: profile.budget,
        allowedSubtypes: [...profile.allowedSubtypes],
    };
};

export const listFloorSpawnProfiles = (): FloorSpawnProfile[] =>
    Object.keys(FLOOR_SPAWN_PROFILES)
        .map(Number)
        .sort((a, b) => a - b)
        .map(floor => ({
            floor,
            budget: FLOOR_SPAWN_PROFILES[floor].budget,
            allowedSubtypes: [...FLOOR_SPAWN_PROFILES[floor].allowedSubtypes],
        }));

