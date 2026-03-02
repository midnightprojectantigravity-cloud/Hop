import type { FoldCandidate, FoldedDecision } from './types';

export const compareCompiledProviders = (
    a: { priority: number; skillId: string; providerId: string },
    b: { priority: number; skillId: string; providerId: string }
): number => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.skillId !== b.skillId) return a.skillId.localeCompare(b.skillId);
    return a.providerId.localeCompare(b.providerId);
};

export const foldCapabilityDecisions = (candidates: FoldCandidate[]): FoldedDecision => {
    let topAllowPriority: number | null = null;
    let topSoftBlockPriority: number | null = null;
    let blockedByHardBlock = false;

    for (const candidate of candidates) {
        if (candidate.decision === 'allow') {
            if (topAllowPriority === null || candidate.priority > topAllowPriority) {
                topAllowPriority = candidate.priority;
            }
            continue;
        }

        if (candidate.decision !== 'block') continue;

        if (candidate.blockKind === 'hard') {
            blockedByHardBlock = true;
            continue;
        }

        if (topSoftBlockPriority === null || candidate.priority > topSoftBlockPriority) {
            topSoftBlockPriority = candidate.priority;
        }
    }

    if (blockedByHardBlock) {
        return {
            decision: 'block',
            blockedByHardBlock,
            topAllowPriority,
            topSoftBlockPriority
        };
    }

    if (topAllowPriority === null && topSoftBlockPriority === null) {
        return {
            decision: 'neutral',
            blockedByHardBlock,
            topAllowPriority,
            topSoftBlockPriority
        };
    }

    if (topAllowPriority === null) {
        return {
            decision: 'block',
            blockedByHardBlock,
            topAllowPriority,
            topSoftBlockPriority
        };
    }

    if (topSoftBlockPriority === null || topAllowPriority > topSoftBlockPriority) {
        return {
            decision: 'allow',
            blockedByHardBlock,
            topAllowPriority,
            topSoftBlockPriority
        };
    }

    return {
        decision: 'block',
        blockedByHardBlock,
        topAllowPriority,
        topSoftBlockPriority
    };
};
