import type {
    Actor,
    CapabilityDecision,
    GameState,
    InformationPayload,
    InformationQuery,
    InformationResult
} from '../../types';
import { extractTrinityStats } from '../combat/combat-calculator';
import { getCompiledCapabilityBundleForActor } from './cache';
import { foldCapabilityDecisions } from './resolver';
import type { FoldCandidate } from './types';

const resolveActorById = (state: GameState, actorId: string): Actor | undefined => {
    if (state.player.id === actorId) return state.player;
    return state.enemies.find(e => e.id === actorId) || state.companions?.find(c => c.id === actorId);
};

const toIntentBadge = (intent?: string): string | undefined => {
    const normalized = String(intent || '').toUpperCase();
    if (!normalized) return undefined;
    if (/(ATTACK|SHOOT|THROW|BLAST|STRIKE|BASH|CAST|PECK|EXPLOSION)/.test(normalized)) return 'OFFENSE';
    if (/(MOVE|WAIT|ADVANC|DEFEND|REPOSITION|ROOST|SCOUT|IDLE)/.test(normalized)) return 'DEFENSE';
    return 'UTILITY';
};

const buildFullInformationPayload = (
    subject: Actor,
    query: Pick<InformationQuery, 'context'>
): InformationPayload => {
    const trinity = extractTrinityStats(subject);
    return {
        name: subject.subtype || subject.type,
        hp: { current: subject.hp, max: subject.maxHp },
        trinityStats: trinity,
        intentBadge: toIntentBadge(subject.intent),
        topActionUtilities: query.context?.topActionUtilities ? [...query.context.topActionUtilities] : undefined
    };
};

const emptyReveal = () => ({
    name: false,
    hp: false,
    trinityStats: false,
    intentBadge: false,
    topActionUtilities: false
});

const fullReveal = () => ({
    name: true,
    hp: true,
    trinityStats: true,
    intentBadge: true,
    topActionUtilities: true
});

const buildResult = (
    payload: InformationPayload,
    reveal: ReturnType<typeof emptyReveal>,
    meta: InformationResult['meta']
): InformationResult => {
    const data: InformationPayload = {};
    if (reveal.name) data.name = payload.name;
    if (reveal.hp) data.hp = payload.hp;
    if (reveal.trinityStats) data.trinityStats = payload.trinityStats;
    if (reveal.intentBadge) data.intentBadge = payload.intentBadge;
    if (reveal.topActionUtilities) data.topActionUtilities = payload.topActionUtilities;
    return { reveal, data, meta };
};

const toNoCapabilityMeta = (decision: CapabilityDecision, forceReveal: boolean): InformationResult['meta'] => ({
    isForceRevealApplied: forceReveal,
    usedCapabilities: false,
    decision,
    blockedByHardBlock: false,
    topAllowPriority: null,
    topSoftBlockPriority: null,
    appliedProviders: []
});

export interface ActorInformationOptions {
    revealMode?: 'strict' | 'force_reveal';
    context?: {
        topActionUtilities?: Array<{ skillId: string; score: number }>;
    };
}

export const getActorInformation = (
    state: GameState,
    viewerId: string,
    subjectId: string,
    options: ActorInformationOptions = {}
): InformationResult => {
    const viewer = resolveActorById(state, viewerId);
    const subject = resolveActorById(state, subjectId);
    if (!viewer || !subject) {
        return {
            reveal: emptyReveal(),
            data: {},
            meta: {
                isForceRevealApplied: false,
                usedCapabilities: false,
                decision: 'neutral',
                blockedByHardBlock: false,
                topAllowPriority: null,
                topSoftBlockPriority: null,
                appliedProviders: []
            }
        };
    }

    const query: InformationQuery = {
        state,
        viewer,
        subject,
        revealMode: options.revealMode || 'strict',
        context: options.context
    };
    const payload = buildFullInformationPayload(subject, query);
    const forceReveal = query.revealMode === 'force_reveal';
    if (forceReveal) {
        return buildResult(payload, fullReveal(), toNoCapabilityMeta('allow', true));
    }

    const bundle = getCompiledCapabilityBundleForActor(state, viewer);
    if (bundle.information.length === 0) {
        return buildResult(payload, fullReveal(), toNoCapabilityMeta('allow', false));
    }

    const foldCandidates: FoldCandidate[] = [];
    const appliedProviders: string[] = [];
    const reveal = emptyReveal();
    const providerDataOverrides: InformationPayload = {};

    for (const compiled of bundle.information) {
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

        if (result.decision !== 'allow') continue;
        reveal.name = reveal.name || Boolean(result.reveal?.name);
        reveal.hp = reveal.hp || Boolean(result.reveal?.hp);
        reveal.trinityStats = reveal.trinityStats || Boolean(result.reveal?.trinityStats);
        reveal.intentBadge = reveal.intentBadge || Boolean(result.reveal?.intentBadge);
        reveal.topActionUtilities = reveal.topActionUtilities || Boolean(result.reveal?.topActionUtilities);

        if (result.data?.name !== undefined) providerDataOverrides.name = result.data.name;
        if (result.data?.hp !== undefined) providerDataOverrides.hp = result.data.hp;
        if (result.data?.trinityStats !== undefined) providerDataOverrides.trinityStats = result.data.trinityStats;
        if (result.data?.intentBadge !== undefined) providerDataOverrides.intentBadge = result.data.intentBadge;
        if (result.data?.topActionUtilities !== undefined) providerDataOverrides.topActionUtilities = result.data.topActionUtilities;
    }

    const folded = foldCapabilityDecisions(foldCandidates);
    const meta: InformationResult['meta'] = {
        isForceRevealApplied: false,
        usedCapabilities: true,
        decision: folded.decision,
        blockedByHardBlock: folded.blockedByHardBlock,
        topAllowPriority: folded.topAllowPriority,
        topSoftBlockPriority: folded.topSoftBlockPriority,
        appliedProviders
    };

    if (folded.decision !== 'allow') {
        return buildResult(payload, emptyReveal(), meta);
    }

    const mergedPayload: InformationPayload = {
        ...payload,
        ...providerDataOverrides
    };
    return buildResult(mergedPayload, reveal, meta);
};

export const getActorInformationStrict = (
    state: GameState,
    viewerId: string,
    subjectId: string,
    context?: ActorInformationOptions['context']
): InformationResult => getActorInformation(state, viewerId, subjectId, { revealMode: 'strict', context });
