export interface ForceContestInput {
    attackerBody: number;
    defenderBody: number;
    intendedDistance: number;
    bodyContestMode?: 'strict_ratio' | 'soft_ratio';
}

export interface ForceContestResult {
    bodyContestRatio: number;
    resolvedKnockbackDistance: number;
    recoilApplied: boolean;
}

export const calculateForceContest = (input: ForceContestInput): ForceContestResult => {
    const attackerBody = Math.max(0, Number(input.attackerBody || 0));
    const defenderBody = Math.max(1, Number(input.defenderBody || 1));
    const intendedDistance = Math.max(0, Math.floor(Number(input.intendedDistance || 0)));
    const ratio = attackerBody / defenderBody;
    const mode = input.bodyContestMode || 'soft_ratio';

    if (mode === 'strict_ratio' && attackerBody < defenderBody) {
        return { bodyContestRatio: ratio, resolvedKnockbackDistance: 0, recoilApplied: false };
    }

    if (ratio < 0.5) {
        return { bodyContestRatio: ratio, resolvedKnockbackDistance: 0, recoilApplied: false };
    }
    if (ratio < 1) {
        return { bodyContestRatio: ratio, resolvedKnockbackDistance: Math.max(0, intendedDistance - 1), recoilApplied: false };
    }
    if (ratio < 1.5) {
        return { bodyContestRatio: ratio, resolvedKnockbackDistance: intendedDistance, recoilApplied: false };
    }
    return { bodyContestRatio: ratio, resolvedKnockbackDistance: intendedDistance + 1, recoilApplied: false };
};
