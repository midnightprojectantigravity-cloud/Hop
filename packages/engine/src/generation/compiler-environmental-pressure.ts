import type { FloorTheme, Point } from '../types';
import { pointToKey } from '../hex';
import { createRng32, shuffleStable } from './rng32';
import { resolveBiomeHazardTileId } from '../systems/biomes';
import type { Tile } from '../systems/tiles/tile-types';
import { walkableNeighborKeys, buildPathBendKeys, computeMaxStraightRun, isPathEligibleTile, parseKeyToHex, resolveTileRouteMembership } from './compiler-path-utils';
import type { AuthoredFloorSpec, EnvironmentalPressureCluster, FloorIntentRequest, GeneratedPathNetwork, RouteMembership, RouteProfile, SpatialClaim } from './schema';
import type { BaseArena } from './compiler-context';
import { BASE_TILES } from '../systems/tiles/tile-registry';

type AuthoredFloor = AuthoredFloorSpec;

const buildClaimKeySet = (
    claims: SpatialClaim[],
    hardness?: 'hard'
): Set<string> => {
    const keys = new Set<string>();
    for (const claim of claims) {
        if (hardness && claim.hardness !== hardness) continue;
        for (const cell of claim.cells) {
            keys.add(pointToKey(cell));
        }
    }
    return keys;
};

const createTile = (baseId: 'STONE' | 'WALL' | 'LAVA' | 'VOID' | 'TOXIC', position: Point): Tile => ({
    baseId,
    position,
    traits: new Set(BASE_TILES[baseId].defaultTraits),
    effects: []
});

export const buildStraightRunHotspotKeys = (pathNetwork: GeneratedPathNetwork, minStraightRun: number): Set<string> => {
    const hotspots = new Set<string>();
    if (minStraightRun <= 0) return hotspots;
    const orderedTiles = new Set(pathNetwork.visualTileKeys.length > 0 ? pathNetwork.visualTileKeys : pathNetwork.tacticalTileKeys);
    const segments = pathNetwork.segments
        .filter(segment => segment.kind !== 'spur')
        .map(segment => segment.tileKeys)
        .filter(tileKeys => tileKeys.length > 0);

    for (const tileKeys of segments) {
        let runStart = 0;
        while (runStart < tileKeys.length) {
            let runEnd = runStart + 1;
            while (runEnd < tileKeys.length) {
                const previous = parseKeyToHex(tileKeys[runEnd - 1]!);
                const current = parseKeyToHex(tileKeys[runEnd]!);
                const before = runEnd - 2 >= runStart ? parseKeyToHex(tileKeys[runEnd - 2]!) : undefined;
                const direction = `${current.q - previous.q},${current.r - previous.r}`;
                const beforeDirection = before ? `${previous.q - before.q},${previous.r - before.r}` : undefined;
                if (beforeDirection && beforeDirection !== direction) break;
                runEnd += 1;
            }
            const runLength = runEnd - runStart;
            if (runLength >= minStraightRun) {
                for (let index = runStart; index < runEnd; index += 1) {
                    const key = tileKeys[index]!;
                    if (orderedTiles.has(key)) hotspots.add(key);
                }
            }
            runStart = runEnd;
        }
    }

    return hotspots;
};

export const applyEnvironmentalPressure = (
    arena: BaseArena,
    tiles: Map<string, Tile>,
    pathNetwork: GeneratedPathNetwork,
    intent: FloorIntentRequest,
    seed: string,
    authoredFloor?: AuthoredFloor,
    claims: SpatialClaim[] = [],
    appliedTheme?: FloorTheme
): { tiles: Map<string, Tile>; pathNetwork: GeneratedPathNetwork; diagnostics: string[] } => {
    const nextTiles = new Map(tiles);
    const clusters: EnvironmentalPressureCluster[] = [];
    const hardClaimKeys = buildClaimKeySet(claims, 'hard');
    const specials = new Set<string>([
        pointToKey(arena.playerSpawn),
        pointToKey(arena.stairsPosition),
        ...(arena.shrinePosition ? [pointToKey(arena.shrinePosition)] : [])
    ]);
    const landmarkKeys = new Set(pathNetwork.landmarks.map(landmark => pointToKey(landmark.point)));
    const tacticalRouteTileKeys = new Set(pathNetwork.tacticalTileKeys);
    const usedTileKeys = new Set<string>();
    const bendKeys = Array.from(buildPathBendKeys(pathNetwork)).sort();
    const rng = createRng32(`${seed}:route-pressure`);
    const profile = intent.routeProfile;
    const straightRunHotspots = Array.from(buildStraightRunHotspotKeys(pathNetwork, Math.max(3, profile.maxStraightRun))).sort();
    const clusterCenterKeys = Array.from(new Set([...pathNetwork.junctionTileKeys, ...bendKeys, ...straightRunHotspots])).sort();
    const mutablePathNetwork: GeneratedPathNetwork = {
        ...pathNetwork,
        environmentalPressureClusters: [],
        maxStraightRun: pathNetwork.maxStraightRun
    };

    const trapPriority = intent.role === 'recovery'
        ? ['alternate', 'shared', 'primary'] as const
        : profile.saferRouteBias === 'strong' || profile.riskierRouteBias === 'strong'
            ? ['alternate', 'shared', 'primary'] as const
            : ['shared', 'alternate', 'primary'] as const;
    const obstaclePriority = intent.role === 'recovery'
        ? ['alternate', 'shared', 'primary'] as const
        : intent.role === 'pressure_spike' || intent.role === 'elite'
            ? ['shared', 'primary', 'alternate'] as const
            : ['shared', 'alternate', 'primary'] as const;
    const lavaPriority = intent.role === 'pressure_spike' || intent.role === 'elite'
        ? ['alternate', 'shared', 'primary'] as const
        : ['shared', 'alternate', 'primary'] as const;

    const isMutablePressureKey = (key: string): boolean =>
        !hardClaimKeys.has(key)
        && !specials.has(key)
        && !landmarkKeys.has(key)
        && !usedTileKeys.has(key);

    const resolvePressureRouteMembership = (key: string): Exclude<RouteMembership, 'hidden'> => {
        if (pathNetwork.visualTileKeys.includes(key)) {
            return resolveTileRouteMembership(pathNetwork, key);
        }
        const neighboringMemberships = walkableNeighborKeys(parseKeyToHex(key))
            .filter(neighborKey => pathNetwork.visualTileKeys.includes(neighborKey))
            .map(neighborKey => resolveTileRouteMembership(pathNetwork, neighborKey));
        if (neighboringMemberships.includes('shared')) return 'shared';
        if (neighboringMemberships.includes('alternate')) return 'alternate';
        return 'primary';
    };

    const prioritizeHexKeys = (
        keys: string[],
        priority: readonly ['primary' | 'alternate' | 'shared', 'primary' | 'alternate' | 'shared', 'primary' | 'alternate' | 'shared'],
        membershipResolver: (key: string) => Exclude<RouteMembership, 'hidden'> = (key) => resolveTileRouteMembership(pathNetwork, key)
    ): Point[] => priority.flatMap(routeMembership =>
        shuffleStable(
            keys
                .filter(key => membershipResolver(key) === routeMembership)
                .sort((left, right) => left.localeCompare(right))
                .map(parseKeyToHex),
            rng
        )
    );

    const pushObstacleCluster = (centerKey: string): boolean => {
        const center = parseKeyToHex(centerKey);
        const routeMembership = resolvePressureRouteMembership(centerKey);
        const candidateKeys = walkableNeighborKeys(center)
            .sort((left, right) => left.localeCompare(right))
            .filter(key =>
                !hardClaimKeys.has(key)
                && !tacticalRouteTileKeys.has(key)
                && !specials.has(key)
                && !landmarkKeys.has(key)
                && !usedTileKeys.has(key)
            );
        const clusterKeys: string[] = [];
        for (const candidateKey of candidateKeys) {
            const tile = nextTiles.get(candidateKey);
            if (!tile || tile.baseId !== 'STONE' || tile.traits.has('BLOCKS_MOVEMENT')) continue;
            nextTiles.set(candidateKey, createTile('WALL', tile.position));
            usedTileKeys.add(candidateKey);
            clusterKeys.push(candidateKey);
            if (clusterKeys.length >= 2) break;
        }
        if (clusterKeys.length === 0) return false;
        clusters.push({
            id: `obstacle:${clusters.length}:${centerKey}`,
            kind: 'obstacle',
            routeMembership,
            tileKeys: clusterKeys
        });
        return true;
    };

    const pushLavaCluster = (centerKey: string): boolean => {
        const centerTile = nextTiles.get(centerKey);
        if (!centerTile || centerTile.baseId !== 'STONE' || tacticalRouteTileKeys.has(centerKey) || !isMutablePressureKey(centerKey)) {
            return false;
        }

        const routeMembership = resolveTileRouteMembership(pathNetwork, centerKey);
        const clusterKeys = [centerKey];
        nextTiles.set(centerKey, createTile(resolveBiomeHazardTileId(appliedTheme), centerTile.position));
        usedTileKeys.add(centerKey);

        const allowSecondTile = intent.role === 'pressure_spike' || intent.role === 'elite';
        if (allowSecondTile) {
            const secondaryKey = walkableNeighborKeys(centerTile.position)
                .sort((left, right) => left.localeCompare(right))
                .find(candidateKey => {
                    const tile = nextTiles.get(candidateKey);
                    return !!tile
                        && tile.baseId === 'STONE'
                        && !tacticalRouteTileKeys.has(candidateKey)
                        && isMutablePressureKey(candidateKey)
                    && resolvePressureRouteMembership(candidateKey) === routeMembership;
                });
            if (secondaryKey) {
                const secondaryTile = nextTiles.get(secondaryKey)!;
                nextTiles.set(secondaryKey, createTile(resolveBiomeHazardTileId(appliedTheme), secondaryTile.position));
                usedTileKeys.add(secondaryKey);
                clusterKeys.push(secondaryKey);
            }
        }

        clusters.push({
            id: `lava:${clusters.length}:${centerKey}`,
            kind: 'lava',
            routeMembership,
            tileKeys: clusterKeys
        });
        return true;
    };

    const trapTiles = prioritizeHexKeys(
        pathNetwork.visualTileKeys
            .filter(key => isMutablePressureKey(key)),
        trapPriority
    );
    const lavaCandidateKeys = Array.from(new Set(
        pathNetwork.visualTileKeys.flatMap(key => walkableNeighborKeys(parseKeyToHex(key)))
    ))
        .sort((left, right) => left.localeCompare(right))
        .filter(key => {
            const tile = nextTiles.get(key);
            return !!tile
                && tile.baseId === 'STONE'
                && !tacticalRouteTileKeys.has(key)
                && isMutablePressureKey(key)
                && (intent.role !== 'recovery' || resolvePressureRouteMembership(key) !== 'primary')
                && walkableNeighborKeys(parseKeyToHex(key)).some(neighborKey => tacticalRouteTileKeys.has(neighborKey));
        });

    const obstacleCenters = prioritizeHexKeys(clusterCenterKeys, obstaclePriority);
    if (!authoredFloor) {
        let obstacleCount = 0;
        for (const center of obstacleCenters) {
            if (obstacleCount >= profile.obstacleClusterBudget) break;
            if (pushObstacleCluster(pointToKey(center))) obstacleCount += 1;
        }
    }

    const lavaBudget = intent.theme === 'inferno'
        ? authoredFloor ? Math.min(1, profile.lavaClusterBudget) : profile.lavaClusterBudget
        : 0;
    let lavaCount = 0;
    for (const point of prioritizeHexKeys(lavaCandidateKeys, lavaPriority, resolvePressureRouteMembership)) {
        if (lavaCount >= lavaBudget) break;
        if (pushLavaCluster(pointToKey(point))) lavaCount += 1;
    }

    if (!authoredFloor) {
        let trapCount = 0;
        const trapBudget = Math.max(0, profile.trapClusterBudget - lavaCount);
        for (const point of trapTiles) {
            if (trapCount >= trapBudget) break;
            const key = pointToKey(point);
            const tile = nextTiles.get(key);
            if (!tile || tile.baseId !== 'STONE') continue;
            if (tile.effects.some(effect => effect.id === 'SNARE' || effect.id === 'FIRE')) continue;
            const effectId = trapCount % 2 === 0 ? 'SNARE' : 'FIRE';
            nextTiles.set(key, {
                ...tile,
                effects: [...tile.effects, { id: effectId, duration: -1, potency: 1 }]
            });
            usedTileKeys.add(key);
            clusters.push({
                id: `trap:${clusters.length}:${key}`,
                kind: 'trap',
                routeMembership: resolveTileRouteMembership(pathNetwork, key),
                tileKeys: [key],
                trapKind: effectId === 'SNARE' ? 'snare_surface' : 'fire_surface'
            });
            trapCount += 1;
        }
    }

    mutablePathNetwork.environmentalPressureClusters = clusters.sort((left, right) => left.id.localeCompare(right.id));
    mutablePathNetwork.maxStraightRun = computeMaxStraightRun(
        mutablePathNetwork,
        new Set(mutablePathNetwork.environmentalPressureClusters.flatMap(cluster => cluster.tileKeys))
    );

    return {
        tiles: nextTiles,
        pathNetwork: mutablePathNetwork,
        diagnostics: []
    };
};
