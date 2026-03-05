import React from 'react';
import { hexToPixel, TILE_SIZE, type GameState } from '@hop/engine';
import type { SynapseSelection } from '../../app/synapse';

interface SynapseThreadOverlayProps {
    enabled: boolean;
    gameState: GameState;
    selection: SynapseSelection;
}

const resolveSelectionPoint = (
    gameState: GameState,
    selection: SynapseSelection
) => {
    if (selection.mode === 'tile') return selection.tile;
    if (selection.mode === 'entity') {
        if (selection.actorId === gameState.player.id) return gameState.player.position;
        const enemy = gameState.enemies.find(actor => actor.id === selection.actorId);
        if (enemy) return enemy.position;
        const companion = gameState.companions?.find(actor => actor.id === selection.actorId);
        if (companion) return companion.position;
    }
    return null;
};

export const SynapseThreadOverlay: React.FC<SynapseThreadOverlayProps> = ({
    enabled,
    gameState,
    selection
}) => {
    if (!enabled || selection.mode === 'empty') return null;

    const point = resolveSelectionPoint(gameState, selection);
    if (!point) return null;

    const center = hexToPixel(point, TILE_SIZE);
    const edgeSize = TILE_SIZE - 1;
    const hexPoints = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 180) * (60 * i);
        const x = center.x + edgeSize * Math.cos(angle);
        const y = center.y + edgeSize * Math.sin(angle);
        return `${x},${y}`;
    }).join(' ');

    return (
        <g data-layer="synapse-thread" pointerEvents="none">
            <polygon
                points={hexPoints}
                fill="none"
                stroke="rgba(34, 211, 238, 0.34)"
                strokeWidth={5.5}
                strokeLinejoin="round"
            />
            <polygon
                points={hexPoints}
                fill="none"
                stroke="rgba(34, 211, 238, 0.95)"
                strokeWidth={2.2}
                strokeLinejoin="round"
                data-synapse-thread="active"
            />
        </g>
    );
};
