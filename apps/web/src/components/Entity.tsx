import React, { useState, useEffect, useRef } from 'react';
import type { Actor as EntityType, MovementTrace } from '@hop/engine';
import { isStunned, hexToPixel, getDirectionFromTo, hexEquals, TILE_SIZE, getHexLine, getEntityVisual, isEntityFlying } from '@hop/engine';
import { hasMatchingMovementTrace, resolvePlaybackPath } from './entity/entity-animation';
import { computeEntityContrastBoost, renderEntityIcon } from './entity/entity-icon';

interface EntityProps {
    entity: EntityType;
    isSpear?: boolean;
    isDying?: boolean; // For death animations
    movementTrace?: MovementTrace;
    waapiControlled?: boolean;
    assetHref?: string;
    fallbackAssetHref?: string;
    floorTheme?: string;
    visualPose?: EntityVisualPose;
}

export interface EntityVisualPose {
    offsetX?: number;
    offsetY?: number;
    scaleX?: number;
    scaleY?: number;
}

const EntityBase: React.FC<EntityProps> = ({
    entity,
    isSpear,
    isDying,
    movementTrace,
    waapiControlled = false,
    assetHref,
    fallbackAssetHref,
    floorTheme,
    visualPose
}) => {
    const [displayPos, setDisplayPos] = useState(entity.position);
    const [displayPixel, setDisplayPixel] = useState(() => hexToPixel(entity.position, TILE_SIZE));
    const [animationPrevPos, setAnimationPrevPos] = useState<EntityType['position'] | undefined>(entity.previousPosition);
    const [segmentDurationMs, setSegmentDurationMs] = useState(220);
    const [segmentEasing, setSegmentEasing] = useState('cubic-bezier(0.22, 1, 0.36, 1)');
    const [teleportPhase, setTeleportPhase] = useState<'none' | 'out' | 'in'>('none');
    const animationInProgress = useRef(false);
    const lastTargetPos = useRef(entity.position);
    const animationTimers = useRef<number[]>([]);
    const animationFrameRef = useRef<number | null>(null);

    const [isFlashing, setIsFlashing] = useState(false);
    const prevHp = useRef(entity.hp);

    const isPlayer = entity.type === 'player';
    const movementDebugEnabled = typeof window !== 'undefined' && Boolean((window as any).__HOP_DEBUG_MOVEMENT);
    const [resolvedAssetHref, setResolvedAssetHref] = useState<string | undefined>(assetHref || fallbackAssetHref);
    const [usedFallbackAsset, setUsedFallbackAsset] = useState(false);

    useEffect(() => {
        setResolvedAssetHref(assetHref || fallbackAssetHref);
        setUsedFallbackAsset(false);
    }, [assetHref, fallbackAssetHref, entity.id]);

    const handleAssetError = () => {
        if (!usedFallbackAsset && fallbackAssetHref && resolvedAssetHref !== fallbackAssetHref) {
            setResolvedAssetHref(fallbackAssetHref);
            setUsedFallbackAsset(true);
            return;
        }
        setResolvedAssetHref(undefined);
    };

    // Sequential Animation Logic
    useEffect(() => {
        const clearAnimationTimers = () => {
            for (const t of animationTimers.current) {
                clearTimeout(t);
            }
            animationTimers.current = [];
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };

        if (waapiControlled) {
            clearAnimationTimers();
            animationInProgress.current = false;
            const hasCurrentTrace = Boolean(
                movementTrace
                && movementTrace.actorId === entity.id
                && movementTrace.destination
                && hexEquals(movementTrace.destination as any, entity.position)
            );
            const moved = !hexEquals(entity.position, lastTargetPos.current);
            lastTargetPos.current = entity.position;
            // In WAAPI mode, avoid pre-snapping to reducer-final position when
            // this actor has an active movement trace in the current frame.
            if (moved && !hasCurrentTrace) {
                setDisplayPos(entity.position);
                setAnimationPrevPos(entity.previousPosition);
                setDisplayPixel(hexToPixel(entity.position, TILE_SIZE));
            }
            if (teleportPhase !== 'none') setTeleportPhase('none');
            if (segmentDurationMs !== 0) setSegmentDurationMs(0);
            if (segmentEasing !== 'linear') setSegmentEasing('linear');
            return;
        }

        if (!hexEquals(entity.position, lastTargetPos.current)) {
            // New position detected
            lastTargetPos.current = entity.position;

            const hasMatchingTrace = hasMatchingMovementTrace(movementTrace, entity.id, entity.position);
            const matchedTrace = hasMatchingTrace ? movementTrace! : undefined;
            const tracePath = matchedTrace?.path as EntityType['position'][] | undefined;
            const inferredMovementType = matchedTrace?.movementType;
            const traceStartDelayMs = matchedTrace ? Math.max(0, matchedTrace.startDelayMs ?? 0) : 0;

            if (movementDebugEnabled) {
                const fallbackPathLen = entity.previousPosition ? getHexLine(entity.previousPosition, entity.position).length : 0;
                console.log('[HOP_MOVE]', {
                    actorId: entity.id,
                    movementType: inferredMovementType || 'fallback',
                    usedEngineTrace: hasMatchingTrace,
                    tracePathLength: tracePath?.length || 0,
                    tracePath: tracePath || [],
                    startDelayMs: traceStartDelayMs,
                    fallbackPathLength: fallbackPathLen,
                    origin: movementTrace?.origin || entity.previousPosition,
                    destination: entity.position
                });
            }

            if (inferredMovementType === 'teleport' && matchedTrace?.origin) {
                clearAnimationTimers();
                animationInProgress.current = true;
                const totalDuration = matchedTrace.durationMs ?? 180;
                const halfDuration = Math.max(80, Math.floor(totalDuration / 2));

                const startTeleport = () => {
                    setSegmentDurationMs(0);
                    setSegmentEasing('linear');
                    setAnimationPrevPos(matchedTrace.origin);
                    setDisplayPos(matchedTrace.origin);
                    setDisplayPixel(hexToPixel(matchedTrace.origin, TILE_SIZE));
                    setTeleportPhase('out');

                    const t1 = window.setTimeout(() => {
                        setDisplayPos(entity.position);
                        setAnimationPrevPos(entity.position);
                        setDisplayPixel(hexToPixel(entity.position, TILE_SIZE));
                        setTeleportPhase('in');
                    }, halfDuration);
                    const t2 = window.setTimeout(() => {
                        setTeleportPhase('none');
                        animationInProgress.current = false;
                    }, halfDuration * 2);
                    animationTimers.current.push(t1, t2);
                };

                if (traceStartDelayMs > 0) {
                    const t0 = window.setTimeout(startTeleport, traceStartDelayMs);
                    animationTimers.current.push(t0);
                } else {
                    startTeleport();
                }
                return () => {
                    clearAnimationTimers();
                    animationInProgress.current = false;
                };
            }

            const hasPrevStep = !!(entity.previousPosition && !hexEquals(entity.position, entity.previousPosition));
            const hasTraceStep = !!(tracePath && tracePath.length > 1);

            if (hasTraceStep || hasPrevStep) {
                const rawPath = tracePath || (entity.previousPosition ? getHexLine(entity.previousPosition, entity.position) : []);
                const path = resolvePlaybackPath({
                    rawPath,
                    movementTraceOrigin: matchedTrace?.origin,
                    hasMatchingTrace
                });

                if (path.length > 1) {
                    clearAnimationTimers();
                    animationInProgress.current = true;
                    const segmentCount = Math.max(1, path.length - 1);
                    const tracePerSegmentMs = matchedTrace?.durationMs
                        ? matchedTrace.durationMs / segmentCount
                        : 0;
                    const perSegmentMs = Math.max(
                        90,
                        Math.min(130, tracePerSegmentMs || 112)
                    );
                    const totalDuration = perSegmentMs * segmentCount;
                    const pointsPx = path.map(p => hexToPixel(p, TILE_SIZE));
                    const startTs = performance.now();
                    const easeInOutCubic = (t: number) =>
                        t < 0.5
                            ? 4 * t * t * t
                            : 1 - Math.pow(-2 * t + 2, 3) / 2;

                    setTeleportPhase('none');
                    // Frame-driven path playback must not be re-smoothed by CSS transitions.
                    setSegmentDurationMs(0);
                    setSegmentEasing('linear');
                    setDisplayPos(path[0]);
                    setAnimationPrevPos(path[0]);
                    setDisplayPixel(pointsPx[0]);

                    let lastSegmentIndex = -1;
                    const animate = (now: number) => {
                        const elapsed = Math.max(0, now - startTs);
                        const segmentIndex = Math.min(segmentCount - 1, Math.floor(elapsed / perSegmentMs));
                        const segmentStart = segmentIndex * perSegmentMs;
                        const segmentElapsed = elapsed - segmentStart;
                        const tRaw = Math.max(0, Math.min(1, segmentElapsed / perSegmentMs));
                        const t = easeInOutCubic(tRaw);

                        if (segmentIndex !== lastSegmentIndex) {
                            setAnimationPrevPos(path[segmentIndex]);
                            setDisplayPos(path[Math.min(path.length - 1, segmentIndex + 1)]);
                            lastSegmentIndex = segmentIndex;
                        }

                        const from = pointsPx[segmentIndex];
                        const to = pointsPx[Math.min(pointsPx.length - 1, segmentIndex + 1)];
                        setDisplayPixel({
                            x: from.x + ((to.x - from.x) * t),
                            y: from.y + ((to.y - from.y) * t)
                        });

                        if (elapsed < totalDuration) {
                            animationFrameRef.current = requestAnimationFrame(animate);
                            return;
                        }

                        animationInProgress.current = false;
                        setDisplayPos(entity.position);
                        setAnimationPrevPos(entity.previousPosition);
                        setDisplayPixel(pointsPx[pointsPx.length - 1]);
                        animationFrameRef.current = null;
                    };
                    if (traceStartDelayMs > 0) {
                        const t0 = window.setTimeout(() => {
                            animationFrameRef.current = requestAnimationFrame(animate);
                        }, traceStartDelayMs);
                        animationTimers.current.push(t0);
                    } else {
                        animationFrameRef.current = requestAnimationFrame(animate);
                    }

                    return () => {
                        clearAnimationTimers();
                        animationInProgress.current = false;
                    };
                }
            }
            // Fallback for 1-tile move or no previous position
            setTeleportPhase('none');
            setSegmentDurationMs(220);
            setSegmentEasing('cubic-bezier(0.22, 1, 0.36, 1)');
            setDisplayPos(entity.position);
            setAnimationPrevPos(entity.previousPosition);
            setDisplayPixel(hexToPixel(entity.position, TILE_SIZE));
        }
    }, [entity.position, entity.previousPosition, movementTrace, entity.id, waapiControlled]);

    const { x, y } = displayPixel || hexToPixel(displayPos, TILE_SIZE);

    // Handle damage flash
    useEffect(() => {
        if (entity.hp < prevHp.current) {
            setIsFlashing(true);
            const timer = setTimeout(() => setIsFlashing(false), 150);
            return () => clearTimeout(timer);
        }
        prevHp.current = entity.hp;
    }, [entity.hp]);

    // Calculate movement stretch based on the animating previous position
    let stretchTransform = '';
    const movePrev = animationPrevPos;
    if (movePrev && !hexEquals(displayPos, movePrev)) {
        const dir = getDirectionFromTo(movePrev, displayPos);
        if (dir !== -1) {
            const angle = dir * 60;
            stretchTransform = `rotate(${angle}) scale(1.15, 0.85) rotate(${-angle})`;
        }
    }

    // Handle invisibility (assassin)
    const isInvisible = entity.isVisible === false;

    if (isSpear) {
        const spearVisual = getEntityVisual('spear', 'enemy'); // Spear is treated like an entity for visual config
        return (
            <g style={{ pointerEvents: 'none' }}>
                <g transform={`translate(${x},${y})`}>
                    <text x="0" y="0" textAnchor="middle" dy=".3em" fontSize="20" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
                        {spearVisual.icon}
                    </text>
                </g>
            </g>
        );
    }

    const visual = getEntityVisual(entity.subtype, entity.type, entity.enemyType as 'melee' | 'ranged' | 'boss', entity.archetype);
    const isFlying = isEntityFlying(entity);
    const unitIconScale = isPlayer ? 1.34 : 0.92;
    const unitIconYOffset = isPlayer ? -9 : -2;
    const unitIconSize = isPlayer ? 24 : 18;
    const contrastBoost = computeEntityContrastBoost(floorTheme);
    const baseRingStroke = isPlayer ? '#22e7ff' : 'rgba(255,120,120,0.7)';
    const baseRingFill = isPlayer ? 'rgba(34,231,255,0.20)' : 'rgba(239,68,68,0.16)';
    const ringGlow = isPlayer ? 'rgba(34,231,255,0.36)' : 'rgba(255,90,90,0.28)';
    const ringRx = isPlayer ? TILE_SIZE * 0.48 : TILE_SIZE * 0.42;
    const ringRy = isPlayer ? TILE_SIZE * 0.17 : TILE_SIZE * 0.145;
    const ringY = isPlayer ? TILE_SIZE * 0.32 : TILE_SIZE * 0.3;
    const poseOffsetX = visualPose?.offsetX ?? 0;
    const poseOffsetY = visualPose?.offsetY ?? 0;
    const poseScaleX = visualPose?.scaleX ?? 1;
    const poseScaleY = visualPose?.scaleY ?? 1;
    const hasPoseTransform = Math.abs(poseOffsetX) > 0.01
        || Math.abs(poseOffsetY) > 0.01
        || Math.abs(poseScaleX - 1) > 0.01
        || Math.abs(poseScaleY - 1) > 0.01;
    const poseTransform = hasPoseTransform
        ? `translate(${poseOffsetX},${poseOffsetY}) scale(${poseScaleX},${poseScaleY})`
        : undefined;

    return (
        <g style={{ pointerEvents: 'none' }}>
            {/* Main Entity Group - Handles smooth movement translation */}
            <g
                data-actor-node={entity.id}
                style={{
                    transition: waapiControlled ? 'none' : `transform ${segmentDurationMs}ms ${segmentEasing}`,
                    transform: `translate(${x}px, ${y}px)`
                }}
                className={isDying ? 'animate-lava-sink' : ''}
            >
                <g transform={poseTransform}>
                    {/* Visual Content Group - Handles idle animation, squash/stretch, and damage flash */}
                    <g
                        transform={stretchTransform}
                        className={`${isFlashing ? 'entity-damaged' : ''} ${!isDying && !isStunned(entity) ? 'animate-idle' : ''} ${teleportPhase === 'out' ? 'entity-teleport-out' : ''} ${teleportPhase === 'in' ? 'entity-teleport-in' : ''}`}
                        opacity={isInvisible ? 0.3 : (visual.opacity || 1)}
                        style={{ filter: isInvisible ? 'blur(1px)' : 'none' }}
                    >
                        {/* Team pad (oval, aligned with shrine marker language). */}
                        <g transform={`translate(0,${ringY})`}>
                            <ellipse
                                cx={0}
                                cy={0}
                                rx={ringRx}
                                ry={ringRy}
                                fill={baseRingFill}
                                stroke={baseRingStroke}
                                strokeWidth={2}
                                opacity={0.95}
                                style={{ filter: `drop-shadow(0 0 5px ${ringGlow})` }}
                            />
                            <ellipse
                                cx={0}
                                cy={0}
                                rx={ringRx * 1.14}
                                ry={ringRy * 1.14}
                                fill="none"
                                stroke={baseRingStroke}
                                strokeWidth={isPlayer ? 1.8 : 1.6}
                                opacity={isPlayer ? 0.62 : 0.54}
                            />
                        </g>

                        {/* Shadow if flying */}
                        {isFlying && (
                            <ellipse
                                cx={0} cy={TILE_SIZE * 0.3}
                                rx={TILE_SIZE * 0.4} ry={TILE_SIZE * 0.15}
                                fill="black" opacity={0.2}
                            />
                        )}

                        {/* SVG icon */}
                        <g transform={`translate(0,${unitIconYOffset}) scale(${unitIconScale})`}>
                            {renderEntityIcon(entity, isPlayer, unitIconSize, resolvedAssetHref, handleAssetError, contrastBoost)}
                        </g>

                        {/* Stun Icon */}
                        {isStunned(entity) && (
                            <g transform={`translate(0, -${TILE_SIZE * 0.8})`} className="stun-icon">
                                <text fontSize="14" textAnchor="middle">*</text>
                                <text fontSize="8" textAnchor="middle" dy="-3" dx="6">+</text>
                            </g>
                        )}

                        {/* Shield direction indicator */}
                        {visual.showFacing && entity.facing !== undefined && !isStunned(entity) && (
                            <line
                                x1={0}
                                y1={0}
                                x2={Math.cos((entity.facing * 60 - 90) * Math.PI / 180) * TILE_SIZE * 0.5}
                                y2={Math.sin((entity.facing * 60 - 90) * Math.PI / 180) * TILE_SIZE * 0.5}
                                stroke={visual.borderColor}
                                strokeWidth={3}
                                strokeLinecap="round"
                            />
                        )}

                        <title>{`${entity.subtype || entity.type} - HP ${entity.hp}/${entity.maxHp}${entity.intent ? ` - ${entity.intent}` : ''}`}</title>
                    </g>
                </g>
            </g>
        </g>
    );
};

const movementTraceKey = (m?: MovementTrace): string => {
    if (!m) return '';
    const pathSig = (m.path || []).map(p => `${p.q},${p.r},${p.s}`).join(';');
    return `${m.actorId}|${m.movementType || ''}|${m.destination?.q ?? ''},${m.destination?.r ?? ''},${m.destination?.s ?? ''}|${pathSig}|${m.durationMs ?? ''}|${m.startDelayMs ?? 0}|${m.wasLethal ? 1 : 0}`;
};

const statusSig = (arr: any[] = []) => arr.map(s => `${s.id}:${s.duration ?? ''}:${s.stacks ?? ''}`).join('|');

export const Entity = React.memo(EntityBase, (prev, next) => {
    const a = prev.entity;
    const b = next.entity;
    return prev.isSpear === next.isSpear
        && prev.isDying === next.isDying
        && prev.waapiControlled === next.waapiControlled
        && prev.assetHref === next.assetHref
        && prev.fallbackAssetHref === next.fallbackAssetHref
        && prev.floorTheme === next.floorTheme
        && (prev.visualPose?.offsetX ?? 0) === (next.visualPose?.offsetX ?? 0)
        && (prev.visualPose?.offsetY ?? 0) === (next.visualPose?.offsetY ?? 0)
        && (prev.visualPose?.scaleX ?? 1) === (next.visualPose?.scaleX ?? 1)
        && (prev.visualPose?.scaleY ?? 1) === (next.visualPose?.scaleY ?? 1)
        && movementTraceKey(prev.movementTrace) === movementTraceKey(next.movementTrace)
        && a.id === b.id
        && a.hp === b.hp
        && a.maxHp === b.maxHp
        && a.facing === b.facing
        && a.intent === b.intent
        && a.isVisible === b.isVisible
        && a.position.q === b.position.q
        && a.position.r === b.position.r
        && a.position.s === b.position.s
        && (a.previousPosition?.q ?? 0) === (b.previousPosition?.q ?? 0)
        && (a.previousPosition?.r ?? 0) === (b.previousPosition?.r ?? 0)
        && (a.previousPosition?.s ?? 0) === (b.previousPosition?.s ?? 0)
        && (a.intentPosition?.q ?? 0) === (b.intentPosition?.q ?? 0)
        && (a.intentPosition?.r ?? 0) === (b.intentPosition?.r ?? 0)
        && (a.intentPosition?.s ?? 0) === (b.intentPosition?.s ?? 0)
        && statusSig(a.statusEffects) === statusSig(b.statusEffects);
});

