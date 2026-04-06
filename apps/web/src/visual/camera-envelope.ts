import { hexToPixel, type Point } from '@hop/engine';
import { clampCameraCenter, type CameraRect, type CameraVec2 } from './camera';

export interface CameraRowExtent {
    centerY: number;
    minY: number;
    maxY: number;
    minX: number;
    maxX: number;
}

export interface CameraColumnExtent {
    centerX: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export interface CameraEnvelope {
    bounds: CameraRect;
    centroid: CameraVec2;
    rowExtents: CameraRowExtent[];
    columnExtents: CameraColumnExtent[];
    slackWorld: number;
}

const groupKey = (value: number): string => value.toFixed(4);

const clamp = (value: number, min: number, max: number): number => {
    if (value < min) return min;
    if (value > max) return max;
    return value;
};

const resolveNearestRows = (rowExtents: CameraRowExtent[], targetY: number): CameraRowExtent[] => {
    if (rowExtents.length === 0) return [];
    let nearestDistance = Number.POSITIVE_INFINITY;
    let nearestRows: CameraRowExtent[] = [];
    for (const row of rowExtents) {
        const distance = Math.abs(row.centerY - targetY);
        if (distance < nearestDistance - 1e-6) {
            nearestDistance = distance;
            nearestRows = [row];
            continue;
        }
        if (Math.abs(distance - nearestDistance) <= 1e-6) {
            nearestRows.push(row);
        }
    }
    return nearestRows;
};

const resolveNearestColumns = (columnExtents: CameraColumnExtent[], targetX: number): CameraColumnExtent[] => {
    if (columnExtents.length === 0) return [];
    let nearestDistance = Number.POSITIVE_INFINITY;
    let nearestColumns: CameraColumnExtent[] = [];
    for (const column of columnExtents) {
        const distance = Math.abs(column.centerX - targetX);
        if (distance < nearestDistance - 1e-6) {
            nearestDistance = distance;
            nearestColumns = [column];
            continue;
        }
        if (Math.abs(distance - nearestDistance) <= 1e-6) {
            nearestColumns.push(column);
        }
    }
    return nearestColumns;
};

const clampHorizontalCenterToEnvelope = (
    center: CameraVec2,
    visibleWorldSize: { width: number; height: number },
    envelope: CameraEnvelope
): number => {
    if (envelope.rowExtents.length === 0) return center.x;
    if (envelope.bounds.width <= visibleWorldSize.width) return envelope.centroid.x;

    const viewTop = center.y - (visibleWorldSize.height / 2);
    const viewBottom = center.y + (visibleWorldSize.height / 2);
    const activeRows = envelope.rowExtents.filter(row => row.centerY >= viewTop && row.centerY <= viewBottom);
    const rows = activeRows.length > 0 ? activeRows : resolveNearestRows(envelope.rowExtents, center.y);
    const minX = Math.min(...rows.map(row => row.minX));
    const maxX = Math.max(...rows.map(row => row.maxX));
    const minCenterX = minX - envelope.slackWorld + (visibleWorldSize.width / 2);
    const maxCenterX = maxX + envelope.slackWorld - (visibleWorldSize.width / 2);

    if (minCenterX > maxCenterX) {
        return (minX + maxX) / 2;
    }

    return clamp(center.x, minCenterX, maxCenterX);
};

const clampVerticalCenterToEnvelope = (
    center: CameraVec2,
    visibleWorldSize: { width: number; height: number },
    envelope: CameraEnvelope
): number => {
    if (envelope.columnExtents.length === 0) return center.y;
    if (envelope.bounds.height <= visibleWorldSize.height) return envelope.centroid.y;

    const viewLeft = center.x - (visibleWorldSize.width / 2);
    const viewRight = center.x + (visibleWorldSize.width / 2);
    const activeColumns = envelope.columnExtents.filter(column => column.centerX >= viewLeft && column.centerX <= viewRight);
    const columns = activeColumns.length > 0 ? activeColumns : resolveNearestColumns(envelope.columnExtents, center.x);
    const minY = Math.min(...columns.map(column => column.minY));
    const maxY = Math.max(...columns.map(column => column.maxY));
    const minCenterY = minY - envelope.slackWorld + (visibleWorldSize.height / 2);
    const maxCenterY = maxY + envelope.slackWorld - (visibleWorldSize.height / 2);

    if (minCenterY > maxCenterY) {
        return (minY + maxY) / 2;
    }

    return clamp(center.y, minCenterY, maxCenterY);
};

export const createCameraEnvelope = (
    cells: Point[],
    tileSize: number,
    slackWorld = Math.max(1, tileSize * 0.5)
): CameraEnvelope => {
    const halfWidth = Math.max(1, tileSize);
    const halfHeight = Math.max(1, (Math.sqrt(3) * tileSize) / 2);
    const rowMap = new Map<string, CameraRowExtent>();
    const columnMap = new Map<string, CameraColumnExtent>();

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let sumX = 0;
    let sumY = 0;

    for (const cell of cells) {
        const center = hexToPixel(cell, tileSize);
        const cellMinX = center.x - halfWidth;
        const cellMaxX = center.x + halfWidth;
        const cellMinY = center.y - halfHeight;
        const cellMaxY = center.y + halfHeight;
        minX = Math.min(minX, cellMinX);
        minY = Math.min(minY, cellMinY);
        maxX = Math.max(maxX, cellMaxX);
        maxY = Math.max(maxY, cellMaxY);
        sumX += center.x;
        sumY += center.y;

        const rowKey = groupKey(center.y);
        const existingRow = rowMap.get(rowKey);
        if (existingRow) {
            existingRow.minX = Math.min(existingRow.minX, cellMinX);
            existingRow.maxX = Math.max(existingRow.maxX, cellMaxX);
            existingRow.minY = Math.min(existingRow.minY, cellMinY);
            existingRow.maxY = Math.max(existingRow.maxY, cellMaxY);
        } else {
            rowMap.set(rowKey, {
                centerY: center.y,
                minY: cellMinY,
                maxY: cellMaxY,
                minX: cellMinX,
                maxX: cellMaxX
            });
        }

        const columnKey = groupKey(center.x);
        const existingColumn = columnMap.get(columnKey);
        if (existingColumn) {
            existingColumn.minX = Math.min(existingColumn.minX, cellMinX);
            existingColumn.maxX = Math.max(existingColumn.maxX, cellMaxX);
            existingColumn.minY = Math.min(existingColumn.minY, cellMinY);
            existingColumn.maxY = Math.max(existingColumn.maxY, cellMaxY);
        } else {
            columnMap.set(columnKey, {
                centerX: center.x,
                minX: cellMinX,
                maxX: cellMaxX,
                minY: cellMinY,
                maxY: cellMaxY
            });
        }
    }

    if (cells.length === 0 || !Number.isFinite(minX) || !Number.isFinite(minY)) {
        return {
            bounds: { x: 0, y: 0, width: 1, height: 1 },
            centroid: { x: 0, y: 0 },
            rowExtents: [],
            columnExtents: [],
            slackWorld: Math.max(1, slackWorld)
        };
    }

    return {
        bounds: {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        },
        centroid: {
            x: sumX / cells.length,
            y: sumY / cells.length
        },
        rowExtents: Array.from(rowMap.values()).sort((a, b) => a.centerY - b.centerY),
        columnExtents: Array.from(columnMap.values()).sort((a, b) => a.centerX - b.centerX),
        slackWorld: Math.max(1, slackWorld)
    };
};

export const clampCameraCenterToEnvelope = (
    desiredCenter: CameraVec2,
    visibleWorldSize: { width: number; height: number },
    envelope: CameraEnvelope,
    fallbackBounds: CameraRect = envelope.bounds
): CameraVec2 => {
    let center = clampCameraCenter(desiredCenter, visibleWorldSize, fallbackBounds);
    if (envelope.rowExtents.length === 0 || envelope.columnExtents.length === 0) {
        return center;
    }

    for (let i = 0; i < 2; i += 1) {
        center = clampCameraCenter(center, visibleWorldSize, fallbackBounds);
        center = {
            x: clampHorizontalCenterToEnvelope(center, visibleWorldSize, envelope),
            y: center.y
        };
        center = clampCameraCenter(center, visibleWorldSize, fallbackBounds);
        center = {
            x: center.x,
            y: clampVerticalCenterToEnvelope(center, visibleWorldSize, envelope)
        };
    }

    return clampCameraCenter(center, visibleWorldSize, fallbackBounds);
};

const isPointInsideEnvelope = (point: CameraVec2, envelope: CameraEnvelope): boolean => {
    const insideRow = envelope.rowExtents.some(row =>
        point.y >= row.minY
        && point.y <= row.maxY
        && point.x >= row.minX
        && point.x <= row.maxX
    );
    if (insideRow) return true;

    return envelope.columnExtents.some(column =>
        point.x >= column.minX
        && point.x <= column.maxX
        && point.y >= column.minY
        && point.y <= column.maxY
    );
};

export const estimateCameraDeadSpaceRatio = (
    viewBox: CameraRect,
    envelope: CameraEnvelope,
    sampleCount = 12
): number => {
    if (envelope.rowExtents.length === 0 || envelope.columnExtents.length === 0) return 0;

    let emptySamples = 0;
    let totalSamples = 0;
    for (let row = 0; row < sampleCount; row += 1) {
        const y = viewBox.y + (((row + 0.5) / sampleCount) * viewBox.height);
        for (let column = 0; column < sampleCount; column += 1) {
            const x = viewBox.x + (((column + 0.5) / sampleCount) * viewBox.width);
            totalSamples += 1;
            if (!isPointInsideEnvelope({ x, y }, envelope)) {
                emptySamples += 1;
            }
        }
    }

    return totalSamples > 0 ? emptySamples / totalSamples : 0;
};
