import React from 'react';
import type { Point } from '@hop/engine';
import { hexToPixel, pointToKey, TILE_SIZE } from '@hop/engine';

interface UiGridLayerProps {
    cells: Point[];
    gridPoints: string;
}

export const UiGridLayer: React.FC<UiGridLayerProps> = ({ cells, gridPoints }) => {
    return (
        <g data-layer="interaction-ui-grid" pointerEvents="none" shapeRendering="crispEdges">
            {cells.map((hex) => {
                const { x, y } = hexToPixel(hex, TILE_SIZE);
                return (
                    <g key={`grid-${pointToKey(hex)}`} transform={`translate(${x},${y})`}>
                        <polygon
                            points={gridPoints}
                            fill="none"
                            stroke="rgba(201,224,255,0.12)"
                            strokeWidth={0.9}
                        />
                    </g>
                );
            })}
        </g>
    );
};
