import React from 'react';
import { hexToPixel, TILE_SIZE, type GameState, type SynapseThreatPreview, type UnifiedPowerScoreEntry } from '@hop/engine';
import type { SynapseDeltaEntry } from '../../app/synapse';
import { resolveSynapseDeltaDirection } from '../../app/synapse';

interface SynapseUnitScoreLayerProps {
    enabled: boolean;
    gameState: GameState;
    preview: SynapseThreatPreview | null;
    deltasByActorId: Record<string, SynapseDeltaEntry>;
}

const round1 = (value: number): string => Number(value.toFixed(1)).toString();

const formatSigned = (value: number): string =>
    `${value >= 0 ? '+' : ''}${round1(value)}`;

const resolveTierTone = (tier: UnifiedPowerScoreEntry['sigmaTier']): {
    border: string;
    fill: string;
    text: string;
} => {
    if (tier === 'extreme') {
        return {
            border: 'rgba(239,68,68,0.88)',
            fill: 'rgba(127,29,29,0.68)',
            text: '#fecaca'
        };
    }
    if (tier === 'high') {
        return {
            border: 'rgba(245,158,11,0.86)',
            fill: 'rgba(120,53,15,0.62)',
            text: '#fde68a'
        };
    }
    if (tier === 'elevated') {
        return {
            border: 'rgba(34,211,238,0.78)',
            fill: 'rgba(8,47,73,0.58)',
            text: '#a5f3fc'
        };
    }
    return {
        border: 'rgba(148,163,184,0.68)',
        fill: 'rgba(30,41,59,0.54)',
        text: '#e2e8f0'
    };
};

export const SynapseUnitScoreLayer: React.FC<SynapseUnitScoreLayerProps> = ({
    enabled,
    gameState,
    preview,
    deltasByActorId
}) => {
    const scoreByActorId = React.useMemo(() => {
        const map = new Map<string, UnifiedPowerScoreEntry>();
        for (const score of preview?.unitScores || []) {
            map.set(score.actorId, score);
        }
        return map;
    }, [preview]);

    const units = React.useMemo(() => {
        const merged = [
            gameState.player,
            ...gameState.enemies,
            ...(gameState.companions || [])
        ].filter(actor => actor.hp > 0 && (actor.id === gameState.player.id || actor.isVisible !== false));
        const deduped = new Map<string, typeof merged[number]>();
        for (const actor of merged) {
            if (!deduped.has(actor.id)) deduped.set(actor.id, actor);
        }
        return [...deduped.values()];
    }, [gameState.companions, gameState.enemies, gameState.player]);

    if (!enabled || !preview) return null;

    return (
        <g data-layer="synapse-unit-scores" pointerEvents="none">
            {units.map(actor => {
                const score = scoreByActorId.get(actor.id);
                const ups = score?.ups ?? 0;
                const tier = score?.sigmaTier || 'below';
                const tone = resolveTierTone(tier);
                const delta = deltasByActorId[actor.id]?.upsDelta ?? 0;
                const deltaDirection = resolveSynapseDeltaDirection(delta);
                const { x, y } = hexToPixel(actor.position, TILE_SIZE);
                return (
                    <g
                        key={`synapse-chip-${actor.id}`}
                        transform={`translate(${x},${y - 26})`}
                        data-synapse-chip={actor.id}
                    >
                        <rect
                            x={-24}
                            y={-8}
                            width={48}
                            height={14}
                            rx={6}
                            fill={tone.fill}
                            stroke={tone.border}
                            strokeWidth={1}
                        />
                        <text
                            x={0}
                            y={2}
                            textAnchor="middle"
                            fontSize={7.8}
                            fontWeight={800}
                            fill={tone.text}
                            style={{ letterSpacing: '0.02em' }}
                        >
                            {`UPS ${round1(ups)}`}
                        </text>
                        {deltaDirection !== 'none' && (
                            <text
                                x={31}
                                y={2}
                                textAnchor="start"
                                fontSize={7}
                                fontWeight={800}
                                fill={deltaDirection === 'up' ? '#86efac' : '#fda4af'}
                                data-synapse-delta={deltaDirection}
                            >
                                {`${deltaDirection === 'up' ? '^' : 'v'}${formatSigned(delta)}`}
                            </text>
                        )}
                    </g>
                );
            })}
        </g>
    );
};
