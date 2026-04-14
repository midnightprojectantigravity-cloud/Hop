import type { GameState } from '../../types';
import { stableIdFromSeed } from '../rng';

export const createRaiseDeadSkeletonId = (state: GameState): string => {
    const seed = state.initialSeed ?? state.rngSeed ?? '0';
    const existingIds = new Set<string>([
        ...state.enemies.map(enemy => enemy.id),
        ...(state.companions || []).map(companion => companion.id)
    ]);

    let counter = (state.floor << 20)
        + (state.turnNumber << 12)
        + (state.actionLog?.length ?? 0)
        + (state.rngCounter ?? 0);
    let candidate = `skeleton_${stableIdFromSeed(seed, counter, 8, 'skeleton')}`;

    while (existingIds.has(candidate)) {
        counter += 1;
        candidate = `skeleton_${stableIdFromSeed(seed, counter, 8, 'skeleton')}`;
    }

    return candidate;
};
