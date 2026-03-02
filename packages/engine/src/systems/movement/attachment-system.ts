import { hexEquals } from '../../hex';
import type { Actor, AtomicEffect, GameState, Point } from '../../types';
import type { StatusID } from '../../types/registry';
import {
    getComponent,
    removeComponent,
    setComponent,
    type AttachmentComponent,
    type AttachmentLink,
    type AttachmentMode
} from '../components';

export type AttachmentBreakReason = 'manual_release' | 'obstacle_break' | 'damage_break' | 'status_break' | 'system';

export interface AttachActorsOptions {
    mode?: AttachmentMode;
    sharedVectorScale?: number;
    breakOnDamage?: boolean;
    breakOnStatuses?: StatusID[];
}

export interface AttachmentPropagationPlan {
    counterpartId: string;
    linkId: string;
    expectedDestination: Point;
    effect: Extract<AtomicEffect, { type: 'Displacement' }>;
}

const getActorById = (state: GameState, actorId: string): Actor | undefined => {
    if (state.player.id === actorId) return state.player;
    return state.enemies.find(e => e.id === actorId) || state.companions?.find(e => e.id === actorId);
};

const updateActorById = (state: GameState, actorId: string, updater: (actor: Actor) => Actor): GameState => {
    if (state.player.id === actorId) {
        return { ...state, player: updater(state.player) };
    }
    return {
        ...state,
        enemies: state.enemies.map(e => e.id === actorId ? updater(e) : e),
        companions: state.companions?.map(e => e.id === actorId ? updater(e) : e)
    };
};

const normalizeStatusList = (statuses: StatusID[] | undefined): StatusID[] =>
    Array.from(new Set(statuses || []));

const normalizeSharedVectorScale = (scale: number | undefined): number => {
    if (!Number.isFinite(scale)) return 1;
    return Math.max(0, Number(scale));
};

const buildLinkId = (anchorId: string, attachedId: string, mode: AttachmentMode): string =>
    `link:${anchorId}->${attachedId}:${mode}`;

const getAttachmentComponent = (actor: Actor): AttachmentComponent | undefined =>
    getComponent<AttachmentComponent>(actor.components, 'attachment');

const setActorLinks = (actor: Actor, links: AttachmentLink[]): Actor => {
    let components = actor.components;
    if (links.length > 0) {
        components = setComponent(components, { type: 'attachment', links });
    } else {
        components = removeComponent(components, 'attachment');
    }
    return { ...actor, components };
};

const upsertLink = (links: AttachmentLink[], link: AttachmentLink): AttachmentLink[] => {
    const filtered = links.filter(l => l.id !== link.id && l.counterpartId !== link.counterpartId);
    return [...filtered, link];
};

export const getActorAttachmentLinks = (state: GameState, actorId: string): AttachmentLink[] => {
    const actor = getActorById(state, actorId);
    if (!actor) return [];
    return getAttachmentComponent(actor)?.links || [];
};

export const attachActors = (
    state: GameState,
    anchorId: string,
    attachedId: string,
    options: AttachActorsOptions = {}
): GameState => {
    if (anchorId === attachedId) return state;
    const anchor = getActorById(state, anchorId);
    const attached = getActorById(state, attachedId);
    if (!anchor || !attached) return state;

    const mode: AttachmentMode = options.mode || 'tow';
    const linkId = buildLinkId(anchorId, attachedId, mode);
    const sharedVectorScale = normalizeSharedVectorScale(options.sharedVectorScale);
    const breakOnDamage = options.breakOnDamage ?? true;
    const breakOnStatuses = normalizeStatusList(options.breakOnStatuses);

    const anchorLink: AttachmentLink = {
        id: linkId,
        counterpartId: attachedId,
        role: 'anchor',
        mode,
        sharedVectorScale,
        breakOnDamage,
        breakOnStatuses
    };
    const attachedLink: AttachmentLink = {
        ...anchorLink,
        counterpartId: anchorId,
        role: 'attached'
    };

    const anchorLinks = getAttachmentComponent(anchor)?.links || [];
    const attachedLinks = getAttachmentComponent(attached)?.links || [];

    let nextState = updateActorById(state, anchorId, actor =>
        setActorLinks(actor, upsertLink(anchorLinks, anchorLink))
    );
    nextState = updateActorById(nextState, attachedId, actor =>
        setActorLinks(actor, upsertLink(attachedLinks, attachedLink))
    );
    return nextState;
};

export interface ReleaseAttachmentOptions {
    counterpartId?: string;
    linkId?: string;
}

export const releaseAttachment = (
    state: GameState,
    actorId: string,
    options: ReleaseAttachmentOptions = {}
): GameState => {
    const actor = getActorById(state, actorId);
    if (!actor) return state;
    const links = getAttachmentComponent(actor)?.links || [];
    if (links.length === 0) return state;

    const toRemove = links.filter(link => {
        if (options.linkId) return link.id === options.linkId;
        if (options.counterpartId) return link.counterpartId === options.counterpartId;
        return true;
    });
    if (toRemove.length === 0) return state;

    const removeIds = new Set(toRemove.map(link => link.id));
    const removeCounterpartIds = new Set(toRemove.map(link => link.counterpartId));

    let nextState = updateActorById(state, actorId, current => {
        const nextLinks = (getAttachmentComponent(current)?.links || []).filter(link => !removeIds.has(link.id));
        return setActorLinks(current, nextLinks);
    });

    for (const counterpartId of removeCounterpartIds) {
        nextState = updateActorById(nextState, counterpartId, counterpart => {
            const nextLinks = (getAttachmentComponent(counterpart)?.links || []).filter(link => {
                if (!removeIds.has(link.id)) return true;
                return link.counterpartId !== actorId;
            });
            return setActorLinks(counterpart, nextLinks);
        });
    }

    return nextState;
};

export const buildAttachmentPropagationPlans = (
    state: GameState,
    actorId: string,
    origin: Point,
    destination: Point,
    visited: Set<string>
): AttachmentPropagationPlan[] => {
    if (hexEquals(origin, destination)) return [];
    const delta = {
        q: destination.q - origin.q,
        r: destination.r - origin.r,
        s: destination.s - origin.s
    };

    const plans: AttachmentPropagationPlan[] = [];
    for (const link of getActorAttachmentLinks(state, actorId)) {
        if (visited.has(link.counterpartId)) continue;
        const counterpart = getActorById(state, link.counterpartId);
        if (!counterpart) continue;

        const scale = normalizeSharedVectorScale(link.sharedVectorScale);
        const scaledDelta = {
            q: Math.round(delta.q * scale),
            r: Math.round(delta.r * scale),
            s: Math.round(delta.s * scale)
        };

        if (scaledDelta.q === 0 && scaledDelta.r === 0 && scaledDelta.s === 0) continue;

        const expectedDestination = {
            q: counterpart.position.q + scaledDelta.q,
            r: counterpart.position.r + scaledDelta.r,
            s: counterpart.position.s + scaledDelta.s
        };

        plans.push({
            counterpartId: counterpart.id,
            linkId: link.id,
            expectedDestination,
            effect: {
                type: 'Displacement',
                target: counterpart.id,
                source: counterpart.position,
                destination: expectedDestination,
                simulatePath: true
            }
        });
    }
    return plans;
};

export const buildDamageBreakReleaseEffects = (
    state: GameState,
    actorId: string
): Array<Extract<AtomicEffect, { type: 'ReleaseAttachment' }>> =>
    getActorAttachmentLinks(state, actorId)
        .filter(link => link.breakOnDamage)
        .map(link => ({
            type: 'ReleaseAttachment',
            actor: actorId,
            counterpartId: link.counterpartId,
            reason: 'damage_break' as const
        }));

export const buildStatusBreakReleaseEffects = (
    state: GameState,
    actorId: string,
    status: StatusID
): Array<Extract<AtomicEffect, { type: 'ReleaseAttachment' }>> =>
    getActorAttachmentLinks(state, actorId)
        .filter(link => link.breakOnStatuses.includes(status))
        .map(link => ({
            type: 'ReleaseAttachment',
            actor: actorId,
            counterpartId: link.counterpartId,
            reason: 'status_break' as const
        }));
