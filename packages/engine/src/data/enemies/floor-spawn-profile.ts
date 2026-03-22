import type { EncounterRole, EnemySubtypeId } from '../packs/mvp-enemy-content';

export interface FloorSpawnComposition {
    frontlineMin: number;
    frontlineMax: number;
    rangedMax: number;
    hazardSetterMax: number;
    flankerMax: number;
    supportMax: number;
    bossAnchorMax: number;
}

export interface FloorSpawnProfile {
    floor: number;
    role: EncounterRole;
    budget: number;
    allowedSubtypes: EnemySubtypeId[];
    composition: FloorSpawnComposition;
}

const FLOOR_SPAWN_PROFILES: Record<number, Omit<FloorSpawnProfile, 'floor'>> = {
    0: {
        role: 'onboarding',
        budget: 0,
        allowedSubtypes: [],
        composition: { frontlineMin: 0, frontlineMax: 0, rangedMax: 0, hazardSetterMax: 0, flankerMax: 0, supportMax: 0, bossAnchorMax: 0 }
    },
    1: {
        role: 'onboarding',
        budget: 2,
        allowedSubtypes: ['footman'],
        composition: { frontlineMin: 1, frontlineMax: 1, rangedMax: 0, hazardSetterMax: 0, flankerMax: 0, supportMax: 0, bossAnchorMax: 0 }
    },
    2: {
        role: 'onboarding',
        budget: 4,
        allowedSubtypes: ['footman', 'sprinter'],
        composition: { frontlineMin: 1, frontlineMax: 1, rangedMax: 0, hazardSetterMax: 0, flankerMax: 1, supportMax: 0, bossAnchorMax: 0 }
    },
    3: {
        role: 'recovery',
        budget: 5,
        allowedSubtypes: ['footman', 'archer'],
        composition: { frontlineMin: 1, frontlineMax: 2, rangedMax: 1, hazardSetterMax: 0, flankerMax: 0, supportMax: 0, bossAnchorMax: 0 }
    },
    4: {
        role: 'pressure_spike',
        budget: 7,
        allowedSubtypes: ['footman', 'archer', 'bomber', 'raider'],
        composition: { frontlineMin: 1, frontlineMax: 2, rangedMax: 1, hazardSetterMax: 1, flankerMax: 1, supportMax: 0, bossAnchorMax: 0 }
    },
    5: {
        role: 'elite',
        budget: 10,
        allowedSubtypes: ['footman', 'archer', 'bomber', 'shieldBearer', 'raider'],
        composition: { frontlineMin: 1, frontlineMax: 2, rangedMax: 1, hazardSetterMax: 1, flankerMax: 1, supportMax: 0, bossAnchorMax: 0 }
    },
    6: {
        role: 'recovery',
        budget: 12,
        allowedSubtypes: ['footman', 'archer', 'bomber', 'shieldBearer', 'warlock', 'pouncer'],
        composition: { frontlineMin: 1, frontlineMax: 2, rangedMax: 1, hazardSetterMax: 1, flankerMax: 1, supportMax: 1, bossAnchorMax: 0 }
    },
    7: {
        role: 'pressure_spike',
        budget: 15,
        allowedSubtypes: ['footman', 'archer', 'bomber', 'shieldBearer', 'warlock', 'sprinter', 'pouncer'],
        composition: { frontlineMin: 1, frontlineMax: 2, rangedMax: 2, hazardSetterMax: 1, flankerMax: 2, supportMax: 1, bossAnchorMax: 0 }
    },
    8: {
        role: 'elite',
        budget: 18,
        allowedSubtypes: ['footman', 'archer', 'bomber', 'shieldBearer', 'warlock', 'sprinter', 'pouncer'],
        composition: { frontlineMin: 1, frontlineMax: 2, rangedMax: 2, hazardSetterMax: 1, flankerMax: 2, supportMax: 1, bossAnchorMax: 0 }
    },
    9: {
        role: 'boss',
        budget: 26,
        allowedSubtypes: ['sentinel', 'shieldBearer', 'archer', 'warlock'],
        composition: { frontlineMin: 1, frontlineMax: 2, rangedMax: 2, hazardSetterMax: 0, flankerMax: 0, supportMax: 1, bossAnchorMax: 1 }
    },
    10: {
        role: 'boss',
        budget: 0,
        allowedSubtypes: [],
        composition: { frontlineMin: 0, frontlineMax: 0, rangedMax: 0, hazardSetterMax: 0, flankerMax: 0, supportMax: 0, bossAnchorMax: 0 }
    },
};

const MAX_PROFILE_FLOOR = Math.max(...Object.keys(FLOOR_SPAWN_PROFILES).map(Number));

export const getFloorSpawnProfile = (floor: number): FloorSpawnProfile => {
    const normalizedFloor = Math.max(0, Math.floor(floor));
    const profileFloor = Math.min(normalizedFloor, MAX_PROFILE_FLOOR);
    const profile = FLOOR_SPAWN_PROFILES[profileFloor] || FLOOR_SPAWN_PROFILES[MAX_PROFILE_FLOOR];
    return {
        floor: profileFloor,
        role: profile.role,
        budget: profile.budget,
        allowedSubtypes: [...profile.allowedSubtypes],
        composition: { ...profile.composition }
    };
};

export const listFloorSpawnProfiles = (): FloorSpawnProfile[] =>
    Object.keys(FLOOR_SPAWN_PROFILES)
        .map(Number)
        .sort((a, b) => a - b)
        .map(floor => ({
            floor,
            role: FLOOR_SPAWN_PROFILES[floor].role,
            budget: FLOOR_SPAWN_PROFILES[floor].budget,
            allowedSubtypes: [...FLOOR_SPAWN_PROFILES[floor].allowedSubtypes],
            composition: { ...FLOOR_SPAWN_PROFILES[floor].composition }
        }));
