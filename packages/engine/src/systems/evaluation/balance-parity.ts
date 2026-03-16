import type {
    EnemyPowerProfile,
    EnemyRosterParityProfile,
    LoadoutPowerProfile,
    LoadoutRosterParityProfile,
    RosterParityBand
} from './balance-schema';

const round4 = (value: number): number => Number(value.toFixed(4));

const median = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
};

const resolveParityBand = (relativeDeltaPct: number): RosterParityBand => {
    if (relativeDeltaPct <= -0.25) return 'outlier_under';
    if (relativeDeltaPct < -0.1) return 'under';
    if (relativeDeltaPct >= 0.25) return 'outlier_over';
    if (relativeDeltaPct > 0.1) return 'over';
    return 'balanced';
};

export const computeLoadoutParityProfiles = (
    loadoutProfiles: LoadoutPowerProfile[]
): LoadoutRosterParityProfile[] => {
    const baseline = median(loadoutProfiles.map(profile => profile.intrinsicPowerScore));
    return loadoutProfiles
        .map(profile => {
            const deltaFromMedian = round4(profile.intrinsicPowerScore - baseline);
            const relativeDeltaPct = round4(baseline > 0 ? deltaFromMedian / baseline : 0);
            return {
                loadoutId: profile.loadoutId,
                intrinsicPowerScore: profile.intrinsicPowerScore,
                deltaFromMedian,
                relativeDeltaPct,
                parityBand: resolveParityBand(relativeDeltaPct)
            };
        })
        .sort((left, right) =>
            right.relativeDeltaPct - left.relativeDeltaPct
            || left.loadoutId.localeCompare(right.loadoutId)
        );
};

export const computeEnemyParityProfiles = (
    enemyProfiles: EnemyPowerProfile[]
): EnemyRosterParityProfile[] => {
    const baseline = median(enemyProfiles.map(profile => profile.intrinsicPowerScore));
    return enemyProfiles
        .map(profile => {
            const deltaFromMedian = round4(profile.intrinsicPowerScore - baseline);
            const relativeDeltaPct = round4(baseline > 0 ? deltaFromMedian / baseline : 0);
            return {
                subtype: profile.subtype,
                intrinsicPowerScore: profile.intrinsicPowerScore,
                deltaFromMedian,
                relativeDeltaPct,
                parityBand: resolveParityBand(relativeDeltaPct)
            };
        })
        .sort((left, right) =>
            right.relativeDeltaPct - left.relativeDeltaPct
            || left.subtype.localeCompare(right.subtype)
        );
};
