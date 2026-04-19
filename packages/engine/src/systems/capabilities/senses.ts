import { hexDistance } from '../../hex';
import type { Actor, Point, SenseQuery, SenseResult } from '../../types';
import { getActorAt } from '../../helpers';
import { getCompiledCapabilityBundleForActor } from './cache';
import { foldCapabilityDecisions } from './resolver';
import type { FoldCandidate } from './types';

interface SenseResolutionInput {
    state: SenseQuery['state'];
    observer: Actor;
    origin: Point;
    target: Point;
    stopAtWalls: boolean;
    stopAtActors: boolean;
    stopAtLava: boolean;
    excludeActorId?: string;
    context?: Record<string, unknown>;
    evaluateFallbackLineOfSight: SenseQuery['evaluateFallbackLineOfSight'];
}

export const resolveSenseLineOfSight = (input: SenseResolutionInput): SenseResult => {
    const bundle = getCompiledCapabilityBundleForActor(input.state, input.observer);
    if (bundle.senses.length === 0) {
        const fallback = input.evaluateFallbackLineOfSight({
            stopAtWalls: input.stopAtWalls,
            stopAtActors: input.stopAtActors,
            stopAtLava: input.stopAtLava,
            excludeActorId: input.excludeActorId
        });
        return {
            usedCapabilities: false,
            isValid: fallback.isValid,
            blockedBy: fallback.blockedBy,
            blockedAt: fallback.blockedAt,
            decision: fallback.isValid ? 'allow' : 'block',
            blockedByHardBlock: false,
            topAllowPriority: null,
            topSoftBlockPriority: null,
            appliedProviders: [],
            channels: []
        };
    }

    const targetActor = getActorAt(input.state, input.target);
    const query: SenseQuery = {
        state: input.state,
        observer: input.observer,
        origin: input.origin,
        target: input.target,
        targetActor,
        stopAtWalls: input.stopAtWalls,
        stopAtActors: input.stopAtActors,
        stopAtLava: input.stopAtLava,
        excludeActorId: input.excludeActorId,
        distance: hexDistance(input.origin, input.target),
        context: input.context,
        evaluateFallbackLineOfSight: input.evaluateFallbackLineOfSight
    };

    const foldCandidates: FoldCandidate[] = [];
    const appliedProviders: string[] = [];
    const channels = new Set<string>();

    for (const compiled of bundle.senses) {
        const result = compiled.provider.resolve(query);
        const providerKey = `${compiled.skillId}:${compiled.providerId}`;
        foldCandidates.push({
            providerKey,
            priority: compiled.priority,
            decision: result.decision,
            blockKind: result.blockKind
        });
        if (result.decision !== 'neutral') {
            appliedProviders.push(providerKey);
        }
        if (result.decision === 'allow') {
            channels.add(result.channelId || compiled.providerId);
        }
    }

    const folded = foldCapabilityDecisions(foldCandidates);
    const isValid = folded.decision === 'allow';
    const fallback = input.evaluateFallbackLineOfSight({
        stopAtWalls: input.stopAtWalls,
        stopAtActors: input.stopAtActors,
        stopAtLava: input.stopAtLava,
        excludeActorId: input.excludeActorId
    });

    return {
        usedCapabilities: true,
        isValid,
        blockedBy: isValid ? undefined : fallback.blockedBy,
        blockedAt: isValid ? undefined : fallback.blockedAt,
        decision: folded.decision,
        blockedByHardBlock: folded.blockedByHardBlock,
        topAllowPriority: folded.topAllowPriority,
        topSoftBlockPriority: folded.topSoftBlockPriority,
        appliedProviders,
        channels: [...channels]
    };
};
