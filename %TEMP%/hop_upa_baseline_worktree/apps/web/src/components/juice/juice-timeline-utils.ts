import type { TimelineEvent } from '@hop/engine';
import type { JuiceEffect } from './juice-types';
import { resolveEventPoint, TIMELINE_TIME_SCALE } from './juice-manager-utils';

export const MAX_BLOCKING_WAIT_MS = 650;
export const MAX_QUEUE_RUNTIME_MS = 3500;

export const buildTimelinePhaseEffects = (ev: TimelineEvent, now: number): JuiceEffect[] => {
    const position = resolveEventPoint(ev.payload);
    if (!position) return [];

    const additions: JuiceEffect[] = [];
    const effectId = `${ev.id}:${now}`;

    if (ev.phase === 'HAZARD_CHECK') {
        additions.push({
            id: `${effectId}:haz`,
            type: 'combat_text',
            position,
            payload: { text: '!' },
            startTime: now
        });
    } else if (ev.phase === 'DEATH_RESOLVE') {
        additions.push({
            id: `${effectId}:vapor`,
            type: 'vaporize',
            position,
            startTime: now
        });
    }

    return additions;
};

export const resolveTimelineBaseDuration = (
    ev: TimelineEvent,
    movementDurationByActor: Map<string, { durationMs: number; seenAt: number }>,
    now: number
): number => {
    let baseDuration = ev.blocking ? Math.round((ev.suggestedDurationMs ?? 140) * TIMELINE_TIME_SCALE) : 0;

    if (ev.phase !== 'MOVE_END') return baseDuration;

    const actorId = (ev.payload as any)?.targetActorId as string | undefined;
    if (!actorId) return baseDuration;
    const traced = movementDurationByActor.get(actorId);
    const isFresh = traced ? (now - traced.seenAt) <= 2500 : false;
    if (!traced || !isFresh || traced.durationMs <= 0) return baseDuration;

    return Math.max(
        baseDuration,
        Math.min(MAX_BLOCKING_WAIT_MS, Math.round(traced.durationMs * TIMELINE_TIME_SCALE))
    );
};

export const resolveTimelinePhaseDuration = (ev: TimelineEvent, baseDuration: number): number => {
    if (ev.phase === 'MOVE_END') {
        return Math.min(460, Math.max(70, baseDuration));
    }
    if (ev.phase === 'DEATH_RESOLVE') {
        return Math.min(120, Math.max(55, baseDuration));
    }
    if (ev.phase === 'DAMAGE_APPLY') {
        return Math.min(80, Math.max(35, baseDuration));
    }
    if (ev.phase === 'HAZARD_CHECK') {
        return Math.min(70, Math.max(30, baseDuration));
    }
    if (ev.blocking) {
        return Math.min(70, Math.max(0, baseDuration));
    }
    return 0;
};

export const resolveTimelineWaitDuration = (
    ev: TimelineEvent,
    baseDuration: number,
    phaseDuration: number,
    reducedMotion: boolean
): number => {
    const rawWaitDuration = ev.phase === 'MOVE_END'
        ? baseDuration
        : (reducedMotion
            ? Math.min(70, Math.floor(phaseDuration * 0.5))
            : phaseDuration);
    return Math.max(0, Math.min(MAX_BLOCKING_WAIT_MS, rawWaitDuration));
};

