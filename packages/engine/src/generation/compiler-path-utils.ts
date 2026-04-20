import type { Point } from '../types';
import { createHex, pointToKey } from '../hex';
import type { GeneratedPathNetwork, PathEdge, RouteMembership } from './schema';
import type { Tile } from '../systems/tiles/tile-types';

export const parseKeyToHex = (key: string): Point => {
    const [q, r] = key.split(',').map(Number);
    return createHex(q, r);
};

const canonicalPathEdge = (left: string, right: string): PathEdge =>
    left.localeCompare(right) <= 0
        ? { fromKey: left, toKey: right }
        : { fromKey: right, toKey: left };

export const buildEdgeSignature = (edge: PathEdge): string => `${edge.fromKey}|${edge.toKey}`;

export const buildEdgesFromTileKeys = (tileKeys: string[]): PathEdge[] => {
    const seen = new Set<string>();
    const edges: PathEdge[] = [];
    for (let index = 1; index < tileKeys.length; index += 1) {
        const previous = tileKeys[index - 1];
        const current = tileKeys[index];
        if (!previous || !current || previous === current) continue;
        const edge = canonicalPathEdge(previous, current);
        const signature = buildEdgeSignature(edge);
        if (seen.has(signature)) continue;
        seen.add(signature);
        edges.push(edge);
    }
    return edges;
};

export const sortPathEdges = (edges: Iterable<PathEdge>): PathEdge[] =>
    Array.from(edges).sort((left, right) =>
        left.fromKey.localeCompare(right.fromKey) || left.toKey.localeCompare(right.toKey)
    );

export const walkableNeighborKeys = (point: Point): string[] => ([
    createHex(point.q + 1, point.r),
    createHex(point.q + 1, point.r - 1),
    createHex(point.q, point.r - 1),
    createHex(point.q - 1, point.r),
    createHex(point.q - 1, point.r + 1),
    createHex(point.q, point.r + 1)
]).map(pointToKey);

export const isPathEligibleTile = (tile: Tile | undefined): boolean =>
    !!tile && tile.baseId !== 'VOID' && !tile.traits.has('BLOCKS_MOVEMENT');

export const isHazardousPathTile = (tile: Tile | undefined): boolean =>
    !!tile && tile.traits.has('HAZARDOUS');

const buildSegmentDirectionKey = (fromKey: string, toKey: string): string => {
    const from = parseKeyToHex(fromKey);
    const to = parseKeyToHex(toKey);
    return `${to.q - from.q},${to.r - from.r}`;
};

export const buildPathBendKeys = (pathNetwork: GeneratedPathNetwork): Set<string> => {
    const bendKeys = new Set<string>();
    pathNetwork.segments
        .filter(segment => segment.kind !== 'spur')
        .forEach(segment => {
            for (let index = 1; index < segment.tileKeys.length - 1; index += 1) {
                const previousKey = segment.tileKeys[index - 1]!;
                const currentKey = segment.tileKeys[index]!;
                const nextKey = segment.tileKeys[index + 1]!;
                if (buildSegmentDirectionKey(previousKey, currentKey) !== buildSegmentDirectionKey(currentKey, nextKey)) {
                    bendKeys.add(currentKey);
                }
            }
        });
    return bendKeys;
};

export const computeMaxStraightRun = (
    pathNetwork: GeneratedPathNetwork,
    additionalBreakKeys: ReadonlySet<string> = new Set<string>()
): number => {
    const breakKeys = new Set<string>([
        ...pathNetwork.junctionTileKeys,
        ...Array.from(buildPathBendKeys(pathNetwork)),
        ...Array.from(additionalBreakKeys)
    ]);
    let maxStraightRun = 0;
    pathNetwork.segments
        .filter(segment => segment.kind !== 'spur')
        .forEach(segment => {
            if (segment.tileKeys.length === 0) return;
            maxStraightRun = Math.max(maxStraightRun, 1);
            let lastDirection = '';
            let runLength = 1;
            for (let index = 1; index < segment.tileKeys.length; index += 1) {
                const previousKey = segment.tileKeys[index - 1]!;
                const currentKey = segment.tileKeys[index]!;
                if (breakKeys.has(previousKey) || breakKeys.has(currentKey)) {
                    lastDirection = '';
                    runLength = 1;
                    maxStraightRun = Math.max(maxStraightRun, runLength);
                    continue;
                }
                const nextDirection = buildSegmentDirectionKey(previousKey, currentKey);
                if (nextDirection === lastDirection) {
                    runLength += 1;
                } else {
                    runLength = 2;
                    lastDirection = nextDirection;
                }
                maxStraightRun = Math.max(maxStraightRun, runLength);
            }
        });
    return maxStraightRun;
};

export const resolveTileRouteMembership = (
    pathNetwork: GeneratedPathNetwork,
    tileKey: string
): Exclude<RouteMembership, 'hidden'> => {
    const memberships = new Set<Exclude<RouteMembership, 'hidden'>>();
    pathNetwork.segments
        .filter(segment => segment.kind !== 'spur' && segment.tileKeys.includes(tileKey))
        .forEach(segment => memberships.add(segment.routeMembership));
    if (memberships.has('shared')) return 'shared';
    if (memberships.has('primary') && memberships.has('alternate')) return 'shared';
    if (memberships.has('alternate')) return 'alternate';
    return 'primary';
};
