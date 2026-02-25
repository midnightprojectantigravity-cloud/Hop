import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Point, TimelineEvent, SimulationEvent, JuiceSignaturePayloadV1 } from '@hop/engine';
import { hexToPixel, TILE_SIZE, pointToKey } from '@hop/engine';
import type { VisualAssetManifest, VisualAssetEntry } from '../visual/asset-manifest';
import { resolveFxAssetId, resolveCombatTextFrameAssetId } from '../visual/asset-selectors';
import { resolveJuiceRecipe } from '../visual/juice-resolver';

type JuiceEffectType =
    | 'basic_attack_strike'
    | 'archer_shot_signature'
    | 'impact'
    | 'combat_text'
    | 'flash'
    | 'spear_trail'
    | 'vaporize'
    | 'lava_ripple'
    | 'explosion_ring'
    | 'melee_lunge'
    | 'arrow_shot'
    | 'arcane_bolt'
    | 'kinetic_wave'
    | 'wall_crack'
    | 'dash_blur'
    | 'hidden_fade'
    | 'generic_ring'
    | 'generic_line';

type WorldPoint = { x: number; y: number };

interface JuiceEffect {
    id: string;
    type: JuiceEffectType;
    position?: Point;
    worldPosition?: WorldPoint;
    payload?: any;
    startTime: number;
    ttlMs?: number;
}

interface JuiceActorSnapshot {
    id: string;
    position: Point;
    subtype?: string;
    assetHref?: string;
    fallbackAssetHref?: string;
}

interface JuiceManagerProps {
    visualEvents: { type: string; payload: any }[];
    timelineEvents?: TimelineEvent[];
    simulationEvents?: SimulationEvent[];
    actorSnapshots?: JuiceActorSnapshot[];
    onBusyStateChange?: (busy: boolean) => void;
    assetManifest?: VisualAssetManifest | null;
}

const waitMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const resolveEventPoint = (payload: any): Point | null => {
    if (!payload) return null;
    const p = payload.position || payload.destination || payload.origin || payload.target;
    if (p && typeof p.q === 'number' && typeof p.r === 'number' && typeof p.s === 'number') {
        return p;
    }
    return null;
};

const getEffectLifetimeMs = (effect: JuiceEffect): number => {
    if (effect.ttlMs && effect.ttlMs > 0) return effect.ttlMs;
    const effectType = effect.type;
    if (effectType === 'basic_attack_strike') return 180;
    if (effectType === 'archer_shot_signature') return 170;
    if (effectType === 'impact') return 400;
    if (effectType === 'combat_text') return 1000;
    if (effectType === 'flash') return 300;
    if (effectType === 'melee_lunge') return 240;
    if (effectType === 'arrow_shot') return 260;
    if (effectType === 'arcane_bolt') return 320;
    if (effectType === 'kinetic_wave') return 520;
    if (effectType === 'wall_crack') return 700;
    if (effectType === 'dash_blur') return 320;
    if (effectType === 'hidden_fade') return 360;
    if (effectType === 'generic_ring') return 700;
    if (effectType === 'generic_line') return 280;
    if (effectType === 'spear_trail') return 500;
    if (effectType === 'vaporize') return 600;
    if (effectType === 'lava_ripple') return 800;
    if (effectType === 'explosion_ring') return 1000;
    return 2000;
};

const FX_ASSET_EFFECT_TYPES = new Set<JuiceEffectType>(['impact', 'flash', 'combat_text', 'spear_trail', 'vaporize', 'lava_ripple', 'explosion_ring']);
const TIMELINE_TIME_SCALE = 0.72;

const resolveAnchorHex = (anchor: any): Point | undefined => {
    const p = anchor?.hex;
    if (p && typeof p.q === 'number' && typeof p.r === 'number' && typeof p.s === 'number') return p as Point;
    return undefined;
};

const resolveAnchorWorld = (anchor: any): WorldPoint | undefined => {
    const p = anchor?.world;
    if (p && typeof p.x === 'number' && typeof p.y === 'number') return p as WorldPoint;
    return undefined;
};

const classifyDamageCueType = (
    sourceSubtype: string | undefined,
    reason: string,
    distancePx: number
): JuiceEffectType | null => {
    const normalizedSubtype = String(sourceSubtype || '').toLowerCase();
    const normalizedReason = String(reason || '').toLowerCase();

    if (
        normalizedReason.includes('lava')
        || normalizedReason.includes('fire')
        || normalizedReason.includes('hazard')
        || normalizedReason.includes('burn')
        || normalizedReason.includes('crush')
        || normalizedReason.includes('collision')
    ) {
        return null;
    }

    if (normalizedSubtype === 'bomber' || normalizedReason.includes('bomb') || normalizedReason.includes('explosion')) {
        return null;
    }
    if (normalizedSubtype === 'warlock' || normalizedReason.includes('arcane') || normalizedReason.includes('force') || normalizedReason.includes('spell')) {
        return 'arcane_bolt';
    }
    if (normalizedSubtype === 'archer' || normalizedReason.includes('arrow') || normalizedReason.includes('spear_throw')) {
        return 'arrow_shot';
    }
    if (distancePx <= TILE_SIZE * 2.05 || normalizedReason.includes('basic_attack') || normalizedReason.includes('melee')) {
        return 'melee_lunge';
    }
    return null;
};

export const JuiceManager: React.FC<JuiceManagerProps> = ({
    visualEvents,
    timelineEvents = [],
    simulationEvents = [],
    actorSnapshots = [],
    onBusyStateChange,
    assetManifest
}) => {
    const [effects, setEffects] = useState<JuiceEffect[]>([]);
    const processedTimelineBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedVisualBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedJuiceSignatureBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedSimulationCount = useRef(0);
    const timelineQueue = useRef<TimelineEvent[]>([]);
    const isRunningQueue = useRef(false);
    const [timelineBusy, setTimelineBusy] = useState(false);
    const prefersReducedMotion = useRef(false);
    const movementDurationByActor = useRef<Map<string, { durationMs: number; seenAt: number }>>(new Map());
    const cleanupTimerRef = useRef<number | null>(null);
    const lastEffectTickRef = useRef<number>(Date.now());
    const recentSignatureImpactByTileRef = useRef<Map<string, { at: number; signature: string }>>(new Map());
    const MAX_BLOCKING_WAIT_MS = 650;
    const MAX_QUEUE_RUNTIME_MS = 3500;
    const assetById = useMemo(() => {
        const map = new Map<string, VisualAssetEntry>();
        for (const asset of assetManifest?.assets || []) {
            map.set(asset.id, asset);
        }
        return map;
    }, [assetManifest]);
    const actorById = useMemo(() => {
        const map = new Map<string, JuiceActorSnapshot>();
        for (const actor of actorSnapshots) {
            map.set(actor.id, actor);
        }
        return map;
    }, [actorSnapshots]);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = () => { prefersReducedMotion.current = mq.matches; };
        onChange();
        mq.addEventListener?.('change', onChange);
        return () => mq.removeEventListener?.('change', onChange);
    }, []);

    useEffect(() => {
        if (!visualEvents.length) return;
        const next = new Map(movementDurationByActor.current);
        const now = Date.now();
        for (const ev of visualEvents) {
            if (ev.type !== 'kinetic_trace') continue;
            const trace = ev.payload;
            if (!trace?.actorId) continue;
            const duration = Number(trace.durationMs ?? 0);
            if (duration > 0) {
                next.set(String(trace.actorId), {
                    durationMs: duration,
                    seenAt: now
                });
            }
        }
        movementDurationByActor.current = next;
    }, [visualEvents]);

    // Notify parent of busy state.
    // Only timeline sequencing should gate turn progression; decorative effects
    // (combat text, flashes, etc.) must not hold input lock.
    useEffect(() => {
        onBusyStateChange?.(timelineBusy);
    }, [timelineBusy, onBusyStateChange]);

    const enqueueTimelineEffects = (ev: TimelineEvent) => {
        const now = Date.now();
        const position = resolveEventPoint(ev.payload);
        if (!position) return;

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

        if (additions.length > 0) {
            setEffects(prev => [...prev, ...additions]);
        }
    };

    useEffect(() => {
        if (!timelineEvents.length) return;
        if (processedTimelineBatchRef.current === timelineEvents) return;
        processedTimelineBatchRef.current = timelineEvents;
        const newEvents = timelineEvents;
        if (!newEvents.length) return;
        timelineQueue.current.push(...newEvents);

        if (isRunningQueue.current) return;
        isRunningQueue.current = true;
        setTimelineBusy(true);

        (async () => {
            try {
                const queueStart = Date.now();
                while (timelineQueue.current.length > 0) {
                    if ((Date.now() - queueStart) > MAX_QUEUE_RUNTIME_MS) {
                        console.warn('[HOP_JUICE] Timeline queue exceeded runtime budget; flushing remaining events.', {
                            queued: timelineQueue.current.length
                        });
                        break;
                    }
                    const ev = timelineQueue.current.shift()!;
                    enqueueTimelineEffects(ev);
                    let baseDuration = ev.blocking ? Math.round((ev.suggestedDurationMs ?? 140) * TIMELINE_TIME_SCALE) : 0;

                    // Movement is rendered by Entity animations using kinetic_trace.durationMs.
                    // For strict sequence fidelity, use recent movement durations only.
                    if (ev.phase === 'MOVE_END') {
                        const actorId = (ev.payload as any)?.targetActorId as string | undefined;
                        if (actorId) {
                            const traced = movementDurationByActor.current.get(actorId);
                            const isFresh = traced ? (Date.now() - traced.seenAt) <= 2500 : false;
                            if (traced && isFresh && traced.durationMs > 0) {
                                baseDuration = Math.max(
                                    baseDuration,
                                    Math.min(MAX_BLOCKING_WAIT_MS, Math.round(traced.durationMs * TIMELINE_TIME_SCALE))
                                );
                            }
                        }
                    }

                    let phaseDuration = 0;
                    if (ev.phase === 'MOVE_END') {
                        phaseDuration = Math.min(460, Math.max(70, baseDuration));
                    } else if (ev.phase === 'DEATH_RESOLVE') {
                        phaseDuration = Math.min(120, Math.max(55, baseDuration));
                    } else if (ev.phase === 'DAMAGE_APPLY') {
                        phaseDuration = Math.min(80, Math.max(35, baseDuration));
                    } else if (ev.phase === 'HAZARD_CHECK') {
                        phaseDuration = Math.min(70, Math.max(30, baseDuration));
                    } else if (ev.blocking) {
                        phaseDuration = Math.min(70, Math.max(0, baseDuration));
                    }

                    const rawWaitDuration = ev.phase === 'MOVE_END'
                        ? baseDuration
                        : (prefersReducedMotion.current
                            ? Math.min(70, Math.floor(phaseDuration * 0.5))
                            : phaseDuration);
                    const waitDuration = Math.max(0, Math.min(MAX_BLOCKING_WAIT_MS, rawWaitDuration));
                    if (waitDuration > 0) {
                        await waitMs(waitDuration);
                    }
                }
            } catch (err) {
                console.error('[HOP_JUICE] Timeline queue processing failed; releasing busy lock.', err);
            } finally {
                timelineQueue.current = [];
                isRunningQueue.current = false;
                setTimelineBusy(false);
            }
        })();
    }, [timelineEvents]);

    useEffect(() => {
        if (processedJuiceSignatureBatchRef.current === visualEvents) return;
        processedJuiceSignatureBatchRef.current = visualEvents;
        const incoming = visualEvents;
        if (!incoming.length) return;

        const now = Date.now();
        const additions: JuiceEffect[] = [];

        incoming.forEach((ev, idx) => {
            if (ev.type !== 'juice_signature') return;
            const payload = ev.payload as JuiceSignaturePayloadV1 | undefined;
            if (!payload || payload.protocol !== 'juice-signature/v1') return;

            const resolved = resolveJuiceRecipe({
                payload,
                reducedMotion: prefersReducedMotion.current
            });
            if (!resolved || resolved.recipe.rendererId === 'none') return;

            const contactHex = resolveAnchorHex(payload.contact);
            const targetHex = resolveAnchorHex(payload.target);
            const sourceHex = resolveAnchorHex(payload.source);
            const contactWorld = resolveAnchorWorld(payload.contact);
            const targetWorld = resolveAnchorWorld(payload.target);
            const sourceWorld = resolveAnchorWorld(payload.source);
            const primaryHex = contactHex || targetHex || sourceHex;
            const primaryWorld = contactWorld || targetWorld || sourceWorld;

            const base: Partial<JuiceEffect> = {
                id: `sig-${now}-${idx}`,
                startTime: now + Math.max(0, Number(payload.timing?.delayMs || 0)),
                ttlMs: resolved.ttlMs
            };

            if (
                (payload.signature === 'ATK.STRIKE.PHYSICAL.BASIC_ATTACK' || payload.signature === 'ATK.STRIKE.PHYSICAL.AUTO_ATTACK')
                && payload.phase === 'impact'
                && targetHex
            ) {
                const key = pointToKey(targetHex);
                recentSignatureImpactByTileRef.current.set(key, { at: now, signature: payload.signature });
            }

            const textValue = payload.text?.value;
            switch (resolved.recipe.rendererId) {
                case 'basic_attack_strike': {
                    if (!sourceHex || !targetHex) return;
                    additions.push({
                        ...(base as JuiceEffect),
                        type: 'basic_attack_strike',
                        position: targetHex,
                        worldPosition: contactWorld || primaryWorld,
                        payload: {
                            phase: payload.phase,
                            intensity: payload.intensity || 'medium',
                            signature: payload.signature,
                            source: sourceHex,
                            target: targetHex,
                            sourceActorId: payload.source?.actorId,
                            targetActorId: payload.target?.actorId,
                            contactWorld: contactWorld,
                            contactHex: contactHex,
                            direction: payload.direction,
                            flags: payload.flags || {}
                        }
                    });
                    return;
                }
                case 'archer_shot_signature': {
                    const endHex = targetHex || contactHex;
                    if (!sourceHex || !endHex) return;
                    additions.push({
                        ...(base as JuiceEffect),
                        type: 'archer_shot_signature',
                        position: endHex,
                        worldPosition: contactWorld || primaryWorld,
                        payload: {
                            phase: payload.phase,
                            intensity: payload.intensity || 'medium',
                            source: sourceHex,
                            target: endHex,
                            contactWorld,
                            path: payload.path || (payload.area?.kind === 'path' ? payload.area.points : undefined),
                            signature: payload.signature
                        }
                    });
                    return;
                }
                case 'impact':
                case 'flash':
                case 'lava_ripple':
                case 'explosion_ring':
                case 'kinetic_wave':
                case 'wall_crack':
                case 'hidden_fade':
                case 'generic_ring': {
                    if (!primaryHex && !primaryWorld) return;
                    additions.push({
                        ...(base as JuiceEffect),
                        type: resolved.recipe.rendererId,
                        position: primaryHex,
                        worldPosition: primaryWorld,
                        payload: {
                            signature: payload.signature,
                            color: payload.text?.color,
                            element: payload.element,
                            variant: payload.variant,
                            source: sourceHex,
                            target: targetHex
                        }
                    });
                    return;
                }
                case 'combat_text': {
                    if (!textValue || (!primaryHex && !primaryWorld)) return;
                    additions.push({
                        ...(base as JuiceEffect),
                        type: 'combat_text',
                        position: primaryHex,
                        worldPosition: primaryWorld,
                        payload: {
                            text: textValue,
                            color: payload.text?.color
                        }
                    });
                    return;
                }
                case 'spear_trail': {
                    if ((!payload.path || payload.path.length === 0) && !(payload.area?.kind === 'path')) return;
                    const path = payload.path || (payload.area?.kind === 'path' ? payload.area.points : []);
                    if (!path || path.length === 0) return;
                    additions.push({
                        ...(base as JuiceEffect),
                        type: 'spear_trail',
                        position: path[0],
                        payload: { path }
                    });
                    return;
                }
                case 'melee_lunge':
                case 'arrow_shot':
                case 'arcane_bolt':
                case 'generic_line': {
                    const endHex = targetHex || contactHex;
                    if (!endHex || !sourceHex) return;
                    additions.push({
                        ...(base as JuiceEffect),
                        type: resolved.recipe.rendererId,
                        position: endHex,
                        payload: {
                            source: sourceHex,
                            signature: payload.signature,
                            element: payload.element
                        }
                    });
                    return;
                }
                case 'dash_blur': {
                    const path = payload.path || (payload.area?.kind === 'path' ? payload.area.points : undefined);
                    if (!path || path.length < 2) return;
                    additions.push({
                        ...(base as JuiceEffect),
                        type: 'dash_blur',
                        position: path[path.length - 1],
                        payload: {
                            path,
                            source: path[0]
                        }
                    });
                    return;
                }
                default:
                    return;
            }
        });

        if (additions.length > 0) {
            setEffects(prev => [...prev, ...additions]);
        }
    }, [visualEvents]);

    // Fallback mode for legacy visual events when no timeline is present
    useEffect(() => {
        if (timelineEvents.length > 0) {
            processedVisualBatchRef.current = visualEvents;
            return;
        }
        if (processedVisualBatchRef.current === visualEvents) return;
        processedVisualBatchRef.current = visualEvents;
        const incoming = visualEvents;
        if (!incoming.length) return;

        const newEffects: JuiceEffect[] = [];
        const now = Date.now();

        incoming.forEach((ev, idx) => {
            const id = `juice-${now}-${idx}`;
            if (ev.type === 'vfx' && ev.payload?.type === 'impact') {
                if (ev.payload.position) {
                    newEffects.push({
                        id,
                        type: 'impact',
                        position: ev.payload.position,
                        startTime: now
                    });
                }
            } else if (ev.type === 'vfx' && ev.payload?.type === 'flash') {
                if (ev.payload.position) {
                    newEffects.push({
                        id,
                        type: 'flash',
                        position: ev.payload.position,
                        startTime: now
                    });
                }
            } else if (ev.type === 'vfx' && ev.payload?.type === 'spear_trail') {
                if (ev.payload.path && ev.payload.path.length > 0) {
                    newEffects.push({
                        id,
                        type: 'spear_trail',
                        position: ev.payload.path[0],
                        payload: ev.payload,
                        startTime: now
                    });
                }
            } else if (ev.type === 'vfx' && ev.payload?.type === 'vaporize') {
                if (ev.payload.position) {
                    newEffects.push({
                        id,
                        type: 'vaporize',
                        position: ev.payload.position,
                        startTime: now
                    });
                }
            } else if (ev.type === 'vfx' && ev.payload?.type === 'lava_ripple') {
                if (ev.payload.position) {
                    newEffects.push({
                        id,
                        type: 'lava_ripple',
                        position: ev.payload.position,
                        startTime: now
                    });
                }
            } else if (ev.type === 'vfx' && ev.payload?.type === 'explosion_ring') {
                if (ev.payload.position) {
                    newEffects.push({
                        id,
                        type: 'explosion_ring',
                        position: ev.payload.position,
                        startTime: now
                    });
                }
            }
        });

        if (newEffects.length > 0) {
            setEffects(prev => [...prev, ...newEffects]);
        }
    }, [visualEvents, timelineEvents.length]);

    useEffect(() => {
        if (simulationEvents.length < processedSimulationCount.current) {
            processedSimulationCount.current = 0;
        }
        const startIndex = processedSimulationCount.current;
        if (startIndex >= simulationEvents.length) return;
        const incoming = simulationEvents.slice(startIndex);
        processedSimulationCount.current = simulationEvents.length;

        const now = Date.now();
        const additions: JuiceEffect[] = [];

        incoming.forEach((ev, idx) => {
            if (ev.type !== 'DamageTaken' || !ev.position) return;
            const targetPos = ev.position;
            const sourceId = String(ev.payload?.sourceId || '');
            const source = sourceId ? actorById.get(sourceId) : undefined;
            const reason = String(ev.payload?.reason || '');
            const signatureImpact = recentSignatureImpactByTileRef.current.get(pointToKey(targetPos));
            const isStrikeSignature = signatureImpact?.signature === 'ATK.STRIKE.PHYSICAL.BASIC_ATTACK'
                || signatureImpact?.signature === 'ATK.STRIKE.PHYSICAL.AUTO_ATTACK';
            const hasFreshStrikeSignature = !!(signatureImpact && isStrikeSignature && (now - signatureImpact.at) <= 260);
            const isMeleeStrikeReason = reason.includes('basic_attack') || reason.includes('auto_attack');

            if (source?.position) {
                const fromPx = hexToPixel(source.position, TILE_SIZE);
                const toPx = hexToPixel(targetPos, TILE_SIZE);
                const distancePx = Math.hypot(toPx.x - fromPx.x, toPx.y - fromPx.y);
                const cueType = hasFreshStrikeSignature && isMeleeStrikeReason
                        ? null
                        : classifyDamageCueType(source.subtype, reason, distancePx);
                if (cueType) {
                    additions.push({
                        id: `sim-cue-${now}-${startIndex + idx}`,
                        type: cueType,
                        position: targetPos,
                        payload: {
                            source: source.position,
                            sourceSubtype: source.subtype,
                            reason
                        },
                        startTime: now
                    });
                }
            }

            if (!(hasFreshStrikeSignature && isMeleeStrikeReason)) {
                additions.push({
                    id: `sim-impact-${now}-${startIndex + idx}`,
                    type: 'impact',
                    position: targetPos,
                    startTime: now
                });
            }
        });

        if (additions.length > 0) {
            setEffects(prev => [...prev, ...additions]);
        }
    }, [simulationEvents, actorById]);

    // Cleanup finished effects
    useEffect(() => {
        if (cleanupTimerRef.current !== null) {
            window.clearTimeout(cleanupTimerRef.current);
            cleanupTimerRef.current = null;
        }

        if (effects.length === 0) return;

        const now = Date.now();
        let nextExpiryMs = Infinity;
        for (const effect of effects) {
            if (effect.startTime > now) {
                const untilStart = effect.startTime - now;
                if (untilStart > 0 && untilStart < nextExpiryMs) {
                    nextExpiryMs = untilStart;
                }
                continue;
            }
            const age = now - effect.startTime;
            const remaining = getEffectLifetimeMs(effect) - age;
            if (remaining > 0 && remaining < nextExpiryMs) {
                nextExpiryMs = remaining;
            }
        }

        if (!Number.isFinite(nextExpiryMs)) {
            setEffects([]);
            return;
        }

        const delay = Math.max(16, Math.min(180, Math.floor(nextExpiryMs)));
        cleanupTimerRef.current = window.setTimeout(() => {
            const tickNow = Date.now();
            setEffects(prev => {
                const prevTick = lastEffectTickRef.current;
                lastEffectTickRef.current = tickNow;
                const next = prev.filter(e => tickNow < (e.startTime + getEffectLifetimeMs(e)));
                if (next.length !== prev.length) return next;

                // Force a render when any queued effect crosses its scheduled start time.
                const startedAny = prev.some(e => prevTick < e.startTime && e.startTime <= tickNow);
                return startedAny ? [...prev] : prev;
            });
        }, delay);

        return () => {
            if (cleanupTimerRef.current !== null) {
                window.clearTimeout(cleanupTimerRef.current);
                cleanupTimerRef.current = null;
            }
        };
    }, [effects]);

    return (
        <g style={{ pointerEvents: 'none' }}>
            {effects.map(effect => {
                const renderNow = Date.now();
                if (renderNow < effect.startTime) return null;
                if (!effect.position && !effect.worldPosition) return null;
                const fallbackPoint = effect.position ? hexToPixel(effect.position, TILE_SIZE) : { x: 0, y: 0 };
                const x = effect.worldPosition?.x ?? fallbackPoint.x;
                const y = effect.worldPosition?.y ?? fallbackPoint.y;
                const fxAssetId = FX_ASSET_EFFECT_TYPES.has(effect.type)
                    ? resolveFxAssetId(effect.type as 'impact' | 'combat_text' | 'flash' | 'spear_trail' | 'vaporize' | 'lava_ripple' | 'explosion_ring')
                    : undefined;
                const fxAssetHref = fxAssetId ? assetById.get(fxAssetId)?.path : undefined;
                const frameAssetHref = assetById.get(resolveCombatTextFrameAssetId())?.path;

                if (effect.type === 'basic_attack_strike') {
                    const p = effect.payload || {};
                    const source = p.source as Point | undefined;
                    const target = p.target as Point | undefined;
                    const phase = String(p.phase || 'impact');
                    if (!source || !target) return null;

                    const srcPix = hexToPixel(source, TILE_SIZE);
                    const contact = (p.contactWorld && typeof p.contactWorld.x === 'number' && typeof p.contactWorld.y === 'number')
                        ? (p.contactWorld as WorldPoint)
                        : { x, y };
                    const dx = contact.x - srcPix.x;
                    const dy = contact.y - srcPix.y;
                    const dist = Math.max(1, Math.hypot(dx, dy));
                    const ux = dx / dist;
                    const uy = dy / dist;
                    const intensity = String(p.intensity || 'medium');
                    const phaseTtl = Math.max(120, Math.min(360, Number(effect.ttlMs || 180)));
                    const fxAnimDuration = `${Math.round(phaseTtl * 0.85)}ms`;
                    const impactRadius = intensity === 'extreme' ? TILE_SIZE * 0.34 : intensity === 'high' ? TILE_SIZE * 0.28 : TILE_SIZE * 0.22;

                    if (phase !== 'impact') return null;

                    const sparkStroke = intensity === 'extreme'
                        ? 'rgba(253,224,71,0.98)'
                        : intensity === 'high'
                            ? 'rgba(255,255,255,0.96)'
                            : 'rgba(226,232,240,0.95)';
                    const sparkFill = intensity === 'extreme'
                        ? 'rgba(251,191,36,0.9)'
                        : 'rgba(255,255,255,0.92)';
                    return (
                        <g key={effect.id}>
                            <g className="juice-basic-strike-spark" style={{ animationDuration: fxAnimDuration }}>
                                <circle
                                    cx={contact.x}
                                    cy={contact.y}
                                    r={impactRadius * 1.65}
                                    fill="rgba(255,255,255,0.16)"
                                    stroke="rgba(255,255,255,0.55)"
                                    strokeWidth={1.4}
                                />
                                <circle cx={contact.x} cy={contact.y} r={impactRadius * 0.62} fill={sparkFill} />
                                <circle cx={contact.x} cy={contact.y} r={impactRadius * 1.2} fill="none" stroke={sparkStroke} strokeWidth={2.4} />
                                <path
                                    d={`M ${contact.x - ux * impactRadius * 1.6} ${contact.y - uy * impactRadius * 1.6} L ${contact.x + ux * impactRadius * 1.6} ${contact.y + uy * impactRadius * 1.6}`}
                                    stroke={sparkStroke}
                                    strokeWidth={2.1}
                                    strokeLinecap="round"
                                />
                                <path
                                    d={`M ${contact.x - uy * impactRadius * 1.35} ${contact.y + ux * impactRadius * 1.35} L ${contact.x + uy * impactRadius * 1.35} ${contact.y - ux * impactRadius * 1.35}`}
                                    stroke="rgba(255,255,255,0.9)"
                                    strokeWidth={1.8}
                                    strokeLinecap="round"
                                />
                            </g>
                        </g>
                    );
                }

                if (effect.type === 'archer_shot_signature') {
                    const p = effect.payload || {};
                    const source = p.source as Point | undefined;
                    const target = p.target as Point | undefined;
                    const phase = String(p.phase || 'travel');
                    if (!source || !target) return null;

                    const from = hexToPixel(source, TILE_SIZE);
                    const targetPix = hexToPixel(target, TILE_SIZE);
                    const contact = (p.contactWorld && typeof p.contactWorld.x === 'number' && typeof p.contactWorld.y === 'number')
                        ? (p.contactWorld as WorldPoint)
                        : { x, y };
                    const end = phase === 'impact' ? contact : targetPix;
                    const dx = end.x - from.x;
                    const dy = end.y - from.y;
                    const dist = Math.max(1, Math.hypot(dx, dy));
                    const ux = dx / dist;
                    const uy = dy / dist;
                    const intensity = String(p.intensity || 'medium');

                    if (phase === 'anticipation') {
                        return (
                            <g key={effect.id} className="animate-arrow-shot" opacity={0.95}>
                                <line
                                    x1={from.x}
                                    y1={from.y}
                                    x2={targetPix.x}
                                    y2={targetPix.y}
                                    stroke="rgba(248,113,113,0.75)"
                                    strokeWidth={1.5}
                                    strokeDasharray="4 5"
                                    strokeLinecap="round"
                                />
                                <circle
                                    cx={targetPix.x}
                                    cy={targetPix.y}
                                    r={TILE_SIZE * 0.18}
                                    fill="none"
                                    stroke="rgba(254,202,202,0.9)"
                                    strokeWidth={1.5}
                                />
                            </g>
                        );
                    }

                    if (phase === 'travel') {
                        const tailLen = Math.min(dist * 0.22, TILE_SIZE * 0.75);
                        const shaftStartX = end.x - ux * tailLen;
                        const shaftStartY = end.y - uy * tailLen;
                        const headSize = 7.5;
                        const leftX = end.x - ux * headSize - uy * (headSize * 0.52);
                        const leftY = end.y - uy * headSize + ux * (headSize * 0.52);
                        const rightX = end.x - ux * headSize + uy * (headSize * 0.52);
                        const rightY = end.y - uy * headSize - ux * (headSize * 0.52);
                        return (
                            <g key={effect.id} className="animate-arrow-shot">
                                <line
                                    x1={from.x}
                                    y1={from.y}
                                    x2={end.x}
                                    y2={end.y}
                                    stroke="rgba(180,83,9,0.38)"
                                    strokeWidth={3.2}
                                    strokeLinecap="round"
                                    strokeDasharray="8 9"
                                />
                                <line
                                    x1={shaftStartX}
                                    y1={shaftStartY}
                                    x2={end.x}
                                    y2={end.y}
                                    stroke="rgba(254,240,138,0.98)"
                                    strokeWidth={2.2}
                                    strokeLinecap="round"
                                />
                                <path
                                    d={`M ${end.x} ${end.y} L ${leftX} ${leftY} M ${end.x} ${end.y} L ${rightX} ${rightY}`}
                                    stroke="rgba(255,251,235,0.98)"
                                    strokeWidth={1.9}
                                    strokeLinecap="round"
                                />
                                <circle cx={from.x} cy={from.y} r={TILE_SIZE * 0.08} fill="rgba(251,191,36,0.55)" />
                            </g>
                        );
                    }

                    const impactRadius = intensity === 'extreme' || intensity === 'high'
                        ? TILE_SIZE * 0.24
                        : TILE_SIZE * 0.19;
                    return (
                        <g key={effect.id} className="animate-impact">
                            <circle
                                cx={contact.x}
                                cy={contact.y}
                                r={impactRadius * 1.35}
                                fill="rgba(251,191,36,0.14)"
                                stroke="rgba(254,243,199,0.72)"
                                strokeWidth={1.4}
                            />
                            <line
                                x1={contact.x - ux * impactRadius * 1.6}
                                y1={contact.y - uy * impactRadius * 1.6}
                                x2={contact.x + ux * impactRadius * 1.25}
                                y2={contact.y + uy * impactRadius * 1.25}
                                stroke="rgba(255,251,235,0.95)"
                                strokeWidth={2}
                                strokeLinecap="round"
                            />
                            <path
                                d={`M ${contact.x + ux * impactRadius * 1.2} ${contact.y + uy * impactRadius * 1.2} L ${contact.x + ux * impactRadius * 1.75 - uy * impactRadius * 0.45} ${contact.y + uy * impactRadius * 1.75 + ux * impactRadius * 0.45} M ${contact.x + ux * impactRadius * 1.2} ${contact.y + uy * impactRadius * 1.2} L ${contact.x + ux * impactRadius * 1.75 + uy * impactRadius * 0.45} ${contact.y + uy * impactRadius * 1.75 - ux * impactRadius * 0.45}`}
                                stroke="rgba(254,240,138,0.9)"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                            />
                        </g>
                    );
                }

                if (effect.type === 'melee_lunge' || effect.type === 'arrow_shot' || effect.type === 'arcane_bolt' || effect.type === 'generic_line') {
                    const source = effect.payload?.source as Point | undefined;
                    if (!source) return null;
                    const from = hexToPixel(source, TILE_SIZE);
                    const dx = x - from.x;
                    const dy = y - from.y;
                    const dist = Math.max(1, Math.hypot(dx, dy));
                    const ux = dx / dist;
                    const uy = dy / dist;
                    const tailX = x - ux * Math.min(dist * 0.18, 14);
                    const tailY = y - uy * Math.min(dist * 0.18, 14);
                    const headSize = effect.type === 'arrow_shot' ? 7 : 5;
                    const leftX = x - ux * headSize - uy * (headSize * 0.55);
                    const leftY = y - uy * headSize + ux * (headSize * 0.55);
                    const rightX = x - ux * headSize + uy * (headSize * 0.55);
                    const rightY = y - uy * headSize - ux * (headSize * 0.55);

                    if (effect.type === 'melee_lunge') {
                        return (
                            <g key={effect.id} className="animate-melee-lunge">
                                <line
                                    x1={from.x}
                                    y1={from.y}
                                    x2={tailX}
                                    y2={tailY}
                                    stroke="rgba(255,255,255,0.35)"
                                    strokeWidth={5}
                                    strokeLinecap="round"
                                />
                                <line
                                    x1={tailX}
                                    y1={tailY}
                                    x2={x}
                                    y2={y}
                                    stroke="rgba(255,255,255,0.85)"
                                    strokeWidth={3}
                                    strokeLinecap="round"
                                />
                            </g>
                        );
                    }

                    if (effect.type === 'arrow_shot' || effect.type === 'generic_line') {
                        const lineStroke = effect.type === 'generic_line'
                            ? 'rgba(255,255,255,0.85)'
                            : 'rgba(253,230,138,0.9)';
                        const headStroke = effect.type === 'generic_line'
                            ? 'rgba(255,255,255,0.9)'
                            : 'rgba(254,243,199,0.95)';
                        return (
                            <g key={effect.id} className={effect.type === 'generic_line' ? 'animate-melee-lunge' : 'animate-arrow-shot'}>
                                <line
                                    x1={from.x}
                                    y1={from.y}
                                    x2={x}
                                    y2={y}
                                    stroke={lineStroke}
                                    strokeWidth={effect.type === 'generic_line' ? 2 : 2.5}
                                    strokeLinecap="round"
                                    strokeDasharray={effect.type === 'generic_line' ? '6 6' : '10 8'}
                                />
                                <path
                                    d={`M ${x} ${y} L ${leftX} ${leftY} M ${x} ${y} L ${rightX} ${rightY}`}
                                    stroke={headStroke}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                />
                            </g>
                        );
                    }

                    return (
                        <g key={effect.id} className="animate-arcane-bolt">
                            <line
                                x1={from.x}
                                y1={from.y}
                                x2={x}
                                y2={y}
                                stroke="rgba(34,211,238,0.92)"
                                strokeWidth={4}
                                strokeLinecap="round"
                                strokeDasharray="12 10"
                            />
                            <line
                                x1={from.x}
                                y1={from.y}
                                x2={x}
                                y2={y}
                                stroke="rgba(207,250,254,0.85)"
                                strokeWidth={1.8}
                                strokeLinecap="round"
                            />
                            <circle cx={x} cy={y} r={TILE_SIZE * 0.22} fill="rgba(34,211,238,0.35)" />
                        </g>
                    );
                }

                if (effect.type === 'kinetic_wave' || effect.type === 'generic_ring') {
                    const stroke = effect.type === 'kinetic_wave'
                        ? 'rgba(125,211,252,0.9)'
                        : 'rgba(255,255,255,0.7)';
                    const fill = effect.type === 'kinetic_wave'
                        ? 'rgba(56,189,248,0.14)'
                        : 'rgba(255,255,255,0.08)';
                    return (
                        <g key={effect.id} className="animate-explosion-ring">
                            <circle
                                cx={x}
                                cy={y}
                                r={TILE_SIZE * (effect.type === 'kinetic_wave' ? 1.5 : 1.1)}
                                fill={fill}
                                stroke={stroke}
                                strokeWidth={effect.type === 'kinetic_wave' ? 3 : 2}
                                strokeDasharray={effect.type === 'kinetic_wave' ? '10 6' : '6 4'}
                            />
                        </g>
                    );
                }

                if (effect.type === 'wall_crack') {
                    const p = effect.payload || {};
                    const source = p.source as Point | undefined;
                    const target = p.target as Point | undefined;
                    const angle = source && target
                        ? Math.atan2(hexToPixel(target, TILE_SIZE).y - hexToPixel(source, TILE_SIZE).y, hexToPixel(target, TILE_SIZE).x - hexToPixel(source, TILE_SIZE).x)
                        : 0;
                    const len = TILE_SIZE * 0.32;
                    const perp = angle + Math.PI / 2;
                    const x1 = x - Math.cos(angle) * len;
                    const y1 = y - Math.sin(angle) * len;
                    const x2 = x + Math.cos(angle) * len;
                    const y2 = y + Math.sin(angle) * len;
                    return (
                        <g key={effect.id} className="animate-impact">
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.95)" strokeWidth={2.2} strokeLinecap="round" />
                            <line x1={x - Math.cos(perp) * len * 0.8} y1={y - Math.sin(perp) * len * 0.8} x2={x + Math.cos(perp) * len * 0.8} y2={y + Math.sin(perp) * len * 0.8} stroke="rgba(147,197,253,0.9)" strokeWidth={1.7} strokeLinecap="round" />
                            <circle cx={x} cy={y} r={3.5} fill="rgba(255,255,255,0.9)" />
                        </g>
                    );
                }

                if (effect.type === 'dash_blur') {
                    const path = effect.payload?.path as Point[] | undefined;
                    if (!path || path.length < 2) return null;
                    const points = path.map(p => {
                        const pix = hexToPixel(p, TILE_SIZE);
                        return `${pix.x},${pix.y}`;
                    }).join(' ');
                    return (
                        <polyline
                            key={effect.id}
                            points={points}
                            fill="none"
                            stroke="rgba(255,255,255,0.4)"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="animate-arrow-shot"
                            opacity={0.6}
                        />
                    );
                }

                if (effect.type === 'hidden_fade') {
                    return (
                        <g key={effect.id} className="animate-flash">
                            <circle cx={x} cy={y} r={TILE_SIZE * 0.78} fill="rgba(168,85,247,0.16)" stroke="rgba(196,181,253,0.75)" strokeWidth={2} />
                            <circle cx={x} cy={y} r={TILE_SIZE * 0.34} fill="rgba(30,27,75,0.35)" />
                        </g>
                    );
                }

                if (effect.type === 'impact') {
                    if (fxAssetHref) {
                        return (
                            <image
                                key={effect.id}
                                href={fxAssetHref}
                                x={x - TILE_SIZE * 0.75}
                                y={y - TILE_SIZE * 0.75}
                                width={TILE_SIZE * 1.5}
                                height={TILE_SIZE * 1.5}
                                preserveAspectRatio="xMidYMid meet"
                                className="animate-impact"
                                opacity="0.9"
                            />
                        );
                    }
                    return (
                        <circle
                            key={effect.id}
                            cx={x}
                            cy={y}
                            r={TILE_SIZE * 0.5}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="2"
                            className="animate-impact"
                        />
                    );
                }

                if (effect.type === 'combat_text') {
                    const textValue = String(effect.payload.text || '');
                    const color = effect.payload.color
                        || (textValue.startsWith('-') ? '#fb7185' : '#86efac');

                    return (
                        <g key={effect.id} transform={`translate(${x}, ${y - 10})`}>
                            {frameAssetHref && (
                                <image
                                    href={frameAssetHref}
                                    x={-46}
                                    y={-24}
                                    width={92}
                                    height={24}
                                    preserveAspectRatio="xMidYMid meet"
                                    opacity="0.78"
                                />
                            )}
                            <text
                                textAnchor="middle"
                                fill={color}
                                fontSize="16"
                                fontWeight="black"
                                className="animate-float-up"
                                style={{
                                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
                                    paintOrder: 'stroke',
                                    stroke: '#000',
                                    strokeWidth: '4px'
                                }}
                            >
                                {textValue}
                            </text>
                        </g>
                    );
                }

                if (effect.type === 'flash') {
                    return (
                        <circle
                            key={effect.id}
                            cx={x}
                            cy={y}
                            r={TILE_SIZE * 2}
                            fill="#ffffff"
                            className="animate-flash"
                        />
                    );
                }

                if (effect.type === 'spear_trail') {
                    const path = effect.payload.path as Point[];
                    const points = path.map(p => {
                        const pix = hexToPixel(p, TILE_SIZE);
                        return `${pix.x},${pix.y}`;
                    }).join(' ');

                    return (
                        <polyline
                            key={effect.id}
                            points={points}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="4"
                            strokeLinecap="round"
                            className="animate-spear-trail"
                        />
                    );
                }

                if (effect.type === 'vaporize') {
                    if (fxAssetHref) {
                        return (
                            <image
                                key={effect.id}
                                href={fxAssetHref}
                                x={x - TILE_SIZE * 0.95}
                                y={y - TILE_SIZE * 0.95}
                                width={TILE_SIZE * 1.9}
                                height={TILE_SIZE * 1.9}
                                preserveAspectRatio="xMidYMid meet"
                                className="animate-vaporize"
                                opacity="0.9"
                            />
                        );
                    }
                    return (
                        <g key={effect.id}>
                            <circle
                                cx={x}
                                cy={y}
                                r={TILE_SIZE * 0.6}
                                fill="#f97316"
                                className="animate-vaporize"
                                opacity="0.8"
                            />
                            <circle
                                cx={x}
                                cy={y}
                                r={TILE_SIZE * 1.2}
                                fill="none"
                                stroke="#f97316"
                                strokeWidth="2"
                                className="animate-ping"
                            />
                        </g>
                    );
                }

                if (effect.type === 'lava_ripple') {
                    if (fxAssetHref) {
                        return (
                            <image
                                key={effect.id}
                                href={fxAssetHref}
                                x={x - TILE_SIZE}
                                y={y - TILE_SIZE}
                                width={TILE_SIZE * 2}
                                height={TILE_SIZE * 2}
                                preserveAspectRatio="xMidYMid meet"
                                className="animate-ping"
                                opacity="0.85"
                            />
                        );
                    }
                    return (
                        <circle
                            key={effect.id}
                            cx={x}
                            cy={y}
                            r={TILE_SIZE * 0.8}
                            fill="none"
                            stroke="#ea580c"
                            strokeWidth="3"
                            className="animate-ping"
                        />
                    );
                }

                if (effect.type === 'explosion_ring') {
                    if (fxAssetHref) {
                        return (
                            <image
                                key={effect.id}
                                href={fxAssetHref}
                                x={x - TILE_SIZE * 1.35}
                                y={y - TILE_SIZE * 1.35}
                                width={TILE_SIZE * 2.7}
                                height={TILE_SIZE * 2.7}
                                preserveAspectRatio="xMidYMid meet"
                                className="animate-explosion-ring"
                                opacity="0.88"
                            />
                        );
                    }
                    return (
                        <circle
                            key={effect.id}
                            cx={x}
                            cy={y}
                            r={TILE_SIZE * 2.5}
                            fill="rgba(255, 120, 0, 0.2)"
                            stroke="#ffaa00"
                            strokeWidth="4"
                            className="animate-explosion-ring"
                        />
                    );
                }

                return null;
            })}
        </g>
    );
}
