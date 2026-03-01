import type { GameState, Point } from '../../types';
import type { SkillID } from '../../types/registry';
import { UnifiedTileService } from './unified-tile-service';

export type SurfaceStatus =
    | 'STABLE'
    | 'MELTED'
    | 'SOAKED'
    | 'FROZEN'
    | 'VOID_TOUCHED';

const FIRE_SKILL_IDS = new Set<SkillID>([
    'FIREBALL',
    'FIREWALL',
    'FIREWALK',
    'ABSORB_FIRE'
]);

/**
 * Deterministic biome surface classifier used by skills and evaluation hooks.
 */
export const getSurfaceStatus = (state: GameState, hexCoord: Point): SurfaceStatus => {
    const tile = UnifiedTileService.getTileAt(state, hexCoord);
    const traits = UnifiedTileService.getTraitsForTile(state, tile);
    const hasEffect = (id: string): boolean => tile.effects.some(effect => effect.id === id);

    if (tile.baseId === 'VOID' || traits.has('VOID') || traits.has('PIT')) {
        return 'VOID_TOUCHED';
    }
    if (tile.baseId === 'ICE' || hasEffect('ICE_WALL')) {
        return 'FROZEN';
    }
    if (
        tile.baseId === 'LAVA'
        || traits.has('LAVA')
        || traits.has('FIRE')
        || hasEffect('FIRE')
    ) {
        return 'MELTED';
    }
    if (hasEffect('WET') || hasEffect('STEAM')) {
        return 'SOAKED';
    }
    return 'STABLE';
};

/**
 * Surface modifier scaffold.
 * Example requirement: fire skills gain +15% on melted surfaces.
 */
export const getSurfaceSkillPowerMultiplier = (skillId: SkillID, surface: SurfaceStatus): number => {
    if (FIRE_SKILL_IDS.has(skillId) && surface === 'MELTED') {
        return 1.15;
    }
    return 1;
};
