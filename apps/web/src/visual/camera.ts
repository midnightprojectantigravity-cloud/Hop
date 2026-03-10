export type CameraZoomPreset = number;

export type CameraVec2 = { x: number; y: number };

export type CameraRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type CameraInsetsPx = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};

export type CameraViewportPx = {
    width: number;
    height: number;
    insets?: Partial<CameraInsetsPx>;
};

export const ACTION_VIEW_MIN_HEX_DIAMETER = 9;
export const TACTICAL_VIEW_MIN_HEX_DIAMETER = 15;

export interface ResolveBinaryZoomLevelsOptions {
    mapWidth: number;
    mapHeight: number;
    movementRange: number;
    tacticalMinHexDiameter?: number;
    actionMinHexDiameter?: number;
}

export const resolveBinaryZoomLevels = ({
    mapWidth,
    mapHeight,
    movementRange,
    tacticalMinHexDiameter = TACTICAL_VIEW_MIN_HEX_DIAMETER,
    actionMinHexDiameter = ACTION_VIEW_MIN_HEX_DIAMETER
}: ResolveBinaryZoomLevelsOptions): { tactical: CameraZoomPreset; action: CameraZoomPreset } => {
    const safeMapWidth = Math.max(1, Math.floor(Number(mapWidth) || 0));
    const safeMapHeight = Math.max(1, Math.floor(Number(mapHeight) || 0));
    const safeMovementRange = Math.max(1, Math.floor(Number(movementRange) || 0));

    // LoS is not yet available, so tactical view uses a map-wide upper bound.
    const tacticalUpperBound = (Math.max(safeMapWidth, safeMapHeight) * 2) + 1;
    const tactical = Math.max(
        Math.max(1, Math.floor(tacticalMinHexDiameter)),
        tacticalUpperBound
    );

    const actionUpperBound = (safeMovementRange * 2) + 3;
    const action = Math.min(
        tactical,
        Math.max(Math.max(1, Math.floor(actionMinHexDiameter)), actionUpperBound)
    );

    return { tactical, action };
};

const clamp = (value: number, min: number, max: number): number => {
    if (value < min) return min;
    if (value > max) return max;
    return value;
};

export const normalizeInsetsPx = (insets?: Partial<CameraInsetsPx>): CameraInsetsPx => ({
    top: Math.max(0, Number(insets?.top ?? 0)),
    right: Math.max(0, Number(insets?.right ?? 0)),
    bottom: Math.max(0, Number(insets?.bottom ?? 0)),
    left: Math.max(0, Number(insets?.left ?? 0)),
});

export const getUsableViewportPx = (viewport: CameraViewportPx): { width: number; height: number; insets: CameraInsetsPx } => {
    const insets = normalizeInsetsPx(viewport.insets);
    const width = Math.max(1, Number(viewport.width || 0) - insets.left - insets.right);
    const height = Math.max(1, Number(viewport.height || 0) - insets.top - insets.bottom);
    return { width, height, insets };
};

export const computePresetVisibleWidthWorld = (
    preset: CameraZoomPreset,
    tileSize: number,
    extraPaddingWorld = 0
): number => {
    const safeTileSize = Math.max(1, tileSize);
    const columnStep = 1.5 * safeTileSize;
    const hexWidth = 2 * safeTileSize;
    const clampedPreset = Math.max(1, preset);
    return ((clampedPreset - 1) * columnStep) + hexWidth + Math.max(0, extraPaddingWorld) * 2;
};

export const computePresetScale = (
    viewport: CameraViewportPx,
    preset: CameraZoomPreset,
    tileSize: number,
    extraPaddingWorld = 0
): number => {
    const usable = getUsableViewportPx(viewport);
    const visibleWorldWidth = computePresetVisibleWidthWorld(preset, tileSize, extraPaddingWorld);
    return usable.width / Math.max(1, visibleWorldWidth);
};

export const computeFitScale = (
    viewport: CameraViewportPx,
    mapBounds: CameraRect
): number => {
    const usable = getUsableViewportPx(viewport);
    const safeWidth = Math.max(1, mapBounds.width);
    const safeHeight = Math.max(1, mapBounds.height);
    return Math.min(usable.width / safeWidth, usable.height / safeHeight);
};

export const expandRect = (rect: CameraRect, paddingWorld: number): CameraRect => ({
    x: rect.x - paddingWorld,
    y: rect.y - paddingWorld,
    width: rect.width + paddingWorld * 2,
    height: rect.height + paddingWorld * 2,
});

export const computeEffectiveScale = (fitScale: number, presetScale: number): number => {
    const safeFit = Math.max(1e-6, fitScale);
    const safePreset = Math.max(1e-6, presetScale);
    return Math.max(safeFit, safePreset);
};

export const computeVisibleWorldSize = (
    viewport: CameraViewportPx,
    scale: number
): { width: number; height: number } => {
    const usable = getUsableViewportPx(viewport);
    const safeScale = Math.max(1e-6, scale);
    return {
        width: usable.width / safeScale,
        height: usable.height / safeScale
    };
};

export const clampCameraCenter = (
    desiredCenter: CameraVec2,
    visibleWorldSize: { width: number; height: number },
    bounds: CameraRect
): CameraVec2 => {
    const halfW = visibleWorldSize.width / 2;
    const halfH = visibleWorldSize.height / 2;

    const minCenterX = bounds.x + halfW;
    const maxCenterX = bounds.x + bounds.width - halfW;
    const minCenterY = bounds.y + halfH;
    const maxCenterY = bounds.y + bounds.height - halfH;

    return {
        x: minCenterX > maxCenterX ? bounds.x + bounds.width / 2 : clamp(desiredCenter.x, minCenterX, maxCenterX),
        y: minCenterY > maxCenterY ? bounds.y + bounds.height / 2 : clamp(desiredCenter.y, minCenterY, maxCenterY),
    };
};

export const computeViewBoxFromCamera = (
    center: CameraVec2,
    visibleWorldSize: { width: number; height: number }
): CameraRect => ({
    x: center.x - visibleWorldSize.width / 2,
    y: center.y - visibleWorldSize.height / 2,
    width: visibleWorldSize.width,
    height: visibleWorldSize.height,
});

export interface ResolveSoftFollowCenterOptions {
    currentCenter: CameraVec2;
    desiredCenter: CameraVec2;
    visibleWorldSize: { width: number; height: number };
    bounds: CameraRect;
    deadZoneRatio?: number;
    followStrength?: number;
    maxStepRatio?: number;
}

export const resolveSoftFollowCenter = ({
    currentCenter,
    desiredCenter,
    visibleWorldSize,
    bounds,
    deadZoneRatio = 0.22,
    followStrength = 0.5,
    maxStepRatio = 0.14
}: ResolveSoftFollowCenterOptions): CameraVec2 => {
    const safeDeadZoneRatio = clamp(deadZoneRatio, 0, 0.8);
    const safeFollowStrength = clamp(followStrength, 0.05, 1);
    const safeMaxStepRatio = clamp(maxStepRatio, 0.02, 1);
    const clampedDesired = clampCameraCenter(desiredCenter, visibleWorldSize, bounds);
    const dx = clampedDesired.x - currentCenter.x;
    const dy = clampedDesired.y - currentCenter.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 1e-4) return currentCenter;

    const referenceSize = Math.max(1, Math.min(visibleWorldSize.width, visibleWorldSize.height));
    const deadZone = referenceSize * safeDeadZoneRatio;
    if (distance <= deadZone) return currentCenter;

    const stepFromDistance = (distance - deadZone) * safeFollowStrength;
    const maxStep = referenceSize * safeMaxStepRatio;
    const step = clamp(stepFromDistance, 0, maxStep);
    if (step <= 1e-4) return currentCenter;

    const nx = currentCenter.x + (dx / distance) * step;
    const ny = currentCenter.y + (dy / distance) * step;
    return clampCameraCenter({ x: nx, y: ny }, visibleWorldSize, bounds);
};
