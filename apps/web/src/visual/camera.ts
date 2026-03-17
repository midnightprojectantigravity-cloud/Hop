export type CameraZoomPreset = number;
export type CameraZoomMode = 'tactical' | 'action';

export type CameraVec2 = { x: number; y: number };
export type CameraAnchorRatio = { x: number; y: number };

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

export const ACTION_VIEW_MIN_HEX_DIAMETER = 7;
export const TACTICAL_VIEW_MIN_HEX_DIAMETER = 11;
export const ACTION_VIEW_MAX_HEX_WIDTH_PX = 128;
export const ACTION_VIEW_MAX_HEX_HEIGHT_PX = 112;
export const TACTICAL_VIEW_MAX_HEX_WIDTH_PX = 104;
export const TACTICAL_VIEW_MAX_HEX_HEIGHT_PX = 92;

export interface ResolveBinaryZoomLevelsOptions {
    mapWidth: number;
    mapHeight: number;
    movementRange: number;
    losRange?: number;
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
    const safeMapMinAxis = Math.max(1, Math.min(safeMapWidth, safeMapHeight));
    const safeMovementRange = Math.max(1, Math.floor(Number(movementRange) || 0));
    const action = Math.min(
        safeMapMinAxis,
        Math.max(
            Math.max(1, Math.floor(actionMinHexDiameter)),
            (safeMovementRange * 2) + 3
        )
    );
    const tactical = Math.min(
        safeMapMinAxis,
        Math.max(
            Math.max(1, Math.floor(tacticalMinHexDiameter)),
            action + 4
        )
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

export const computePresetVisibleHeightWorld = (
    preset: CameraZoomPreset,
    tileSize: number,
    extraPaddingWorld = 0
): number => {
    const safeTileSize = Math.max(1, tileSize);
    const rowStep = Math.sqrt(3) * safeTileSize;
    const hexHeight = Math.sqrt(3) * safeTileSize;
    const clampedPreset = Math.max(1, preset);
    return ((clampedPreset - 1) * rowStep) + hexHeight + Math.max(0, extraPaddingWorld) * 2;
};

export const computePresetScale = (
    viewport: CameraViewportPx,
    preset: CameraZoomPreset,
    tileSize: number,
    extraPaddingWorld = 0
): number => {
    const usable = getUsableViewportPx(viewport);
    const visibleWorldWidth = computePresetVisibleWidthWorld(preset, tileSize, extraPaddingWorld);
    const visibleWorldHeight = computePresetVisibleHeightWorld(preset, tileSize, extraPaddingWorld);
    const widthScale = usable.width / Math.max(1, visibleWorldWidth);
    const heightScale = usable.height / Math.max(1, visibleWorldHeight);
    return Math.min(widthScale, heightScale);
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

export const constrainRectToBounds = (
    rect: CameraRect,
    bounds: CameraRect
): CameraRect => {
    const width = Math.min(rect.width, bounds.width);
    const height = Math.min(rect.height, bounds.height);
    const halfW = width / 2;
    const halfH = height / 2;
    const desiredCenterX = rect.x + (rect.width / 2);
    const desiredCenterY = rect.y + (rect.height / 2);
    const minCenterX = bounds.x + halfW;
    const maxCenterX = bounds.x + bounds.width - halfW;
    const minCenterY = bounds.y + halfH;
    const maxCenterY = bounds.y + bounds.height - halfH;
    const centerX = minCenterX > maxCenterX
        ? bounds.x + (bounds.width / 2)
        : clamp(desiredCenterX, minCenterX, maxCenterX);
    const centerY = minCenterY > maxCenterY
        ? bounds.y + (bounds.height / 2)
        : clamp(desiredCenterY, minCenterY, maxCenterY);

    return {
        x: centerX - halfW,
        y: centerY - halfH,
        width,
        height
    };
};

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

const resolvePresetForMaxHexSize = ({
    viewport,
    floorPreset,
    tileSize,
    maxHexWidthPx,
    maxHexHeightPx,
    extraPaddingWorld = 0
}: {
    viewport: CameraViewportPx;
    floorPreset: CameraZoomPreset;
    tileSize: number;
    maxHexWidthPx: number;
    maxHexHeightPx: number;
    extraPaddingWorld?: number;
}): CameraZoomPreset => {
    const usable = getUsableViewportPx(viewport);
    const safeTileSize = Math.max(1, tileSize);
    const hexWidthWorld = safeTileSize * 2;
    const hexHeightWorld = Math.sqrt(3) * safeTileSize;
    const minVisibleWidthWorld = usable.width * (hexWidthWorld / Math.max(1, maxHexWidthPx));
    const minVisibleHeightWorld = usable.height * (hexHeightWorld / Math.max(1, maxHexHeightPx));
    let preset = Math.max(1, Math.floor(floorPreset));

    while (
        (computePresetVisibleWidthWorld(preset, tileSize, extraPaddingWorld) < minVisibleWidthWorld
            || computePresetVisibleHeightWorld(preset, tileSize, extraPaddingWorld) < minVisibleHeightWorld)
        && preset < 512
    ) {
        preset += 1;
    }

    return preset;
};

export interface ResponsiveZoomProfile {
    mode: CameraZoomMode;
    floorPreset: CameraZoomPreset;
    preset: CameraZoomPreset;
    maxHexWidthPx: number;
    maxHexHeightPx: number;
}

export interface ResolveResponsiveZoomProfileOptions {
    mode: CameraZoomMode;
    viewport: CameraViewportPx;
    tileSize: number;
    movementRange: number;
    extraPaddingWorld?: number;
    tacticalMinHexDiameter?: number;
    actionMinHexDiameter?: number;
    actionMaxHexWidthPx?: number;
    actionMaxHexHeightPx?: number;
    tacticalMaxHexWidthPx?: number;
    tacticalMaxHexHeightPx?: number;
}

export const resolveResponsiveZoomProfile = ({
    mode,
    viewport,
    tileSize,
    movementRange,
    extraPaddingWorld = 0,
    tacticalMinHexDiameter = TACTICAL_VIEW_MIN_HEX_DIAMETER,
    actionMinHexDiameter = ACTION_VIEW_MIN_HEX_DIAMETER,
    actionMaxHexWidthPx = ACTION_VIEW_MAX_HEX_WIDTH_PX,
    actionMaxHexHeightPx = ACTION_VIEW_MAX_HEX_HEIGHT_PX,
    tacticalMaxHexWidthPx = TACTICAL_VIEW_MAX_HEX_WIDTH_PX,
    tacticalMaxHexHeightPx = TACTICAL_VIEW_MAX_HEX_HEIGHT_PX,
}: ResolveResponsiveZoomProfileOptions): ResponsiveZoomProfile => {
    const safeMovementRange = Math.max(1, Math.floor(Number(movementRange) || 0));
    const actionFloorPreset = Math.max(
        Math.max(1, Math.floor(actionMinHexDiameter)),
        (safeMovementRange * 2) + 3
    );
    const tacticalFloorPreset = Math.max(
        Math.max(1, Math.floor(tacticalMinHexDiameter)),
        actionFloorPreset + 4
    );
    const floorPreset = mode === 'action' ? actionFloorPreset : tacticalFloorPreset;
    const maxHexWidthPx = mode === 'action' ? actionMaxHexWidthPx : tacticalMaxHexWidthPx;
    const maxHexHeightPx = mode === 'action' ? actionMaxHexHeightPx : tacticalMaxHexHeightPx;
    const preset = resolvePresetForMaxHexSize({
        viewport,
        floorPreset,
        tileSize,
        maxHexWidthPx,
        maxHexHeightPx,
        extraPaddingWorld
    });

    return {
        mode,
        floorPreset,
        preset,
        maxHexWidthPx,
        maxHexHeightPx
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

export const resolveCameraAnchorRatio = (
    viewport: CameraViewportPx
): CameraAnchorRatio => {
    const insets = normalizeInsetsPx(viewport.insets);
    const totalWidth = Math.max(1, Number(viewport.width || 0));
    const totalHeight = Math.max(1, Number(viewport.height || 0));
    const usableWidth = Math.max(1, totalWidth - insets.left - insets.right);
    const usableHeight = Math.max(1, totalHeight - insets.top - insets.bottom);
    return {
        x: clamp((insets.left + (usableWidth / 2)) / totalWidth, 0, 1),
        y: clamp((insets.top + (usableHeight / 2)) / totalHeight, 0, 1)
    };
};

export const computeDesiredCenterForAnchor = (
    targetWorld: CameraVec2,
    visibleWorldSize: { width: number; height: number },
    anchorRatio: CameraAnchorRatio
): CameraVec2 => ({
    x: targetWorld.x + ((0.5 - anchorRatio.x) * visibleWorldSize.width),
    y: targetWorld.y + ((0.5 - anchorRatio.y) * visibleWorldSize.height)
});

export const computeZoomBoundsForPreset = ({
    playerWorld,
    preset,
    tileSize,
    mapBounds,
    extraPaddingWorld = 0
}: {
    playerWorld: CameraVec2;
    preset: CameraZoomPreset;
    tileSize: number;
    mapBounds?: CameraRect;
    extraPaddingWorld?: number;
}): CameraRect => {
    const width = computePresetVisibleWidthWorld(preset, tileSize, extraPaddingWorld);
    const height = computePresetVisibleHeightWorld(preset, tileSize, extraPaddingWorld);
    const requestedBounds = {
        x: playerWorld.x - (width / 2),
        y: playerWorld.y - (height / 2),
        width,
        height
    };
    return mapBounds
        ? constrainRectToBounds(requestedBounds, mapBounds)
        : requestedBounds;
};

export const computeActionZoomBounds = ({
    playerWorld,
    movementRange,
    tileSize,
    viewport,
    mapBounds,
    minHexDiameter = ACTION_VIEW_MIN_HEX_DIAMETER,
    maxHexWidthPx = ACTION_VIEW_MAX_HEX_WIDTH_PX,
    maxHexHeightPx = ACTION_VIEW_MAX_HEX_HEIGHT_PX,
    extraPaddingWorld = 0
}: {
    playerWorld: CameraVec2;
    movementRange: number;
    tileSize: number;
    viewport: CameraViewportPx;
    mapBounds?: CameraRect;
    minHexDiameter?: number;
    maxHexWidthPx?: number;
    maxHexHeightPx?: number;
    extraPaddingWorld?: number;
}): CameraRect => {
    const profile = resolveResponsiveZoomProfile({
        mode: 'action',
        viewport,
        tileSize,
        movementRange,
        extraPaddingWorld,
        actionMinHexDiameter: minHexDiameter,
        actionMaxHexWidthPx: maxHexWidthPx,
        actionMaxHexHeightPx: maxHexHeightPx
    });
    return computeZoomBoundsForPreset({
        playerWorld,
        preset: profile.preset,
        tileSize,
        mapBounds,
        extraPaddingWorld
    });
};

export const computeTacticalZoomBounds = ({
    playerWorld,
    movementRange,
    mapBounds,
    tileSize,
    viewport,
    minHexDiameter = TACTICAL_VIEW_MIN_HEX_DIAMETER,
    maxHexWidthPx = TACTICAL_VIEW_MAX_HEX_WIDTH_PX,
    maxHexHeightPx = TACTICAL_VIEW_MAX_HEX_HEIGHT_PX,
    extraPaddingWorld = 0
}: {
    playerWorld: CameraVec2;
    movementRange: number;
    mapBounds: CameraRect;
    tileSize: number;
    viewport: CameraViewportPx;
    minHexDiameter?: number;
    maxHexWidthPx?: number;
    maxHexHeightPx?: number;
    extraPaddingWorld?: number;
}): CameraRect => {
    const profile = resolveResponsiveZoomProfile({
        mode: 'tactical',
        viewport,
        tileSize,
        movementRange,
        extraPaddingWorld,
        tacticalMinHexDiameter: minHexDiameter,
        tacticalMaxHexWidthPx: maxHexWidthPx,
        tacticalMaxHexHeightPx: maxHexHeightPx
    });
    return computeZoomBoundsForPreset({
        playerWorld,
        preset: profile.preset,
        tileSize,
        mapBounds,
        extraPaddingWorld
    });
};

export const computeCameraViewFromBounds = (
    viewport: CameraViewportPx,
    bounds: CameraRect
): {
    center: CameraVec2;
    scale: number;
    visibleWorldSize: { width: number; height: number };
    viewBox: CameraRect;
} => {
    const scale = computeFitScale(viewport, bounds);
    const visibleWorldSize = computeVisibleWorldSize(viewport, scale);
    const center = {
        x: bounds.x + (bounds.width / 2),
        y: bounds.y + (bounds.height / 2)
    };
    return {
        center,
        scale,
        visibleWorldSize,
        viewBox: computeViewBoxFromCamera(center, visibleWorldSize)
    };
};

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
