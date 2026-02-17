import type { Actor } from '@hop/engine';
import { BIOME_VISUALS, resolveBiomeColor } from './biome-config';

export type TileVisualFlags = {
  isWall?: boolean;
  isLava?: boolean;
  isFire?: boolean;
  isStairs?: boolean;
  isShrine?: boolean;
  theme?: string;
};

export const resolveTileAssetId = (flags: TileVisualFlags): string => {
  const biome = resolveBiomeColor(flags.theme);
  if (flags.isWall) return 'tile.catacombs.wall.01';
  if (flags.isLava) return BIOME_VISUALS[biome].hazardAssetId;
  if (flags.isFire) return 'tile.catacombs.fire.01';
  return BIOME_VISUALS[biome].floorAssetId;
};

export const resolvePropAssetId = (flags: TileVisualFlags): string | undefined => {
  if (flags.isStairs) return 'prop.core.stairs.01';
  if (flags.isShrine) return 'prop.core.shrine.01';
  return undefined;
};

// Backward compatibility alias; use `resolvePropAssetId` for new code.
export const resolveTileOverlayAssetId = resolvePropAssetId;

export const resolveUnitAssetId = (actor: Actor): string => {
  if (actor.type === 'player') {
    switch (actor.archetype) {
      case 'FIREMAGE':
        return 'unit.player.firemage.04';
      case 'SKIRMISHER':
        return 'unit.player.skirmisher.01';
      case 'HUNTER':
        return 'unit.player.hunter.01';
      case 'NECROMANCER':
        return 'unit.player.necromancer.01';
      case 'ASSASSIN':
        return 'unit.player.assassin.01';
      default:
        return 'unit.player.vanguard.01';
    }
  }

  switch (actor.subtype) {
    case 'footman':
      return 'unit.enemy.footman.01';
    case 'shield_bearer':
      return 'unit.enemy.shield_bearer.01';
    case 'archer':
      return 'unit.enemy.archer.01';
    case 'warlock':
      return 'unit.enemy.warlock.01';
    case 'bomber':
      return 'unit.enemy.bomber.01';
    case 'bomb':
      return 'unit.enemy.bomb.01';
    default:
      return actor.enemyType === 'boss'
        ? 'unit.enemy.boss.01'
        : 'unit.enemy.footman.01';
  }
};

const BASE_URL = import.meta.env.BASE_URL || '/';

const joinBase = (base: string, path: string): string => {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, '')}`;
};

const toRuntimeAssetPath = (assetPath: string): string => {
  if (/^(?:[a-z]+:)?\/\//i.test(assetPath) || assetPath.startsWith('data:')) return assetPath;
  if (!assetPath.startsWith('/')) return joinBase(BASE_URL, assetPath);
  if (assetPath.startsWith('/assets/')) return joinBase(BASE_URL, assetPath.slice(1));
  return assetPath;
};

const UNIT_FALLBACK_SVG_BY_ID: Record<string, string> = {
  'unit.player.vanguard.01': '/assets/units/unit.player.vanguard.01.svg',
  'unit.player.firemage.04': '/assets/units/unit.player.firemage.02.svg',
  'unit.player.skirmisher.01': '/assets/units/unit.player.skirmisher.01.svg',
  'unit.player.hunter.01': '/assets/units/unit.player.skirmisher.01.svg',
  'unit.player.necromancer.01': '/assets/units/unit.player.vanguard.01.svg',
  'unit.player.assassin.01': '/assets/units/unit.player.skirmisher.01.svg',
  'unit.enemy.footman.01': '/assets/units/unit.enemy.footman.01.svg',
  'unit.enemy.shield_bearer.01': '/assets/units/unit.enemy.shield_bearer.01.svg',
  'unit.enemy.archer.01': '/assets/units/unit.enemy.archer.01.svg',
  'unit.enemy.warlock.01': '/assets/units/unit.enemy.warlock.01.svg',
  'unit.enemy.bomber.01': '/assets/units/unit.enemy.bomber.01.svg',
  'unit.enemy.bomb.01': '/assets/units/unit.enemy.bomb.01.svg',
  'unit.enemy.boss.01': '/assets/units/unit.enemy.boss.01.svg'
};

export const resolveUnitFallbackAssetHref = (actor: Actor): string | undefined => {
  const id = resolveUnitAssetId(actor);
  const fallback = UNIT_FALLBACK_SVG_BY_ID[id];
  return fallback ? toRuntimeAssetPath(fallback) : undefined;
};

export const resolveFxAssetId = (
  effectType: 'impact' | 'combat_text' | 'flash' | 'spear_trail' | 'vaporize' | 'lava_ripple' | 'explosion_ring'
): string | undefined => {
  if (effectType === 'impact') return 'fx.core.impact.01';
  if (effectType === 'vaporize') return 'fx.core.vaporize.01';
  if (effectType === 'lava_ripple') return 'fx.core.lava_ripple.01';
  if (effectType === 'explosion_ring') return 'fx.core.explosion_ring.01';
  return undefined;
};

export const resolveCombatTextFrameAssetId = (): string => 'ui.core.hp_frame.01';

export const resolveDeathDecalAssetId = (): string => 'decal.combat.blood.01';
