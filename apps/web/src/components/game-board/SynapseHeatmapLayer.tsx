import React from 'react';
import { hexToPixel, TILE_SIZE, type SynapseThreatBand, type SynapseThreatPreview } from '@hop/engine';

interface SynapseHeatmapLayerProps {
    enabled: boolean;
    preview: SynapseThreatPreview | null;
}

const getHexPoints = (size: number): string => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        points.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
    }
    return points.join(' ');
};

const resolveBandStyle = (band: SynapseThreatBand): {
    fill: string;
    stroke: string;
    strokeWidth: number;
} => {
    if (band === 'deadly') {
        return {
            fill: 'rgba(3,7,18,0.72)',
            stroke: 'rgba(248,113,113,0.82)',
            strokeWidth: 1.5
        };
    }
    if (band === 'contested_high') {
        return {
            fill: 'rgba(239,68,68,0.34)',
            stroke: 'rgba(248,113,113,0.52)',
            strokeWidth: 1.2
        };
    }
    if (band === 'contested_low') {
        return {
            fill: 'rgba(249,115,22,0.26)',
            stroke: 'rgba(251,146,60,0.4)',
            strokeWidth: 1
        };
    }
    return {
        fill: 'rgba(255,255,255,0.08)',
        stroke: 'rgba(255,255,255,0.12)',
        strokeWidth: 0.8
    };
};

export const SynapseHeatmapLayer: React.FC<SynapseHeatmapLayerProps> = ({
    enabled,
    preview
}) => {
    const gridPoints = React.useMemo(() => getHexPoints(TILE_SIZE - 1.5), []);
    if (!enabled || !preview) return null;

    return (
        <g data-layer="synapse-heatmap" pointerEvents="none">
            {preview.tiles.map((entry) => {
                const { x, y } = hexToPixel(entry.tile, TILE_SIZE);
                const style = resolveBandStyle(entry.band);
                return (
                    <g key={`synapse-heat-${entry.tile.q},${entry.tile.r},${entry.tile.s}`} transform={`translate(${x},${y})`}>
                        <polygon
                            points={gridPoints}
                            fill={style.fill}
                            stroke={style.stroke}
                            strokeWidth={style.strokeWidth}
                            data-synapse-band={entry.band}
                        />
                    </g>
                );
            })}
        </g>
    );
};

