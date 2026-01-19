import React, { useState, useEffect, useRef } from 'react';
import type { Actor as EntityType } from '@hop/engine';
import { isStunned, hexToPixel, getDirectionFromTo, hexEquals, TILE_SIZE, getHexLine } from '@hop/engine';

interface EntityProps {
    entity: EntityType;
    isSpear?: boolean;
    isDying?: boolean; // For death animations
}


const renderIcon = (entity: EntityType, isPlayer: boolean, size = 24) => {
    const playerColor = '#3b82f6';
    const enemyColor = '#ef4444';
    const borderColor = '#ffffff';

    if (isPlayer) {
        return (
            <g>
                <title>Player</title>
                {/* Blue square with white border */}
                <rect x={-size * 0.8} y={-size * 0.8} width={size * 1.6} height={size * 1.6} fill={playerColor} stroke={borderColor} strokeWidth={2} />
                {/* Simplified Spear icon overlay */}
                <path d={`M0 ${-size * 0.4} L0 ${size * 0.4} M${-size * 0.15} ${-size * 0.2} L0 ${-size * 0.5} L${size * 0.15} ${-size * 0.2}`} stroke={borderColor} strokeWidth={2} fill="none" />
            </g>
        );
    }

    if (entity.subtype === 'bomb') {
        const timer = entity.actionCooldown ?? 0;
        return (
            <g style={{ transition: 'transform 0.2s ease-in-out', pointerEvents: 'none' }}>
                <circle r={size * 0.6} fill="#1f2937" stroke="#000" />
                <circle r={size * 0.2} cy={-size * 0.3} fill={timer === 1 ? "#ef4444" : "#f59e0b"} />
                <text y={size * 0.2} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">{timer}</text>
            </g>
        );
    }

    // Bomber: Red Circle
    if (entity.subtype === 'bomber') {
        return (
            <g>
                <title>Bomber Enemy</title>
                <circle r={size * 0.7} fill={enemyColor} stroke={borderColor} strokeWidth={1} />
            </g>
        );
    }

    // Enemies: Melee = Diamond, Ranged = Triangle
    const isMelee = entity.enemyType === 'melee' || ['footman', 'shieldBearer', 'golem', 'sprinter', 'assassin'].includes(entity.subtype || '');

    if (isMelee) {
        return (
            <g>
                <title>Melee Enemy</title>
                {/* Red Diamond */}
                <path d={`M0 ${-size * 0.8} L${size * 0.6} 0 L0 ${size * 0.8} L${-size * 0.6} 0 Z`} fill={enemyColor} stroke={borderColor} strokeWidth={1} />
            </g>
        );
    } else {
        return (
            <g>
                <title>Ranged Enemy</title>
                {/* Red Triangle */}
                <path d={`M0 ${-size * 0.8} L${size * 0.7} ${size * 0.5} L${-size * 0.7} ${size * 0.5} Z`} fill={enemyColor} stroke={borderColor} strokeWidth={1} />
            </g>
        );
    }
};

export const Entity: React.FC<EntityProps> = ({ entity, isSpear, isDying }) => {
    const [displayPos, setDisplayPos] = useState(entity.position);
    const [animationPrevPos, setAnimationPrevPos] = useState<EntityType['position'] | undefined>(entity.previousPosition);
    const animationInProgress = useRef(false);
    const lastTargetPos = useRef(entity.position);

    const [isFlashing, setIsFlashing] = useState(false);
    const prevHp = useRef(entity.hp);

    const isPlayer = entity.type === 'player';
    const targetPixel = entity.intentPosition ? hexToPixel(entity.intentPosition, TILE_SIZE) : null;

    // Sequential Animation Logic
    useEffect(() => {
        if (!hexEquals(entity.position, lastTargetPos.current)) {
            // New position detected
            lastTargetPos.current = entity.position;

            if (entity.previousPosition && !hexEquals(entity.position, entity.previousPosition)) {
                const path = getHexLine(entity.previousPosition, entity.position);
                if (path.length > 2) { // Only animate sequences for multi-tile jumps/dashes
                    animationInProgress.current = true;
                    let step = 0;
                    const stepDuration = 120; // ms per tile

                    const interval = setInterval(() => {
                        step++;
                        if (step < path.length) {
                            setAnimationPrevPos(path[step - 1]);
                            setDisplayPos(path[step]);
                        } else {
                            clearInterval(interval);
                            animationInProgress.current = false;
                            setDisplayPos(entity.position);
                            setAnimationPrevPos(entity.previousPosition);
                        }
                    }, stepDuration);

                    return () => {
                        clearInterval(interval);
                        animationInProgress.current = false;
                    };
                }
            }
            // Fallback for 1-tile move or no previous position
            setDisplayPos(entity.position);
            setAnimationPrevPos(entity.previousPosition);
        }
    }, [entity.position]);

    const { x, y } = hexToPixel(displayPos, TILE_SIZE);

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
        return (
            <g style={{ pointerEvents: 'none' }}>
                <g transform={`translate(${x},${y})`}>
                    <text x="0" y="0" textAnchor="middle" dy=".3em" fontSize="20" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>🔱</text>
                </g>
            </g>
        );
    }

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
                    transition: 'transform 0.12s linear',
                    transform: `translate(${x}px, ${y}px)`
                }}
                className={isDying ? 'animate-lava-sink' : ''}
            >
                {/* Visual Content Group - Handles idle animation, squash/stretch, and damage flash */}
                <g
                    transform={stretchTransform}
                    className={`${isFlashing ? 'entity-damaged' : ''} ${!isDying && !isStunned(entity) ? 'animate-idle' : ''}`}
                    opacity={isInvisible ? 0.3 : 1}
                    style={{ filter: isInvisible ? 'blur(1px)' : 'none' }}
                >
                    {/* subtle background circle */}
                    <circle r={TILE_SIZE * 0.9} fill={isPlayer ? 'rgba(139,94,52,0.06)' : 'rgba(184,20,20,0.06)'} opacity={1} />

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

                    {/* Shield direction indicator for shield bearer */}
                    {entity.subtype === 'shieldBearer' && entity.facing !== undefined && !isStunned(entity) && (
                        <line
                            x1={0}
                            y1={0}
                            x2={Math.cos((entity.facing * 60 - 90) * Math.PI / 180) * TILE_SIZE * 0.5}
                            y2={Math.sin((entity.facing * 60 - 90) * Math.PI / 180) * TILE_SIZE * 0.5}
                            stroke="#fbbf24"
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

