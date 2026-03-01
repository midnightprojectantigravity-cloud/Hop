import React from 'react';
import type { Actor } from '@hop/engine';

type AilmentBadge = { ailment: string; count: number };

const AILMENT_COLORS: Record<string, string> = {
  burn: '#d9480f',
  wet: '#0ea5e9',
  poison: '#16a34a',
  frozen: '#60a5fa',
  bleed: '#b91c1c'
};

const readAilmentCounters = (entity: Actor): Record<string, number> => {
  const component = entity.components?.get('ailments') as { counters?: Record<string, number> } | undefined;
  return component?.counters || {};
};

export const getEntityAilmentBadges = (entity: Actor, maxBadges = 3): AilmentBadge[] => {
  const counters = readAilmentCounters(entity);
  return Object.entries(counters)
    .map(([ailment, count]) => ({ ailment, count: Math.max(0, Math.floor(Number(count || 0))) }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count || a.ailment.localeCompare(b.ailment))
    .slice(0, Math.max(0, maxBadges));
};

interface EntityAilmentBadgesProps {
  entity: Actor;
}

export const EntityAilmentBadges: React.FC<EntityAilmentBadgesProps> = ({ entity }) => {
  const badges = getEntityAilmentBadges(entity, 3);
  if (badges.length === 0) return null;

  const totalWidth = badges.length * 16;
  const startX = -(totalWidth / 2) + 8;
  return (
    <g transform="translate(0,-22)">
      {badges.map((badge, idx) => {
        const x = startX + idx * 16;
        const fill = AILMENT_COLORS[badge.ailment] || '#334155';
        return (
          <g key={`${badge.ailment}-${idx}`} transform={`translate(${x},0)`}>
            <rect x={-7} y={-7} width={14} height={12} rx={3} fill={fill} fillOpacity={0.92} stroke="rgba(0,0,0,0.45)" strokeWidth={1} />
            <text
              x={0}
              y={2}
              fontSize={8}
              textAnchor="middle"
              fill="#f8fafc"
              style={{ fontWeight: 700 }}
            >
              {badge.count}
            </text>
            <title>{`${badge.ailment.toUpperCase()}: ${badge.count}`}</title>
          </g>
        );
      })}
    </g>
  );
};
