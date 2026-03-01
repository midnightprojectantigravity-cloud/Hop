import type { Actor as EntityType } from '@hop/engine';
import { getEntityVisual } from '@hop/engine';

const FLOOR_THEME_LUMA: Record<string, number> = {
  catacombs: 0.2,
  inferno: 0.16,
  throne: 0.24,
  frozen: 0.45,
  void: 0.08
};

const contrastRatio = (a: number, b: number): number => {
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
};

export const computeEntityContrastBoost = (floorTheme?: string): number => {
  const normalizedTheme = String(floorTheme || '').toLowerCase();
  const floorLuma = FLOOR_THEME_LUMA[normalizedTheme] ?? 0.22;
  const desiredUnitLuma = 0.86;
  const baseContrast = contrastRatio(floorLuma, desiredUnitLuma);
  return baseContrast < 4.5 ? 1.22 : 1.06;
};

export const renderEntityIcon = (
  entity: EntityType,
  isPlayer: boolean,
  size = 24,
  assetHref?: string,
  onAssetError?: () => void,
  contrastBoost = 1
) => {
  const visual = getEntityVisual(entity.subtype, entity.type, entity.enemyType as 'melee' | 'ranged' | 'boss', entity.archetype);
  const { icon, shape, color, borderColor, size: sizeMult = 1.0 } = visual;
  const finalSize = size * sizeMult;
  const bombFuse = entity.statusEffects?.find(s => s.type === 'time_bomb');
  const bombTimer = bombFuse ? Math.max(0, bombFuse.duration) : (entity.actionCooldown ?? 0);
  const contrastFilter = `contrast(${contrastBoost.toFixed(2)}) brightness(${(contrastBoost > 1 ? 1.12 : 1.04).toFixed(2)})`;
  const assetImageFilter = isPlayer
    ? `drop-shadow(0 3px 4px rgba(0,0,0,0.45)) drop-shadow(0 0 2px rgba(255,255,255,0.5)) saturate(1.08) ${contrastFilter}`
    : `drop-shadow(0 3px 4px rgba(0,0,0,0.50)) drop-shadow(0 0 2px rgba(255,255,255,0.35)) saturate(1.0) ${contrastFilter}`;

  return (
    <g>
      <title>{isPlayer ? 'Player' : `${entity.subtype || 'Enemy'}`}</title>
      {assetHref && (
        <image
          href={assetHref}
          x={-finalSize}
          y={-finalSize}
          width={finalSize * 2}
          height={finalSize * 2}
          preserveAspectRatio="xMidYMid meet"
          onError={onAssetError}
          style={{
            filter: assetImageFilter,
            opacity: isPlayer ? 1 : 0.97
          }}
        />
      )}

      {!assetHref && shape === 'square' && (
        <rect x={-finalSize * 0.8} y={-finalSize * 0.8} width={finalSize * 1.6} height={finalSize * 1.6} fill={color} stroke={borderColor} strokeWidth={2} />
      )}
      {!assetHref && shape === 'diamond' && (
        <path d={`M0 ${-finalSize * 0.8} L${finalSize * 0.6} 0 L0 ${finalSize * 0.8} L${-finalSize * 0.6} 0 Z`} fill={color} stroke={borderColor} strokeWidth={1} />
      )}
      {!assetHref && shape === 'triangle' && (
        <path d={`M0 ${-finalSize * 0.8} L${finalSize * 0.7} ${finalSize * 0.5} L${-finalSize * 0.7} ${finalSize * 0.5} Z`} fill={color} stroke={borderColor} strokeWidth={1} />
      )}
      {!assetHref && shape === 'circle' && (
        <circle r={finalSize * 0.7} fill={color} stroke={borderColor} strokeWidth={1} />
      )}

      {entity.subtype === 'bomb' && (
        <text y={finalSize * 0.2} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">
          {bombTimer}
        </text>
      )}

      {!assetHref && !isPlayer && entity.subtype !== 'bomb' && (
        <text x="0" y="0" textAnchor="middle" dy=".3em" fontSize={finalSize * 0.8} opacity={0.8}>
          {icon}
        </text>
      )}

      {!assetHref && isPlayer && (
        <path d={`M0 ${-finalSize * 0.4} L0 ${finalSize * 0.4} M${-finalSize * 0.15} ${-finalSize * 0.2} L0 ${-finalSize * 0.5} L${finalSize * 0.15} ${-finalSize * 0.2}`} stroke={borderColor} strokeWidth={2} fill="none" />
      )}
    </g>
  );
};
