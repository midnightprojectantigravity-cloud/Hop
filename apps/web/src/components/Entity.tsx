import React, { useState, useEffect, useRef } from 'react';
import type { Actor as EntityType, MovementTrace } from '@hop/engine';
import { isStunned, hexToPixel, getDirectionFromTo, hexEquals, TILE_SIZE, getHexLine, getEntityVisual, isEntityFlying } from '@hop/engine';

interface EntityProps {
    entity: EntityType;
    isSpear?: boolean;
    isDying?: boolean; // For death animations
    movementTrace?: MovementTrace;
}


const renderIcon = (entity: EntityType, isPlayer: boolean, size = 24) => {
    const visual = getEntityVisual(entity.subtype, entity.type, entity.enemyType as 'melee' | 'ranged' | 'boss', entity.archetype);
    const { icon, shape, color, borderColor, size: sizeMult = 1.0 } = visual;
    const finalSize = size * sizeMult;
    const bombFuse = entity.statusEffects?.find(s => s.type === 'time_bomb');
    const bombTimer = bombFuse ? Math.max(0, bombFuse.duration) : (entity.actionCooldown ?? 0);

    return (
        <g>
            <title>{isPlayer ? 'Player' : `${entity.subtype || 'Enemy'}`}</title>
            {shape === 'square' && (
                <rect x={-finalSize * 0.8} y={-finalSize * 0.8} width={finalSize * 1.6} height={finalSize * 1.6} fill={color} stroke={borderColor} strokeWidth={2} />
            )}
            {shape === 'diamond' && (
                <path d={`M0 ${-finalSize * 0.8} L${finalSize * 0.6} 0 L0 ${finalSize * 0.8} L${-finalSize * 0.6} 0 Z`} fill={color} stroke={borderColor} strokeWidth={1} />
            )}
            {shape === 'triangle' && (
                <path d={`M0 ${-finalSize * 0.8} L${finalSize * 0.7} ${finalSize * 0.5} L${-finalSize * 0.7} ${finalSize * 0.5} Z`} fill={color} stroke={borderColor} strokeWidth={1} />
            )}
            {shape === 'circle' && (
                <circle r={finalSize * 0.7} fill={color} stroke={borderColor} strokeWidth={1} />
            )}

            {/* Special overlays */}
            {entity.subtype === 'bomb' && (
                <text y={finalSize * 0.2} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">
                    {bombTimer}
                </text>
            )}

            {/* Icon/Emoji */}
            {!isPlayer && entity.subtype !== 'bomb' && (
                <text x="0" y="0" textAnchor="middle" dy=".3em" fontSize={finalSize * 0.8} opacity={0.8}>
                    {icon}
                </text>
            )}

            {isPlayer && (
                <path d={`M0 ${-finalSize * 0.4} L0 ${finalSize * 0.4} M${-finalSize * 0.15} ${-finalSize * 0.2} L0 ${-finalSize * 0.5} L${finalSize * 0.15} ${-finalSize * 0.2}`} stroke={borderColor} strokeWidth={2} fill="none" />
            )}
        </g>
    );
};

const EntityBase: React.FC<EntityProps> = ({ entity, isSpear, isDying, movementTrace }) => {
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
    const targetPixel = entity.intentPosition ? hexToPixel(entity.intentPosition, TILE_SIZE) : null;
    const movementDebugEnabled = typeof window !== 'undefined' && Boolean((window as any).__HOP_DEBUG_MOVEMENT);

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

        if (!hexEquals(entity.position, lastTargetPos.current)) {
            // New position detected
            lastTargetPos.current = entity.position;

            const hasMatchingTrace = movementTrace
                && movementTrace.actorId === entity.id
                && movementTrace.destination
                && hexEquals(movementTrace.destination as any, entity.position)
                && Array.isArray(movementTrace.path)
                && movementTrace.path.length > 0;
            const tracePath = hasMatchingTrace
                ? movementTrace.path as EntityType['position'][]
                : undefined;

            const inferredMovementType = hasMatchingTrace
                ? movementTrace.movementType
                : undefined;
            const traceStartDelayMs = hasMatchingTrace ? Math.max(0, movementTrace.startDelayMs ?? 0) : 0;

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

            if (inferredMovementType === 'teleport' && hasMatchingTrace && movementTrace.origin) {
                clearAnimationTimers();
                animationInProgress.current = true;
                const totalDuration = movementTrace.durationMs ?? 180;
                const halfDuration = Math.max(80, Math.floor(totalDuration / 2));

                const startTeleport = () => {
                    setSegmentDurationMs(0);
                    setSegmentEasing('linear');
                    setAnimationPrevPos(movementTrace.origin);
                    setDisplayPos(movementTrace.origin);
                    setDisplayPixel(hexToPixel(movementTrace.origin, TILE_SIZE));
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
                let path = rawPath;
                if (
                    hasMatchingTrace
                    && movementTrace?.origin
                    && path.length > 1
                    && hexEquals(path[path.length - 1], movementTrace.origin)
                    && !hexEquals(path[0], movementTrace.origin)
                ) {
                    path = [...path].reverse();
                }

                if (path.length > 1) {
                    clearAnimationTimers();
                    animationInProgress.current = true;
                    const segmentCount = Math.max(1, path.length - 1);
                    const tracePerSegmentMs = movementTrace?.durationMs
                        ? movementTrace.durationMs / segmentCount
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
    }, [entity.position, entity.previousPosition, movementTrace, entity.id]);

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

    return (
        <g style={{ pointerEvents: 'none' }}>
            {/* Intent Line */}
            {targetPixel && !isPlayer && !isStunned(entity) && (
                <line
                    x1={x}
                    y1={y}
                    x2={targetPixel.x}
                    y2={targetPixel.y}
                    stroke={entity.subtype === 'warlock' ? '#9333ea' : '#ef4444'}
                    strokeWidth="3"
                    strokeDasharray="4 2"
                    opacity="0.6"
                />
            )}

            {/* Main Entity Group - Handles smooth movement translation */}
            <g
                style={{
                    transition: `transform ${segmentDurationMs}ms ${segmentEasing}`,
                    transform: `translate(${x}px, ${y}px)`
                }}
                className={isDying ? 'animate-lava-sink' : ''}
            >
                {/* Visual Content Group - Handles idle animation, squash/stretch, and damage flash */}
                <g
                    transform={stretchTransform}
                    className={`${isFlashing ? 'entity-damaged' : ''} ${!isDying && !isStunned(entity) ? 'animate-idle' : ''} ${teleportPhase === 'out' ? 'entity-teleport-out' : ''} ${teleportPhase === 'in' ? 'entity-teleport-in' : ''}`}
                    opacity={isInvisible ? 0.3 : (visual.opacity || 1)}
                    style={{ filter: isInvisible ? 'blur(1px)' : 'none' }}
                >
                    {/* subtle background circle */}
                    <circle r={TILE_SIZE * 0.9} fill={isPlayer ? 'rgba(139,94,52,0.06)' : 'rgba(184,20,20,0.06)'} opacity={1} />

                    {/* Shadow if flying */}
                    {isFlying && (
                        <ellipse
                            cx={0} cy={TILE_SIZE * 0.3}
                            rx={TILE_SIZE * 0.4} ry={TILE_SIZE * 0.15}
                            fill="black" opacity={0.2}
                        />
                    )}

                    {/* SVG icon */}
                    <g transform="translate(0,-2) scale(0.9)">
                        {renderIcon(entity, isPlayer, 18)}
                    </g>

                    {/* Stun Icon */}
                    {isStunned(entity) && (
                        <g transform={`translate(0, -${TILE_SIZE * 0.8})`} className="stun-icon">
                            <text fontSize="14" textAnchor="middle">⭐</text>
                            <text fontSize="8" textAnchor="middle" dy="-3" dx="6">✨</text>
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

                    {/* Intent label for enemies */}
                    {!isPlayer && entity.intent && !isStunned(entity) && (
                        <text x={0} y={-TILE_SIZE * 0.6} textAnchor="middle" fontSize={8} fill="#ef4444" fontWeight="bold">
                            {entity.intent}
                        </text>
                    )}
                    <title>{`${entity.subtype || entity.type} — HP ${entity.hp}/${entity.maxHp}${entity.intent ? ` — ${entity.intent}` : ''}`}</title>
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
