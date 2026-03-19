import React from 'react';
import type { Point } from '@hop/engine';
import { hexToPixel, TILE_SIZE } from '@hop/engine';
import { buildTranslatedPolygonPath, parseSvgPointList } from './board-svg-paths';

interface UiGridLayerProps {
    cells: Point[];
    gridPoints: string;
}

export const UiGridLayer: React.FC<UiGridLayerProps> = ({ cells, gridPoints }) => {
    const polygonPoints = React.useMemo(() => parseSvgPointList(gridPoints), [gridPoints]);
    const gridPath = React.useMemo(() => (
        buildTranslatedPolygonPath(
            cells.map((hex) => hexToPixel(hex, TILE_SIZE)),
            polygonPoints,
        )
    ), [cells, polygonPoints]);

    return (
        <g data-layer="interaction-ui-grid" pointerEvents="none" shapeRendering="crispEdges">
            {gridPath && (
                <path
                    d={gridPath}
                    fill="none"
                    stroke="rgba(201,224,255,0.12)"
                    strokeWidth={0.9}
                />
            )}
        </g>
    );
};
