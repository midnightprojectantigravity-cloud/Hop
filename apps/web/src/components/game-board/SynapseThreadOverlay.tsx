import React from 'react';
import { hexToPixel, TILE_SIZE, type GameState } from '@hop/engine';
import type { SynapseSelection } from '../../app/synapse';
import type { CameraRect } from '../../visual/camera';

interface SynapseThreadOverlayProps {
    enabled: boolean;
    gameState: GameState;
    renderedViewBox: CameraRect;
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
    renderedViewBox,
    selection
}) => {
    const gradientId = React.useId();
    if (!enabled || selection.mode === 'empty') return null;

    const point = resolveSelectionPoint(gameState, selection);
    if (!point) return null;

    const start = hexToPixel(point, TILE_SIZE);
    const end = {
        x: renderedViewBox.x + renderedViewBox.width / 2,
        y: renderedViewBox.y + renderedViewBox.height - 12
    };
    const control = {
        x: (start.x + end.x) / 2,
        y: start.y + (end.y - start.y) * 0.62
    };
    const d = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;

    return (
        <g data-layer="synapse-thread" pointerEvents="none">
            <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(34,211,238,0.95)" />
                    <stop offset="100%" stopColor="rgba(59,130,246,0.2)" />
                </linearGradient>
            </defs>
            <path
                d={d}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={1.8}
                strokeDasharray="5 4"
                className="synapse-thread-line"
                data-synapse-thread="active"
            />
            <circle cx={start.x} cy={start.y} r={2.2} fill="rgba(125,211,252,0.9)" />
            <circle cx={end.x} cy={end.y} r={2.6} fill="rgba(56,189,248,0.85)" />
        </g>
    );
};

