import type { Point } from '@hop/engine';
import { hexToPixel, TILE_SIZE } from '@hop/engine';

interface ObjectiveMarkerProp {
  id: string;
  kind: string;
  position: Point;
}

interface ObjectiveMarkersLayerProps {
  boardProps: ObjectiveMarkerProp[];
}

export const ObjectiveMarkersLayer: React.FC<ObjectiveMarkersLayerProps> = ({ boardProps }) => (
  <g data-layer="ui-objective-markers" pointerEvents="none">
    {boardProps.map((prop) => {
      const { x, y } = hexToPixel(prop.position, TILE_SIZE);
      const isShrineProp = prop.kind === 'shrine';
      const markerFill = isShrineProp ? '#c2410c' : '#15803d';
      const markerLabel = isShrineProp ? 'S' : 'E';
      const markerX = x + TILE_SIZE * 0.52;
      const markerY = y - TILE_SIZE * 0.52;
      return (
        <g key={`marker-${prop.id}`} transform={`translate(${markerX},${markerY})`}>
          <circle r={14} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2} style={{ animation: `shrineGlow ${isShrineProp ? 1.6 : 1.9}s ease-in-out infinite` }} />
          <circle r={10.5} fill={markerFill} stroke="#ffffff" strokeWidth={2} />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dy=".34em"
            fill="#ffffff"
            fontSize={10}
            fontWeight={900}
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
          >
            {markerLabel}
          </text>
        </g>
      );
    })}
  </g>
);
