import type { Actor, GameState, MovementModel, MovementQuery, MovementResult } from '../../types';
import { getCompiledCapabilityBundleForActor } from './cache';
import { foldCapabilityDecisions } from './resolver';
import type { CompiledMovementProvider, FoldCandidate } from './types';

const DEFAULT_MOVEMENT_MODEL: MovementModel = {
    pathing: 'walk',
    ignoreGroundHazards: false,
    ignoreWalls: false,
    allowPassThroughActors: false,
    rangeModifier: 0
};

const applyMovementModelPatch = (
    current: MovementModel,
    patch: Partial<MovementModel> | undefined
): MovementModel => {
    if (!patch) return current;
    return {
        ...current,
        ...patch
    };
};

const resolveMovementModelFromAllowedProviders = (
    providers: Array<{ compiled: CompiledMovementProvider; result: ReturnType<CompiledMovementProvider['provider']['resolve']> }>
): MovementModel => {
    if (providers.length === 0) return DEFAULT_MOVEMENT_MODEL;

    const replacement = providers
        .filter(entry => entry.result.resolutionMode === 'REPLACE')
        .sort((a, b) => b.compiled.priority - a.compiled.priority)[0];

    let current = replacement?.result.model
        ? applyMovementModelPatch(DEFAULT_MOVEMENT_MODEL, replacement.result.model)
        : DEFAULT_MOVEMENT_MODEL;

    const extensionProviders = providers
        .filter(entry => entry.result.resolutionMode === 'EXTEND')
        .sort((a, b) => {
            if (a.compiled.priority !== b.compiled.priority) return b.compiled.priority - a.compiled.priority;
            if (a.compiled.skillId !== b.compiled.skillId) return a.compiled.skillId.localeCompare(b.compiled.skillId);
            return a.compiled.providerId.localeCompare(b.compiled.providerId);
        });

    for (const entry of extensionProviders) {
        current = applyMovementModelPatch(current, entry.result.model);
    }

    return current;
};

export interface ResolveMovementCapabilitiesOptions {
    skillId?: string;
    target?: MovementQuery['target'];
    context?: MovementQuery['context'];
}

export const resolveMovementCapabilities = (
    state: GameState,
    actor: Actor,
    options: ResolveMovementCapabilitiesOptions = {}
): MovementResult => {
    const bundle = getCompiledCapabilityBundleForActor(state, actor);
    if (bundle.movement.length === 0) {
        return {
            model: DEFAULT_MOVEMENT_MODEL,
            meta: {
                usedCapabilities: false,
                decision: 'allow',
                blockedByHardBlock: false,
                topAllowPriority: null,
                topSoftBlockPriority: null,
                appliedProviders: []
            }
        };
    }

    const query: MovementQuery = {
        state,
        actor,
        origin: actor.position,
        skillId: options.skillId,
        target: options.target,
        context: options.context
    };

    const foldCandidates: FoldCandidate[] = [];
    const appliedProviders: string[] = [];
    const allowedProviders: Array<{ compiled: CompiledMovementProvider; result: ReturnType<CompiledMovementProvider['provider']['resolve']> }> = [];

    for (const compiled of bundle.movement) {
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
            allowedProviders.push({ compiled, result });
        }
    }

    const folded = foldCapabilityDecisions(foldCandidates);
    const model = folded.decision === 'allow'
        ? resolveMovementModelFromAllowedProviders(allowedProviders)
        : DEFAULT_MOVEMENT_MODEL;

    return {
        model,
        meta: {
            usedCapabilities: true,
            decision: folded.decision,
            blockedByHardBlock: folded.blockedByHardBlock,
            topAllowPriority: folded.topAllowPriority,
            topSoftBlockPriority: folded.topSoftBlockPriority,
            appliedProviders
        }
    };
};

export const getDefaultMovementCapabilityModel = (): MovementModel => ({ ...DEFAULT_MOVEMENT_MODEL });

export const resolveMovementModelFromProviderResultsForTests = resolveMovementModelFromAllowedProviders;
