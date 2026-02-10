import React, { useState, useEffect, useRef } from 'react';
import type { Actor as EntityType, MovementTrace } from '@hop/engine';
import { isStunned, hexToPixel, getDirectionFromTo, hexEquals, TILE_SIZE, getHexLine, getEntityVisual, isEntityFlying } from '@hop/engine';
import { resolveMovementPath } from './movement-path';

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
                    {entity.actionCooldown ?? 0}
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

export const Entity: React.FC<EntityProps> = ({ entity, isSpear, isDying, movementTrace }) => {
    const [displayPos, setDisplayPos] = useState(entity.position);
    const [displayPixel, setDisplayPixel] = useState(() => hexToPixel(entity.position, TILE_SIZE));
    const [animationPrevPos, setAnimationPrevPos] = useState<EntityType['position'] | undefined>(entity.previousPosition);
    const [teleportPhase, setTeleportPhase] = useState<'none' | 'out' | 'in'>('none');
    const animationInProgress = useRef(false);
    const lastCompletedMoveSignature = useRef<string>('');
    const animationTimers = useRef<number[]>([]);
    const animationFrameRef = useRef<number | null>(null);
    const movementEffectRunRef = useRef(0);

    const [isFlashing, setIsFlashing] = useState(false);
    const prevHp = useRef(entity.hp);

    const isPlayer = entity.type === 'player';
    const targetPixel = entity.intentPosition ? hexToPixel(entity.intentPosition, TILE_SIZE) : null;
    const movementDebugEnabled = typeof window !== 'undefined' && Boolean((window as any).__HOP_DEBUG_MOVEMENT);
    const movementDebugVisualEnabled = typeof window !== 'undefined' && Boolean((window as any).__HOP_DEBUG_MOVEMENT_VISUAL);
    const movementTraceSignature = movementTrace
        ? `${movementTrace.actorId}|${movementTrace.movementType || ''}|${movementTrace.destination?.q ?? ''},${movementTrace.destination?.r ?? ''},${movementTrace.destination?.s ?? ''}|${(movementTrace.path || []).map(p => `${p.q},${p.r},${p.s}`).join(';')}`
        : '';

    // Sequential Animation Logic
    useEffect(() => {
        const effectRunId = ++movementEffectRunRef.current;
        const effectStartedAt = performance.now();

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

        const resolvedPath = resolveMovementPath(entity, movementTrace);
        const hasMatchingTrace = resolvedPath.hasMatchingTrace;
        const tracePath = resolvedPath.source === 'trace'
            ? resolvedPath.path as EntityType['position'][]
            : undefined;
        const inferredMovementType = resolvedPath.movementType;

        const fallbackMoveSignature = entity.previousPosition && !hexEquals(entity.previousPosition, entity.position)
            ? `${entity.id}|fallback|${entity.previousPosition.q},${entity.previousPosition.r},${entity.previousPosition.s}->${entity.position.q},${entity.position.r},${entity.position.s}`
            : '';
        const moveSignature = hasMatchingTrace ? `trace|${movementTraceSignature}` : fallbackMoveSignature;

        if (moveSignature && moveSignature !== lastCompletedMoveSignature.current) {

            if (movementDebugEnabled) {
                const fallbackPathLen = entity.previousPosition ? getHexLine(entity.previousPosition, entity.position).length : 0;
                console.log('[HOP_MOVE_EFFECT] start', {
                    runId: effectRunId,
                    actorId: entity.id,
                    position: entity.position,
                    previousPosition: entity.previousPosition,
                    movementTraceSignature
                });
                console.log('[HOP_MOVE]', {
                    actorId: entity.id,
                    movementType: inferredMovementType || 'fallback',
                    usedEngineTrace: hasMatchingTrace,
                    tracePathLength: tracePath?.length || 0,
                    tracePath: tracePath || [],
                    fallbackPathLength: fallbackPathLen,
                    origin: movementTrace?.origin || entity.previousPosition,
                    destination: entity.position
                });
            }

            if (inferredMovementType === 'teleport' && hasMatchingTrace && movementTrace?.origin) {
                clearAnimationTimers();
                animationInProgress.current = true;
                const totalDuration = movementTrace?.durationMs ?? 180;
                const halfDuration = Math.max(80, Math.floor(totalDuration / 2));
                const teleportOrigin = movementTrace.origin as EntityType['position'];

                setAnimationPrevPos(teleportOrigin);
                setDisplayPos(teleportOrigin);
                setDisplayPixel(hexToPixel(teleportOrigin, TILE_SIZE));
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
                    lastCompletedMoveSignature.current = moveSignature;
                }, halfDuration * 2);
                animationTimers.current.push(t1, t2);
                return () => {
                    clearAnimationTimers();
                    animationInProgress.current = false;
                };
            }

            const canAnimateFromTrace = resolvedPath.source === 'trace' && Array.isArray(resolvedPath.path) && resolvedPath.path.length > 1;
            const canAnimateFromFallback = resolvedPath.source === 'fallback' && Array.isArray(resolvedPath.path) && resolvedPath.path.length > 1;
            if (canAnimateFromTrace || canAnimateFromFallback) {
                const path = canAnimateFromTrace
                    ? (tracePath as EntityType['position'][])
                    : (resolvedPath.path as EntityType['position'][]);
                if (path.length > 1) {
                    clearAnimationTimers();
                    animationInProgress.current = true;
                    const totalDuration = movementTrace?.durationMs ?? Math.max(220, path.length * 150);
                    const segmentCount = Math.max(1, path.length - 1);
                    const perSegmentBudgetMs = Math.max(130, Math.floor(totalDuration / segmentCount));
                    const hopMoveMs = Math.max(95, Math.floor(perSegmentBudgetMs * 0.72));
                    const hopSettleMs = Math.max(40, perSegmentBudgetMs - hopMoveMs);
                    const hopCycleMs = hopMoveMs + hopSettleMs;
                    const pointsPx = path.map(p => hexToPixel(p, TILE_SIZE));
                    const startTs = performance.now();

                    setTeleportPhase('none');
                    // Frame-driven path playback must not be re-smoothed by CSS transitions.
                    setDisplayPos(path[0]);
                    setAnimationPrevPos(path[0]);
                    setDisplayPixel(pointsPx[0]);

                    let lastSegmentIndex = -1;
                    const animate = (now: number) => {
                        const elapsed = Math.max(0, now - startTs);
                        const segmentIndex = Math.min(segmentCount - 1, Math.floor(elapsed / hopCycleMs));
                        const segmentStart = segmentIndex * hopCycleMs;
                        const segmentElapsed = elapsed - segmentStart;
                        const moveT = Math.max(0, Math.min(1, segmentElapsed / hopMoveMs));

                        if (segmentIndex !== lastSegmentIndex) {
                            if (movementDebugEnabled) {
                                const fromHex = path[segmentIndex];
                                const toHex = path[Math.min(path.length - 1, segmentIndex + 1)];
                                console.log('[HOP_MOVE_SEGMENT]', {
                                    runId: effectRunId,
                                    actorId: entity.id,
                                    segmentIndex,
                                    fromHex,
                                    toHex
                                });
                            }
                            setAnimationPrevPos(path[segmentIndex]);
                            setDisplayPos(path[Math.min(path.length - 1, segmentIndex + 1)]);
                            lastSegmentIndex = segmentIndex;
                        }

                        const from = pointsPx[segmentIndex];
                        const to = pointsPx[Math.min(pointsPx.length - 1, segmentIndex + 1)];
                        const t = segmentElapsed <= hopMoveMs ? moveT : 1;
                        setDisplayPixel({
                            x: from.x + ((to.x - from.x) * t),
                            y: from.y + ((to.y - from.y) * t)
                        });

                        if (elapsed < (segmentCount * hopCycleMs) + hopSettleMs) {
                            animationFrameRef.current = requestAnimationFrame(animate);
                            return;
                        }

                        animationInProgress.current = false;
                        setDisplayPos(entity.position);
                        setAnimationPrevPos(entity.previousPosition);
                        setDisplayPixel(pointsPx[pointsPx.length - 1]);
                        lastCompletedMoveSignature.current = moveSignature;
                        animationFrameRef.current = null;
                    };
                    animationFrameRef.current = requestAnimationFrame(animate);

                    return () => {
                        if (movementDebugEnabled) {
                            console.log('[HOP_MOVE_EFFECT] cleanup', {
                                runId: effectRunId,
                                actorId: entity.id,
                                elapsedMs: Math.round(performance.now() - effectStartedAt),
                                reason: 'path-animation-effect-cleanup'
                            });
                        }
                        clearAnimationTimers();
                        animationInProgress.current = false;
                    };
                }
            }
            // Fallback for 1-tile move or no previous position
            setTeleportPhase('none');
            setDisplayPos(entity.position);
            setAnimationPrevPos(entity.previousPosition);
            setDisplayPixel(hexToPixel(entity.position, TILE_SIZE));
            lastCompletedMoveSignature.current = moveSignature;
        }
        else if (!moveSignature && !animationInProgress.current) {
            // Non-animated position changes (e.g. floor transition) must hard-sync visual position.
            if (!hexEquals(displayPos, entity.position)) {
                setTeleportPhase('none');
                setDisplayPos(entity.position);
                setAnimationPrevPos(entity.previousPosition);
                setDisplayPixel(hexToPixel(entity.position, TILE_SIZE));
            }
        }
        return () => {
            if (movementDebugEnabled) {
                console.log('[HOP_MOVE_EFFECT] cleanup', {
                    runId: effectRunId,
                    actorId: entity.id,
                    elapsedMs: Math.round(performance.now() - effectStartedAt),
                    reason: 'effect-rerun-or-unmount'
                });
            }
        };
    }, [entity.position, entity.id, movementTraceSignature]);

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
            {movementDebugVisualEnabled && movementTrace && Array.isArray(movementTrace.path) && movementTrace.path.length > 0 && (
                <g>
                    <polyline
                        points={movementTrace.path.map(p => {
                            const pix = hexToPixel(p, TILE_SIZE);
                            return `${pix.x},${pix.y}`;
                        }).join(' ')}
                        fill="none"
                        stroke={isPlayer ? '#22d3ee' : '#f43f5e'}
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        opacity={0.9}
                    />
                    {movementTrace.path.map((p, idx) => {
                        const pix = hexToPixel(p, TILE_SIZE);
                        return (
                            <g key={`trace-${entity.id}-${idx}`} transform={`translate(${pix.x}, ${pix.y})`}>
                                <circle r={idx === 0 ? 5 : 3.5} fill={idx === 0 ? '#facc15' : '#22d3ee'} opacity={0.95} />
                                <text y={-8} textAnchor="middle" fontSize={9} fill="#ffffff" stroke="#000000" strokeWidth={2} paintOrder="stroke">
                                    {idx}
                                </text>
                            </g>
                        );
                    })}
                    <g transform={`translate(${x}, ${y})`}>
                        <circle r={6} fill="none" stroke="#ffffff" strokeWidth={2} />
                        <circle r={1.5} fill="#ffffff" />
                    </g>
                    <g transform={`translate(${x + 14}, ${y - 14})`}>
                        <rect x={-2} y={-11} width={145} height={26} fill="rgba(0,0,0,0.72)" rx={4} />
                        <text x={4} y={0} fontSize={10} fill="#e2e8f0">
                            {`px(${x.toFixed(1)}, ${y.toFixed(1)})`}
                        </text>
                        <text x={4} y={11} fontSize={10} fill="#cbd5e1">
                            {`hex(${displayPos.q}, ${displayPos.r}, ${displayPos.s})`}
                        </text>
                    </g>
                </g>
            )}

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
                transform={`translate(${x}, ${y})`}
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
