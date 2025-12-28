import React from 'react';
import type { Actor as EntityType } from '../game/types';
import { hexToPixel } from '../game/hex';
import { TILE_SIZE } from '../game/constants';

// Import sprite images
import playerSprite from '../assets/sprites/player_warrior.png';
import footmanSprite from '../assets/sprites/enemy_footman.png';
import archerSprite from '../assets/sprites/enemy_archer.png';
import bomberSprite from '../assets/sprites/enemy_bomber.png';
import shieldBearerSprite from '../assets/sprites/enemy_shield_bearer.png';
import warlockSprite from '../assets/sprites/enemy_warlock.png';

interface EntityProps {
    entity: EntityType;
    isSpear?: boolean;
}

// Map subtypes to sprites
const SPRITE_MAP: Record<string, string> = {
    player: playerSprite,
    footman: footmanSprite,
    archer: archerSprite,
    bomber: bomberSprite,
    shieldBearer: shieldBearerSprite,
    warlock: warlockSprite,
    // Fallback for types without sprites yet
    sprinter: footmanSprite,
    assassin: archerSprite,
    golem: shieldBearerSprite,
    demonLord: warlockSprite,
};

// Use sprites if available, otherwise fall back to SVG icons
const USE_SPRITES = true;

const renderIcon = (entity: EntityType, isPlayer: boolean, size = 24) => {
    const playerColor = '#3b82f6';
    const enemyColor = '#ef4444';
    const borderColor = '#ffffff';

    if (isPlayer) {
        return (
            <g>
                <title>Player</title>
                {/* Blue circle with white border */}
                <circle r={size * 0.8} fill={playerColor} stroke={borderColor} strokeWidth={2} />
                {/* Simplified Spear icon overlay */}
                <path d={`M0 ${-size * 0.4} L0 ${size * 0.4} M${-size * 0.15} ${-size * 0.2} L0 ${-size * 0.5} L${size * 0.15} ${-size * 0.2}`} stroke={borderColor} strokeWidth={2} fill="none" />
            </g>
        );
    }

    // Enemies: Melee = Diamond, Ranged = Triangle
    const isMelee = entity.enemyType === 'melee' || ['footman', 'shieldBearer', 'golem'].includes(entity.subtype || '');

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

export const Entity: React.FC<EntityProps> = ({ entity, isSpear }) => {
    const { x, y } = hexToPixel(entity.position, TILE_SIZE);

    const isPlayer = entity.type === 'player';
    const targetPixel = entity.intentPosition ? hexToPixel(entity.intentPosition, TILE_SIZE) : null;

    // Handle invisibility (assassin)
    const isInvisible = entity.isVisible === false;

    if (isSpear) {
        return (
            <g transform={`translate(${x},${y})`}>
                <text x="0" y="0" textAnchor="middle" dy=".3em" fontSize="24">🔱</text>
            </g>
        );
    }

    const hpFraction = Math.max(0, Math.min(1, (entity.hp || 0) / (entity.maxHp || 1)));

    // Get sprite for this entity
    const spriteKey = isPlayer ? 'player' : (entity.subtype || 'footman');
    const sprite = SPRITE_MAP[spriteKey];

    return (
        <g style={{ transition: 'transform 0.2s ease-in-out' }}>
            {/* Intent Line */}
            {targetPixel && !isPlayer && (
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

            <g
                transform={`translate(${x},${y})`}
                opacity={isInvisible ? 0.3 : 1}
                style={{ filter: isInvisible ? 'blur(1px)' : 'none' }}
            >
                {/* subtle background circle */}
                <circle r={TILE_SIZE * 0.9} fill={isPlayer ? 'rgba(139,94,52,0.06)' : 'rgba(184,20,20,0.06)'} opacity={1} />

                {USE_SPRITES && sprite ? (
                    // Use sprite image
                    <image
                        href={sprite}
                        x={-TILE_SIZE * 0.6}
                        y={-TILE_SIZE * 0.7}
                        width={TILE_SIZE * 1.2}
                        height={TILE_SIZE * 1.2}
                        style={{ imageRendering: 'pixelated' }}
                    />
                ) : (
                    // Fall back to SVG icon
                    <g transform="translate(0,-2) scale(0.9)">
                        {renderIcon(entity, isPlayer, 18)}
                    </g>
                )}

                {/* Shield direction indicator for shield bearer */}
                {entity.subtype === 'shieldBearer' && entity.facing !== undefined && (
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

                {/* HP Bar for player (larger) */}
                {isPlayer && (
                    <g>
                        <rect x={-28} y={18} width={56} height={8} rx={3} ry={3} className="hp-bar-bg" />
                        <rect x={-28} y={18} width={56 * hpFraction} height={8} rx={3} ry={3} className="hp-bar-fill" />
                        <text x={0} y={32} textAnchor="middle" fontSize={10} fill="#ddd">HP {entity.hp}/{entity.maxHp}</text>

                        {/* Active skill cooldown indicators */}
                        {entity.activeSkills && entity.activeSkills.length > 0 && (
                            <g>
                                {entity.activeSkills.slice(0, 3).map((skill, i) => (
                                    <g key={skill.id} transform={`translate(${(i - 1) * 18}, 42)`}>
                                        <circle
                                            r={6}
                                            fill={skill.currentCooldown === 0 ? '#22c55e' : '#6b7280'}
                                            stroke={skill.currentCooldown === 0 ? '#16a34a' : '#374151'}
                                            strokeWidth={1}
                                        />
                                        {skill.currentCooldown > 0 && (
                                            <text x={0} y={0} textAnchor="middle" dy=".35em" fontSize={8} fill="white">
                                                {skill.currentCooldown}
                                            </text>
                                        )}
                                        <title>{skill.name}: {skill.currentCooldown === 0 ? 'Ready!' : `${skill.currentCooldown} turns`}</title>
                                    </g>
                                ))}
                            </g>
                        )}
                    </g>
                )}

                {/* Tiny HP bar for enemies */}
                {!isPlayer && (
                    <>
                        <rect x={-12} y={18} width={24} height={5} rx={2} ry={2} fill="#2b1f17" />
                        <rect x={-12} y={18} width={(24 * hpFraction)} height={5} rx={2} ry={2} fill="var(--hp-enemy)" />
                        {/* Intent label */}
                        {entity.intent && (
                            <text x={0} y={-TILE_SIZE * 0.6} textAnchor="middle" fontSize={8} fill="#ef4444" fontWeight="bold">
                                {entity.intent}
                            </text>
                        )}
                        <title>{`${entity.subtype || entity.type} — HP ${entity.hp}/${entity.maxHp}${entity.intent ? ` — ${entity.intent}` : ''}`}</title>
                    </>
                )}
            </g>
        </g>
    );
};

