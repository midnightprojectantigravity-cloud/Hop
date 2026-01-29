import type { Point, GameState } from '../types';
import { hexAdd, scaleVector, isHexInRectangularGrid, hexEquals, pointToKey } from '../hex';

/**
 * Return axial targets from origin up to range in the 6 primary hex directions.
 * Stops searching down a direction when a wall is encountered or grid bounds are exceeded.
 */
export const getAxialTargets = (state: GameState, origin: Point, range: number, includeWalls: boolean = false): Point[] => {
    const valid: Point[] = [];
    for (let d = 0; d < 6; d++) {
        for (let i = 1; i <= range; i++) {
            const coord = hexAdd(origin, scaleVector(d, i));

            // Grid bounds
            if (!isHexInRectangularGrid(coord, state.gridWidth, state.gridHeight)) break;

            const isWall = state.tiles.get(pointToKey(coord))?.baseId === 'WALL';
            if (includeWalls) {
                // If there's a wall, include the wall tile (for targeting) then stop further tiles beyond it
                valid.push(coord);
                if (isWall) break;
            } else {
                // If there's a wall, don't include the wall tile (for targeting) then stop further tiles beyond it
                if (isWall) break;
                valid.push(coord);
            }
        }
    }

    return valid;
};

export default getAxialTargets;
