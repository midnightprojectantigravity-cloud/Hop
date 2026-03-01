import React from 'react';

interface EntitySpearProps {
  x: number;
  y: number;
  icon: string;
}

export const EntitySpear: React.FC<EntitySpearProps> = ({ x, y, icon }) => (
  <g style={{ pointerEvents: 'none' }}>
    <g transform={`translate(${x},${y})`}>
      <text
        x="0"
        y="0"
        textAnchor="middle"
        dy=".3em"
        fontSize="20"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
      >
        {icon}
      </text>
    </g>
  </g>
);
