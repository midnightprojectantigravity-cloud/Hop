import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { GameState, Point, MovementTrace, SimulationEvent, StateMirrorSnapshot } from '@hop/engine';
import {
    isTileInDiamond, hexToPixel,
    TILE_SIZE, SkillRegistry, pointToKey, UnifiedTileService, previewActionOutcome, getHexLine
} from '@hop/engine';
import { HexTile } from './HexTile';
import { Entity } from './Entity';
import PreviewOverlay from './PreviewOverlay';
import { JuiceManager } from './JuiceManager';
import type {
    VisualAssetManifest,
    VisualAssetEntry,
    VisualBiomeThemePreset,
    VisualBiomeTextureLayer,
    VisualBiomeClutterLayer,
    VisualBiomeWallsProfile,
    VisualBiomeWallsThemeOverride,
    VisualBiomeMaterialProfile,
    VisualMountainRenderSettings,
    VisualBiomeTintProfile,
    VisualBlendMode
} from '../visual/asset-manifest';
import { getBiomeThemePreset } from '../visual/asset-manifest';
import {
    resolveTileAssetId,
    resolvePropAssetId,
    resolveUnitAssetId,
    resolveDeathDecalAssetId,
    resolveUnitFallbackAssetHref
} from '../visual/asset-selectors';
import {
    type CameraInsetsPx,
    type CameraRect,
    type CameraVec2,
    type CameraZoomPreset,
    CAMERA_ZOOM_PRESETS,
    clampCameraCenter,
    computeEffectiveScale,
    computeFitScale,
    computePresetScale,
    computeViewBoxFromCamera,
    computeVisibleWorldSize,
    expandRect,
} from '../visual/camera';

interface GameBoardProps {
    gameState: GameState;
    onMove: (hex: Point) => void;
    selectedSkillId: string | null;
    showMovementRange: boolean;
    onBusyStateChange?: (busy: boolean) => void;
    assetManifest?: VisualAssetManifest | null;
    biomeDebug?: {
        undercurrentOffset?: { x: number; y: number };
        crustOffset?: { x: number; y: number };
        mountainAssetPath?: string;
        mountainScale?: number;
        mountainOffset?: { x: number; y: number };
        mountainAnchor?: { x: number; y: number };
        mountainCrustBlendMode?: 'off' | VisualBlendMode;
        mountainCrustBlendOpacity?: number;
        mountainTintColor?: string;
        mountainTintBlendMode?: 'off' | VisualBlendMode;
        mountainTintOpacity?: number;
    };
    onSimulationEvents?: (events: SimulationEvent[]) => void;
    onMirrorSnapshot?: (snapshot: StateMirrorSnapshot) => void;
    enginePreviewGhost?: {
        path: Point[];
        aoe: Point[];
        hasEnemy: boolean;
        target: Point;
    } | null;
    cameraSafeInsetsPx?: Partial<CameraInsetsPx>;
}

type BoardDepthSprite = {
    id: string;
    kind: 'clutter' | 'mountain' | 'stairs' | 'shrine';
    position: Point;
    asset?: VisualAssetEntry;
    renderScale: number;
    zAnchorY: number;
    fallback?: 'stairs' | 'shrine';
};

type CameraViewState = {
    center: CameraVec2;
    scale: number;
    viewBox: CameraRect;
};

type PointerPoint = { x: number; y: number };

const hashString = (input: string): number => {
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const hashFloat = (input: string): number => hashString(input) / 0xffffffff;

const parseMountainClusterSize = (asset: VisualAssetEntry): number => {
    const tags = (asset.tags || []).map(t => t.toLowerCase());
    const tokens = [asset.id.toLowerCase(), ...tags];
    for (const token of tokens) {
        const match = token.match(/(?:cluster|hex)[-_]?([123])\b/);
        if (match) return Number(match[1]);
        if (token.includes('1-hex') || token.includes('single')) return 1;
        if (token.includes('2-hex') || token.includes('double')) return 2;
        if (token.includes('3-hex') || token.includes('triple')) return 3;
    }
    return 1;
};

const resolveBiomeLayerPath = (layer: VisualBiomeTextureLayer | undefined, theme: string): string | undefined => {
    if (!layer) return undefined;
    if (theme && layer.themes?.[theme]) return layer.themes[theme];
    return layer.default;
};

const readLayerMode = (layer?: VisualBiomeTextureLayer): 'off' | 'cover' | 'repeat' => {
    if (!layer) return 'off';
    if (layer.mode === 'cover' || layer.mode === 'repeat' || layer.mode === 'off') return layer.mode;
    return 'cover';
};

const readLayerOpacity = (layer?: VisualBiomeTextureLayer): number =>
    Math.min(1, Math.max(0, Number(layer?.opacity ?? 1)));

const readLayerScalePx = (
    layer: VisualBiomeTextureLayer | undefined,
    fallbackPx: number,
    floorPx = 64,
    ceilPx = Number.POSITIVE_INFINITY
): number => {
    const raw = Number(layer?.scalePx || fallbackPx);
    return Math.min(ceilPx, Math.max(floorPx, raw));
};

const readLayerScroll = (layer?: VisualBiomeTextureLayer): { x: number; y: number; durationMs: number } => ({
    x: Number(layer?.scroll?.x ?? 0),
    y: Number(layer?.scroll?.y ?? 0),
    durationMs: Math.max(1000, Number(layer?.scroll?.durationMs ?? 18000))
});

const resolveTintColor = (tint: VisualBiomeTintProfile | undefined, theme: string): string | undefined => {
    if (!tint) return undefined;
    if (theme && tint.themes?.[theme]) return tint.themes[theme];
    return tint.default;
};

const readTintOpacity = (tint?: VisualBiomeTintProfile): number =>
    Math.min(1, Math.max(0, Number(tint?.opacity ?? 0)));

const readBlendMode = (blend?: VisualBlendMode): React.CSSProperties['mixBlendMode'] => {
    if (
        blend === 'normal'
        || blend === 'multiply'
        || blend === 'overlay'
        || blend === 'soft-light'
        || blend === 'screen'
        || blend === 'color-dodge'
    ) {
        return blend;
    }
    return 'multiply';
};

const normalizeHexColor = (value: string, fallback = '#8b6f4a'): string => {
    const raw = String(value || '').trim();
    const fullHex = /^#([0-9a-f]{6})$/i;
    if (fullHex.test(raw)) return raw.toLowerCase();
    const shortHex = /^#([0-9a-f]{3})$/i;
    if (shortHex.test(raw)) {
        const [r, g, b] = raw.slice(1).split('');
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return fallback;
};

const hexToRgb01 = (hex: string): { r: number; g: number; b: number } => {
    const normalized = normalizeHexColor(hex);
    const value = normalized.slice(1);
    return {
        r: parseInt(value.slice(0, 2), 16) / 255,
        g: parseInt(value.slice(2, 4), 16) / 255,
        b: parseInt(value.slice(4, 6), 16) / 255
    };
};

const toSvgSafeId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '-');

type ResolvedMountainRenderSettings = {
    scale: number;
    offsetX: number;
    offsetY: number;
    anchorX: number;
    anchorY: number;
    crustBlendMode: React.CSSProperties['mixBlendMode'] | 'off';
    crustBlendOpacity: number;
    tintColor: string;
    tintBlendMode: React.CSSProperties['mixBlendMode'] | 'off';
    tintOpacity: number;
    tintMatrixValues: string;
};

const resolveMountainBlendMode = (
    value: 'off' | VisualBlendMode | undefined,
    fallback: React.CSSProperties['mixBlendMode'] | 'off'
): React.CSSProperties['mixBlendMode'] | 'off' => {
    if (value === 'off') return 'off';
    if (value) return readBlendMode(value);
    return fallback;
};

const getHexPoints = (size: number): string => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        points.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
    }
    return points.join(' ');
};

export const GameBoard: React.FC<GameBoardProps> = ({
    gameState,
    onMove,
    selectedSkillId,
    showMovementRange,
    onBusyStateChange,
    assetManifest,
    biomeDebug,
    onSimulationEvents,
    onMirrorSnapshot,
    enginePreviewGhost,
    cameraSafeInsetsPx,
}) => {
    type BoardDecal = { id: string; position: Point; href: string; createdAt: number };
    type BoardProp = { id: string; kind: 'stairs' | 'shrine'; position: Point; asset?: VisualAssetEntry };
    const [isShaking, setIsShaking] = useState(false);
    const [hoveredTile, setHoveredTile] = useState<Point | null>(null);
    const [movementBusy, setMovementBusy] = useState(false);
    const [juiceBusy, setJuiceBusy] = useState(false);
    const [decals, setDecals] = useState<BoardDecal[]>([]);
    const [zoomPreset, setZoomPreset] = useState<CameraZoomPreset>(11);
    const [viewportSizePx, setViewportSizePx] = useState({ width: 0, height: 0 });
    const [isCameraPanning, setIsCameraPanning] = useState(false);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const boardViewportRef = useRef<HTMLDivElement | null>(null);
    const movementQueueRef = useRef<MovementTrace[]>([]);
    const runningMovementRef = useRef(false);
    const activeAnimationsRef = useRef<Animation[]>([]);
    const runTokenRef = useRef(0);
    const lastMovementBatchSignatureRef = useRef('');
    const processedTimelineDecalCountRef = useRef(0);
    const processedVisualDecalCountRef = useRef(0);
    const processedSimulationEventCountRef = useRef(0);
    const cameraViewRef = useRef<CameraViewState | null>(null);
    const cameraAnimFrameRef = useRef<number | null>(null);
    const cameraPanOffsetRef = useRef<CameraVec2>({ x: 0, y: 0 });
    const isCameraPanningRef = useRef(false);
    const isPinchingRef = useRef(false);
    const suppressTileClickUntilRef = useRef(0);
    const activePointersRef = useRef<Map<number, PointerPoint>>(new Map());
    const dragStateRef = useRef<{
        activePointerId: number | null;
        startClient: PointerPoint | null;
        lastWorld: CameraVec2 | null;
        didPan: boolean;
    }>({
        activePointerId: null,
        startClient: null,
        lastWorld: null,
        didPan: false,
    });
    const pinchStateRef = useRef<{
        startDistance: number;
        startPreset: CameraZoomPreset;
        appliedPreset: CameraZoomPreset;
    } | null>(null);
    const lastPlayerKeyRef = useRef<string | null>(null);
    const lastCameraFloorRef = useRef<number | null>(null);
    const didInitCameraRef = useRef(false);
    const lastViewportSignatureRef = useRef('');
    const lastBoundsSignatureRef = useRef('');
    const lastZoomPresetRef = useRef<CameraZoomPreset>(11);
    const isAnimatingCameraRef = useRef(false);
    const playerPos = gameState.player.position;

    // Filter cells based on dynamic diamond geometry
    const cells = useMemo(() => {
        let hexes = gameState.rooms?.[0]?.hexes;

        // Fallback: If rooms are missing, generate the full diamond grid
        if (!hexes || hexes.length === 0) {
            hexes = [];
            for (let q = 0; q < gameState.gridWidth; q++) {
                for (let r = 0; r < gameState.gridHeight; r++) {
                    hexes.push({ q, r, s: -q - r });
                }
            }
        }

        return hexes.filter(h =>
            isTileInDiamond(h.q, h.r, gameState.gridWidth, gameState.gridHeight)
        );
    }, [gameState.rooms, gameState.gridWidth, gameState.gridHeight]);

    // Handle board shake
    useEffect(() => {
        const shakeEvent = gameState.visualEvents?.find(e => e.type === 'shake');
        if (shakeEvent) {
            setIsShaking(true);
            const timer = setTimeout(() => setIsShaking(false), 200);
            return () => clearTimeout(timer);
        }
    }, [gameState.visualEvents]);

    // Dynamically calculate the Bounding Box of the actual hexes to maximize size
    const bounds = useMemo(() => {
        if (cells.length === 0) return { minX: 0, minY: 0, width: 100, height: 100 };

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        cells.forEach(hex => {
            const { x, y } = hexToPixel(hex, TILE_SIZE);
            minX = Math.min(minX, x - TILE_SIZE);
            minY = Math.min(minY, y - TILE_SIZE);
            maxX = Math.max(maxX, x + TILE_SIZE);
            maxY = Math.max(maxY, y + TILE_SIZE);
        });

        return {
            minX,
            minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }, [cells]);

    const playerWorld = useMemo(() => {
        const { x, y } = hexToPixel(playerPos, TILE_SIZE);
        return { x, y };
    }, [playerPos]);

    const baseViewBox = useMemo<CameraRect>(() => ({
        x: bounds.minX,
        y: bounds.minY,
        width: bounds.width,
        height: bounds.height
    }), [bounds.minX, bounds.minY, bounds.width, bounds.height]);

    const cancelCameraAnimation = useCallback(() => {
        if (cameraAnimFrameRef.current !== null) {
            window.cancelAnimationFrame(cameraAnimFrameRef.current);
            cameraAnimFrameRef.current = null;
        }
        isAnimatingCameraRef.current = false;
    }, []);

    const applyViewBoxToSvg = useCallback((viewBox: CameraRect) => {
        const svg = svgRef.current;
        if (!svg) return;
        svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    }, []);

    const commitCameraView = useCallback((next: CameraViewState) => {
        cameraViewRef.current = next;
        applyViewBoxToSvg(next.viewBox);
    }, [applyViewBoxToSvg]);

    const getCameraTarget = useCallback((options?: {
        panOffset?: CameraVec2;
        zoomPreset?: CameraZoomPreset;
    }): CameraViewState => {
        const viewportWidth = Math.max(1, viewportSizePx.width);
        const viewportHeight = Math.max(1, viewportSizePx.height);
        const preset = options?.zoomPreset ?? zoomPreset;
        const panOffset = options?.panOffset ?? cameraPanOffsetRef.current;

        const safeInsets = cameraSafeInsetsPx || {};
        const viewport = {
            width: viewportWidth,
            height: viewportHeight,
            insets: safeInsets
        };

        const paddingWorld = TILE_SIZE * 0.75;
        const paddedBounds = expandRect(baseViewBox, paddingWorld);
        const presetScale = computePresetScale(viewport, preset, TILE_SIZE, TILE_SIZE * 0.2);
        const fitScale = computeFitScale(viewport, paddedBounds);
        const scale = computeEffectiveScale(fitScale, presetScale);
        const visibleWorld = computeVisibleWorldSize(viewport, scale);

        const desiredCenter = {
            x: playerWorld.x + panOffset.x,
            y: playerWorld.y + panOffset.y,
        };

        const center = clampCameraCenter(desiredCenter, visibleWorld, paddedBounds);
        const viewBox = computeViewBoxFromCamera(center, visibleWorld);

        return { center, scale, viewBox };
    }, [viewportSizePx.width, viewportSizePx.height, zoomPreset, cameraSafeInsetsPx, baseViewBox, playerWorld.x, playerWorld.y]);

    const animateCameraTo = useCallback((target: CameraViewState, durationMs = 220) => {
        const current = cameraViewRef.current;
        if (!current) {
            commitCameraView(target);
            return;
        }

        cancelCameraAnimation();
        const startCenter = current.center;
        const startScale = current.scale;
        const targetCenter = target.center;
        const targetScale = target.scale;
        const startedAt = performance.now();
        isAnimatingCameraRef.current = true;

        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

        const step = (now: number) => {
            const rawT = Math.min(1, (now - startedAt) / Math.max(1, durationMs));
            const t = easeOutCubic(rawT);
            const scale = startScale + (targetScale - startScale) * t;
            const center = {
                x: startCenter.x + (targetCenter.x - startCenter.x) * t,
                y: startCenter.y + (targetCenter.y - startCenter.y) * t,
            };

            const viewport = {
                width: Math.max(1, viewportSizePx.width),
                height: Math.max(1, viewportSizePx.height),
                insets: cameraSafeInsetsPx || {}
            };
            const visibleWorld = computeVisibleWorldSize(viewport, scale);
            const viewBox = computeViewBoxFromCamera(center, visibleWorld);
            commitCameraView({ center, scale, viewBox });

            if (rawT < 1) {
                cameraAnimFrameRef.current = window.requestAnimationFrame(step);
            } else {
                cameraAnimFrameRef.current = null;
                isAnimatingCameraRef.current = false;
                commitCameraView(target);
            }
        };

        cameraAnimFrameRef.current = window.requestAnimationFrame(step);
    }, [cancelCameraAnimation, commitCameraView, viewportSizePx.width, viewportSizePx.height, cameraSafeInsetsPx]);

    const snapCameraToTarget = useCallback((options?: {
        panOffset?: CameraVec2;
        zoomPreset?: CameraZoomPreset;
    }) => {
        cancelCameraAnimation();
        commitCameraView(getCameraTarget(options));
    }, [cancelCameraAnimation, commitCameraView, getCameraTarget]);

    const animateCameraToTarget = useCallback((options?: {
        panOffset?: CameraVec2;
        zoomPreset?: CameraZoomPreset;
        durationMs?: number;
    }) => {
        const target = getCameraTarget(options);
        animateCameraTo(target, options?.durationMs ?? 220);
    }, [animateCameraTo, getCameraTarget]);

    useEffect(() => {
        const el = boardViewportRef.current;
        if (!el) return;

        const updateSize = () => {
            const rect = el.getBoundingClientRect();
            setViewportSizePx(prev => {
                const width = Math.round(rect.width);
                const height = Math.round(rect.height);
                if (prev.width === width && prev.height === height) return prev;
                return { width, height };
            });
        };

        updateSize();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateSize);
            return () => window.removeEventListener('resize', updateSize);
        }

        const observer = new ResizeObserver(() => updateSize());
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (viewportSizePx.width <= 0 || viewportSizePx.height <= 0) return;

        const boundsSignature = `${baseViewBox.x}:${baseViewBox.y}:${baseViewBox.width}:${baseViewBox.height}`;
        const viewportSignature = `${viewportSizePx.width}:${viewportSizePx.height}:${cameraSafeInsetsPx?.top ?? 0}:${cameraSafeInsetsPx?.right ?? 0}:${cameraSafeInsetsPx?.bottom ?? 0}:${cameraSafeInsetsPx?.left ?? 0}`;
        const playerKey = pointToKey(gameState.player.position);

        if (!didInitCameraRef.current) {
            didInitCameraRef.current = true;
            lastPlayerKeyRef.current = playerKey;
            lastCameraFloorRef.current = gameState.floor ?? null;
            lastViewportSignatureRef.current = viewportSignature;
            lastBoundsSignatureRef.current = boundsSignature;
            lastZoomPresetRef.current = zoomPreset;
            snapCameraToTarget({ panOffset: { x: 0, y: 0 } });
            return;
        }

        if ((gameState.floor ?? null) !== lastCameraFloorRef.current) {
            lastCameraFloorRef.current = gameState.floor ?? null;
            lastBoundsSignatureRef.current = boundsSignature;
            lastViewportSignatureRef.current = viewportSignature;
            lastPlayerKeyRef.current = playerKey;
            lastZoomPresetRef.current = zoomPreset;
            cameraPanOffsetRef.current = { x: 0, y: 0 };
            snapCameraToTarget({ panOffset: { x: 0, y: 0 } });
            return;
        }

        if (gameState.floor !== undefined && boundsSignature !== lastBoundsSignatureRef.current) {
            lastBoundsSignatureRef.current = boundsSignature;
            lastViewportSignatureRef.current = viewportSignature;
            lastPlayerKeyRef.current = playerKey;
            lastZoomPresetRef.current = zoomPreset;
            cameraPanOffsetRef.current = { x: 0, y: 0 };
            snapCameraToTarget({ panOffset: { x: 0, y: 0 } });
            return;
        }

        if (viewportSignature !== lastViewportSignatureRef.current) {
            lastViewportSignatureRef.current = viewportSignature;
            lastBoundsSignatureRef.current = boundsSignature;
            snapCameraToTarget();
            return;
        }

        if (zoomPreset !== lastZoomPresetRef.current) {
            lastZoomPresetRef.current = zoomPreset;
            animateCameraToTarget();
            return;
        }

        if (playerKey !== lastPlayerKeyRef.current) {
            lastPlayerKeyRef.current = playerKey;
            const zeroPan = { x: 0, y: 0 };
            cameraPanOffsetRef.current = zeroPan;
            animateCameraToTarget({ panOffset: zeroPan, durationMs: 210 });
            return;
        }
    }, [
        viewportSizePx.width,
        viewportSizePx.height,
        baseViewBox.x,
        baseViewBox.y,
        baseViewBox.width,
        baseViewBox.height,
        cameraSafeInsetsPx,
        gameState.floor,
        gameState.player.position,
        zoomPreset,
        snapCameraToTarget,
        animateCameraToTarget
    ]);

    const renderedViewBox = cameraViewRef.current?.viewBox || baseViewBox;

    const latestTraceByActor = useMemo(() => {
        const out: Record<string, any> = {};
        for (const ev of gameState.visualEvents || []) {
            if (ev.type !== 'kinetic_trace') continue;
            const trace = ev.payload;
            if (trace?.actorId) out[trace.actorId] = trace;
        }
        return out;
    }, [gameState.visualEvents]);

    const movementTargets = useMemo(() => {
        if (!showMovementRange || selectedSkillId) return [] as Point[];

        const movementSkillIds = ['BASIC_MOVE', 'DASH'] as const;
        const playerSkillIds = new Set(gameState.player.activeSkills.map(s => s.id));
        const validSet = new Set<string>();
        const results: Point[] = [];

        for (const id of movementSkillIds) {
            if (!playerSkillIds.has(id)) continue;
            const def = SkillRegistry.get(id);
            if (!def?.getValidTargets) continue;
            const targets = def.getValidTargets(gameState, playerPos);
            for (const t of targets) {
                const key = pointToKey(t);
                if (!validSet.has(key)) {
                    validSet.add(key);
                    results.push(t);
                }
            }
        }
        return results;
    }, [showMovementRange, selectedSkillId, gameState, playerPos]);

    const movementTargetSet = useMemo(() => {
        const set = new Set<string>();
        for (const p of movementTargets) set.add(pointToKey(p));
        return set;
    }, [movementTargets]);

    const hasPrimaryMovementSkills = useMemo(
        () => gameState.player.activeSkills.some(s => s.id === 'BASIC_MOVE' || s.id === 'DASH'),
        [gameState.player.activeSkills]
    );

    const stairsKey = useMemo(() => pointToKey(gameState.stairsPosition), [gameState.stairsPosition]);
    const shrineKey = useMemo(
        () => (gameState.shrinePosition ? pointToKey(gameState.shrinePosition) : null),
        [gameState.shrinePosition]
    );

    const fallbackNeighborSet = useMemo(() => {
        const neighbors = [
            { q: playerPos.q + 1, r: playerPos.r, s: playerPos.s - 1 },
            { q: playerPos.q + 1, r: playerPos.r - 1, s: playerPos.s },
            { q: playerPos.q, r: playerPos.r - 1, s: playerPos.s + 1 },
            { q: playerPos.q - 1, r: playerPos.r, s: playerPos.s + 1 },
            { q: playerPos.q - 1, r: playerPos.r + 1, s: playerPos.s },
            { q: playerPos.q, r: playerPos.r + 1, s: playerPos.s - 1 }
        ];
        const set = new Set<string>();
        for (const n of neighbors) {
            if (isTileInDiamond(n.q, n.r, gameState.gridWidth, gameState.gridHeight)) {
                set.add(pointToKey(n));
            }
        }
        return set;
    }, [playerPos, gameState.gridWidth, gameState.gridHeight]);

    const selectedSkillTargetSet = useMemo(() => {
        const set = new Set<string>();
        if (!selectedSkillId) return set;
        const def = SkillRegistry.get(selectedSkillId);
        if (!def?.getValidTargets) return set;
        const targets = def.getValidTargets(gameState, playerPos);
        for (const t of targets) set.add(pointToKey(t));
        return set;
    }, [selectedSkillId, gameState, playerPos]);

    const resolvedEnginePreviewGhost = useMemo(() => {
        if (enginePreviewGhost) return enginePreviewGhost;
        if (!hoveredTile) return null;

        const hoveredKey = pointToKey(hoveredTile);
        if (showMovementRange && !selectedSkillId) {
            const isMoveTile = movementTargetSet.has(hoveredKey)
                || (!hasPrimaryMovementSkills && fallbackNeighborSet.has(hoveredKey));
            if (!isMoveTile) return null;
            return {
                path: getHexLine(playerPos, hoveredTile),
                aoe: [],
                hasEnemy: false,
                target: hoveredTile
            };
        }

        if (!selectedSkillId) return null;

        const selectedSkill = gameState.player.activeSkills.find(skill => skill.id === selectedSkillId);
        const preview = previewActionOutcome(gameState, {
            actorId: gameState.player.id,
            skillId: selectedSkillId,
            target: hoveredTile,
            activeUpgrades: selectedSkill?.activeUpgrades || []
        });

        if (!preview.ok) return null;

        const aoeByKey = new Map<string, Point>();
        for (const event of preview.simulationEvents) {
            if (!event.position) continue;
            if (event.type !== 'DamageTaken' && event.type !== 'StatusApplied' && event.type !== 'UnitMoved') continue;
            aoeByKey.set(pointToKey(event.position), event.position);
        }

        const hasEnemy = preview.simulationEvents.some(event =>
            (event.type === 'DamageTaken' || event.type === 'StatusApplied')
            && Boolean(event.targetId)
            && event.targetId !== gameState.player.id
        );

        return {
            path: getHexLine(playerPos, hoveredTile),
            aoe: [...aoeByKey.values()],
            hasEnemy,
            target: hoveredTile
        };
    }, [
        enginePreviewGhost,
        hoveredTile,
        showMovementRange,
        selectedSkillId,
        movementTargetSet,
        hasPrimaryMovementSkills,
        fallbackNeighborSet,
        gameState,
        playerPos
    ]);

    const tileVisualFlags = useMemo(() => {
        const out = new Map<string, { isWall: boolean; isLava: boolean; isFire: boolean }>();
        for (const hex of cells) {
            const key = pointToKey(hex);
            const traits = UnifiedTileService.getTraitsAt(gameState, hex);
            const isWall = traits.has('BLOCKS_MOVEMENT') && traits.has('BLOCKS_LOS');
            const hasLava = traits.has('LAVA') || (traits.has('HAZARDOUS') && traits.has('LIQUID'));
            const hasFire = traits.has('FIRE');
            out.set(key, {
                isWall,
                isLava: !isWall && hasLava,
                isFire: !isWall && hasFire
            });
        }
        return out;
    }, [cells, gameState.tiles]);

    const assetById = useMemo(() => {
        const map = new Map<string, VisualAssetEntry>();
        for (const asset of assetManifest?.assets || []) {
            map.set(asset.id, asset);
        }
        return map;
    }, [assetManifest]);
    const deathDecalHref = useMemo(() => assetById.get(resolveDeathDecalAssetId())?.path, [assetById]);
    const manifestTileUnitPx = useMemo(() => Math.max(1, assetManifest?.tileUnitPx || 256), [assetManifest?.tileUnitPx]);
    const manifestUnitToBoardScale = useMemo(() => (TILE_SIZE * 2) / manifestTileUnitPx, [manifestTileUnitPx]);
    const biomeThemeKey = useMemo(
        () => String(gameState.theme || '').toLowerCase(),
        [gameState.theme]
    );
    const biomeSeed = useMemo(
        () => `${gameState.initialSeed || gameState.rngSeed || gameState.turnNumber}:${gameState.floor}:${biomeThemeKey}`,
        [gameState.initialSeed, gameState.rngSeed, gameState.turnNumber, gameState.floor, biomeThemeKey]
    );
    const biomeThemePreset = useMemo<VisualBiomeThemePreset | undefined>(
        () => getBiomeThemePreset(assetManifest, biomeThemeKey),
        [assetManifest, biomeThemeKey]
    );
    const legacyUnderlayLayer = useMemo<VisualBiomeTextureLayer | undefined>(() => {
        const underlay = assetManifest?.biomeUnderlay;
        if (!underlay) return undefined;
        return {
            default: underlay.default,
            themes: underlay.themes,
            mode: underlay.mode,
            scalePx: underlay.scalePx,
            opacity: underlay.opacity
        };
    }, [assetManifest?.biomeUnderlay]);
    const undercurrentLayer = useMemo<VisualBiomeTextureLayer | undefined>(
        () => biomeThemePreset?.biomeLayers?.undercurrent || assetManifest?.biomeLayers?.undercurrent,
        [biomeThemePreset?.biomeLayers?.undercurrent, assetManifest?.biomeLayers?.undercurrent]
    );
    const crustLayer = useMemo<VisualBiomeTextureLayer | undefined>(
        () => biomeThemePreset?.biomeLayers?.crust || assetManifest?.biomeLayers?.crust || legacyUnderlayLayer,
        [biomeThemePreset?.biomeLayers?.crust, assetManifest?.biomeLayers?.crust, legacyUnderlayLayer]
    );
    const clutterLayer = useMemo<VisualBiomeClutterLayer | undefined>(
        () => biomeThemePreset?.biomeLayers?.clutter || assetManifest?.biomeLayers?.clutter,
        [biomeThemePreset?.biomeLayers?.clutter, assetManifest?.biomeLayers?.clutter]
    );
    const undercurrentHref = useMemo(
        () => resolveBiomeLayerPath(undercurrentLayer, biomeThemeKey),
        [undercurrentLayer, biomeThemeKey]
    );
    const undercurrentMode = useMemo(
        () => readLayerMode(undercurrentLayer),
        [undercurrentLayer]
    );
    const undercurrentScalePx = useMemo(
        () => readLayerScalePx(undercurrentLayer, manifestTileUnitPx, 64, 192),
        [undercurrentLayer, manifestTileUnitPx]
    );
    const undercurrentOpacity = useMemo(
        () => readLayerOpacity(undercurrentLayer),
        [undercurrentLayer]
    );
    const undercurrentScroll = useMemo(() => ({
        x: Number(undercurrentLayer?.scroll?.x ?? 120),
        y: Number(undercurrentLayer?.scroll?.y ?? 90),
        durationMs: Math.max(1000, Number(undercurrentLayer?.scroll?.durationMs ?? 92000))
    }), [undercurrentLayer?.scroll?.x, undercurrentLayer?.scroll?.y, undercurrentLayer?.scroll?.durationMs]);
    const undercurrentOffset = useMemo(() => ({
        x: Number(undercurrentLayer?.offsetX ?? 0) + Number(biomeDebug?.undercurrentOffset?.x ?? 0),
        y: Number(undercurrentLayer?.offsetY ?? 0) + Number(biomeDebug?.undercurrentOffset?.y ?? 0)
    }), [undercurrentLayer?.offsetX, undercurrentLayer?.offsetY, biomeDebug?.undercurrentOffset?.x, biomeDebug?.undercurrentOffset?.y]);
    const crustHref = useMemo(
        () => resolveBiomeLayerPath(crustLayer, biomeThemeKey),
        [crustLayer, biomeThemeKey]
    );
    const crustMode = useMemo(
        () => readLayerMode(crustLayer),
        [crustLayer]
    );
    const crustScalePx = useMemo(
        () => readLayerScalePx(crustLayer, manifestTileUnitPx, 64),
        [crustLayer, manifestTileUnitPx]
    );
    const crustOpacity = 1;
    const crustSeedShift = useMemo(() => {
        const shiftBudget = Math.max(0, Number(crustLayer?.seedShiftPx ?? TILE_SIZE * 5));
        if (shiftBudget === 0) return { x: 0, y: 0 };
        const h = hashString(`${biomeSeed}|crust-offset`);
        const hx = (((h & 0xffff) / 0xffff) * 2 - 1) * shiftBudget;
        const hy = ((((h >>> 16) & 0xffff) / 0xffff) * 2 - 1) * shiftBudget;
        return { x: hx, y: hy };
    }, [crustLayer?.seedShiftPx, biomeSeed]);
    const crustOffset = useMemo(() => ({
        x: Number(crustLayer?.offsetX ?? 0) + Number(biomeDebug?.crustOffset?.x ?? 0),
        y: Number(crustLayer?.offsetY ?? 0) + Number(biomeDebug?.crustOffset?.y ?? 0)
    }), [crustLayer?.offsetX, crustLayer?.offsetY, biomeDebug?.crustOffset?.x, biomeDebug?.crustOffset?.y]);
    const crustPatternShift = useMemo(
        () => ({ x: crustSeedShift.x + crustOffset.x, y: crustSeedShift.y + crustOffset.y }),
        [crustSeedShift.x, crustSeedShift.y, crustOffset.x, crustOffset.y]
    );
    const wallsProfile = useMemo<VisualBiomeWallsProfile | undefined>(
        () => assetManifest?.walls,
        [assetManifest?.walls]
    );
    const wallsThemeOverride = useMemo<VisualBiomeWallsThemeOverride | undefined>(
        () => biomeThemePreset?.walls || wallsProfile?.themes?.[biomeThemeKey],
        [biomeThemePreset?.walls, wallsProfile?.themes, biomeThemeKey]
    );
    const crustMaterial = useMemo<VisualBiomeMaterialProfile | undefined>(
        () => biomeThemePreset?.biomeMaterials?.crust || assetManifest?.biomeMaterials?.crust,
        [biomeThemePreset?.biomeMaterials?.crust, assetManifest?.biomeMaterials?.crust]
    );
    const crustDetailALayer = useMemo<VisualBiomeTextureLayer | undefined>(
        () => crustMaterial?.detailA,
        [crustMaterial?.detailA]
    );
    const crustDetailBLayer = useMemo<VisualBiomeTextureLayer | undefined>(
        () => crustMaterial?.detailB,
        [crustMaterial?.detailB]
    );
    const crustDetailAHref = useMemo(
        () => resolveBiomeLayerPath(crustDetailALayer, biomeThemeKey),
        [crustDetailALayer, biomeThemeKey]
    );
    const crustDetailBHref = useMemo(
        () => resolveBiomeLayerPath(crustDetailBLayer, biomeThemeKey),
        [crustDetailBLayer, biomeThemeKey]
    );
    const crustDetailAMode = useMemo(
        () => readLayerMode(crustDetailALayer),
        [crustDetailALayer]
    );
    const crustDetailBMode = useMemo(
        () => readLayerMode(crustDetailBLayer),
        [crustDetailBLayer]
    );
    const crustDetailAScalePx = useMemo(
        () => readLayerScalePx(crustDetailALayer, crustScalePx, 64),
        [crustDetailALayer, crustScalePx]
    );
    const crustDetailBScalePx = useMemo(
        () => readLayerScalePx(crustDetailBLayer, crustScalePx, 64),
        [crustDetailBLayer, crustScalePx]
    );
    const crustDetailAOpacity = useMemo(
        () => readLayerOpacity(crustDetailALayer),
        [crustDetailALayer]
    );
    const crustDetailBOpacity = useMemo(
        () => readLayerOpacity(crustDetailBLayer),
        [crustDetailBLayer]
    );
    const crustDetailAScroll = useMemo(
        () => readLayerScroll(crustDetailALayer),
        [crustDetailALayer?.scroll?.x, crustDetailALayer?.scroll?.y, crustDetailALayer?.scroll?.durationMs]
    );
    const crustDetailBScroll = useMemo(
        () => readLayerScroll(crustDetailBLayer),
        [crustDetailBLayer?.scroll?.x, crustDetailBLayer?.scroll?.y, crustDetailBLayer?.scroll?.durationMs]
    );
    const crustDetailASeedShift = useMemo(() => {
        const shiftBudget = TILE_SIZE * 0.75;
        const h = hashString(`${biomeSeed}|crust-detail-a-offset`);
        const hx = (((h & 0xffff) / 0xffff) * 2 - 1) * shiftBudget;
        const hy = ((((h >>> 16) & 0xffff) / 0xffff) * 2 - 1) * shiftBudget;
        return { x: hx, y: hy };
    }, [biomeSeed]);
    const crustDetailBSeedShift = useMemo(() => {
        const shiftBudget = TILE_SIZE * 0.75;
        const h = hashString(`${biomeSeed}|crust-detail-b-offset`);
        const hx = (((h & 0xffff) / 0xffff) * 2 - 1) * shiftBudget;
        const hy = ((((h >>> 16) & 0xffff) / 0xffff) * 2 - 1) * shiftBudget;
        return { x: hx, y: hy };
    }, [biomeSeed]);
    const crustDetailAShift = useMemo(
        () => ({ x: crustPatternShift.x + crustDetailASeedShift.x, y: crustPatternShift.y + crustDetailASeedShift.y }),
        [crustPatternShift.x, crustPatternShift.y, crustDetailASeedShift.x, crustDetailASeedShift.y]
    );
    const crustDetailBShift = useMemo(
        () => ({ x: crustPatternShift.x + crustDetailBSeedShift.x, y: crustPatternShift.y + crustDetailBSeedShift.y }),
        [crustPatternShift.x, crustPatternShift.y, crustDetailBSeedShift.x, crustDetailBSeedShift.y]
    );
    const crustTintProfile = useMemo<VisualBiomeTintProfile | undefined>(
        () => crustMaterial?.tint,
        [crustMaterial?.tint]
    );
    const crustTintColor = useMemo(
        () => resolveTintColor(crustTintProfile, biomeThemeKey),
        [crustTintProfile, biomeThemeKey]
    );
    const crustTintOpacity = useMemo(
        () => readTintOpacity(crustTintProfile),
        [crustTintProfile?.opacity]
    );
    const crustTintBlendMode = useMemo(
        () => readBlendMode(crustTintProfile?.blendMode),
        [crustTintProfile?.blendMode]
    );
    const crustTintActive = Boolean(crustTintColor && crustTintOpacity > 0);
    const defaultMountainCrustBlendOpacity = useMemo(
        () => (crustTintActive ? Math.min(0.55, Math.max(0.15, crustTintOpacity * 0.9)) : 0),
        [crustTintActive, crustTintOpacity]
    );
    const resolveMountainSettings = useCallback((asset?: VisualAssetEntry): ResolvedMountainRenderSettings => {
        const assetDefaults = asset?.mountainSettings as VisualMountainRenderSettings | undefined;
        const assetTheme = asset?.mountainSettingsByTheme?.[biomeThemeKey] as VisualMountainRenderSettings | undefined;
        const presetAssetOverride = asset ? biomeThemePreset?.assetOverrides?.[asset.id] : undefined;
        const presetAssetMountain = presetAssetOverride?.mountainSettings as VisualMountainRenderSettings | undefined;
        const scale = Math.min(3, Math.max(0.2, Number(
            biomeDebug?.mountainScale
            ?? presetAssetMountain?.scale
            ?? assetTheme?.scale
            ?? wallsThemeOverride?.scale
            ?? wallsProfile?.scale
            ?? assetDefaults?.scale
            ?? 0.95
        )));
        const offsetX = Number(
            biomeDebug?.mountainOffset?.x
            ?? presetAssetMountain?.offsetX
            ?? assetTheme?.offsetX
            ?? wallsThemeOverride?.offsetX
            ?? wallsProfile?.offsetX
            ?? assetDefaults?.offsetX
            ?? 0
        );
        const offsetY = Number(
            biomeDebug?.mountainOffset?.y
            ?? presetAssetMountain?.offsetY
            ?? assetTheme?.offsetY
            ?? wallsThemeOverride?.offsetY
            ?? wallsProfile?.offsetY
            ?? assetDefaults?.offsetY
            ?? 0
        );
        const anchorX = Math.min(1, Math.max(0, Number(
            biomeDebug?.mountainAnchor?.x
            ?? presetAssetMountain?.anchorX
            ?? assetTheme?.anchorX
            ?? wallsThemeOverride?.anchorX
            ?? wallsProfile?.anchorX
            ?? assetDefaults?.anchorX
            ?? 0.5
        )));
        const anchorY = Math.min(1, Math.max(0, Number(
            biomeDebug?.mountainAnchor?.y
            ?? presetAssetMountain?.anchorY
            ?? assetTheme?.anchorY
            ?? wallsThemeOverride?.anchorY
            ?? wallsProfile?.anchorY
            ?? assetDefaults?.anchorY
            ?? 0.78
        )));
        const crustBlendMode = resolveMountainBlendMode(
            biomeDebug?.mountainCrustBlendMode
            ?? presetAssetMountain?.crustBlendMode
            ?? assetTheme?.crustBlendMode
            ?? wallsThemeOverride?.crustBlendMode
            ?? wallsProfile?.crustBlendMode
            ?? assetDefaults?.crustBlendMode,
            crustTintBlendMode
        );
        const crustBlendOpacity = Math.min(1, Math.max(0, Number(
            biomeDebug?.mountainCrustBlendOpacity
            ?? presetAssetMountain?.crustBlendOpacity
            ?? assetTheme?.crustBlendOpacity
            ?? wallsThemeOverride?.crustBlendOpacity
            ?? wallsProfile?.crustBlendOpacity
            ?? assetDefaults?.crustBlendOpacity
            ?? defaultMountainCrustBlendOpacity
        )));
        const tintColor = normalizeHexColor(String(
            biomeDebug?.mountainTintColor
            ?? presetAssetMountain?.tintColor
            ?? assetTheme?.tintColor
            ?? wallsThemeOverride?.tintColor
            ?? wallsProfile?.tintColor
            ?? assetDefaults?.tintColor
            ?? crustTintColor
            ?? '#8b6f4a'
        ));
        const tintBlendMode = resolveMountainBlendMode(
            biomeDebug?.mountainTintBlendMode
            ?? presetAssetMountain?.tintBlendMode
            ?? assetTheme?.tintBlendMode
            ?? wallsThemeOverride?.tintBlendMode
            ?? wallsProfile?.tintBlendMode
            ?? assetDefaults?.tintBlendMode,
            'soft-light'
        );
        const tintOpacity = Math.min(1, Math.max(0, Number(
            biomeDebug?.mountainTintOpacity
            ?? presetAssetMountain?.tintOpacity
            ?? assetTheme?.tintOpacity
            ?? wallsThemeOverride?.tintOpacity
            ?? wallsProfile?.tintOpacity
            ?? assetDefaults?.tintOpacity
            ?? 0
        )));
        const rgb = hexToRgb01(tintColor);
        return {
            scale,
            offsetX,
            offsetY,
            anchorX,
            anchorY,
            crustBlendMode,
            crustBlendOpacity,
            tintColor,
            tintBlendMode,
            tintOpacity,
            tintMatrixValues: `0 0 0 0 ${rgb.r.toFixed(4)} 0 0 0 0 ${rgb.g.toFixed(4)} 0 0 0 0 ${rgb.b.toFixed(4)} 0 0 0 1 0`
        };
    }, [
        biomeThemeKey,
        biomeDebug?.mountainScale,
        biomeDebug?.mountainOffset?.x,
        biomeDebug?.mountainOffset?.y,
        biomeDebug?.mountainAnchor?.x,
        biomeDebug?.mountainAnchor?.y,
        biomeDebug?.mountainCrustBlendMode,
        biomeDebug?.mountainCrustBlendOpacity,
        biomeDebug?.mountainTintColor,
        biomeDebug?.mountainTintBlendMode,
        biomeDebug?.mountainTintOpacity,
        biomeThemePreset?.assetOverrides,
        wallsProfile,
        wallsThemeOverride,
        crustTintBlendMode,
        crustTintColor,
        defaultMountainCrustBlendOpacity
    ]);
    const crustMaterialVisible = Boolean(
        (crustDetailAHref && crustDetailAMode !== 'off' && crustDetailAOpacity > 0)
        || (crustDetailBHref && crustDetailBMode !== 'off' && crustDetailBOpacity > 0)
        || crustTintActive
    );
    const hybridInteractionLayerEnabled = Boolean(
        (undercurrentHref && undercurrentMode !== 'off')
        || (crustHref && crustMode !== 'off')
        || crustMaterialVisible
    );
    const undercurrentPatternId = useMemo(
        () => `biome-undercurrent-${gameState.floor}`,
        [gameState.floor]
    );
    const crustPatternId = useMemo(
        () => `biome-crust-${gameState.floor}`,
        [gameState.floor]
    );
    const crustMaskId = useMemo(
        () => `biome-crust-mask-${gameState.floor}`,
        [gameState.floor]
    );
    const crustDetailAPatternId = useMemo(
        () => `biome-crust-detail-a-${gameState.floor}`,
        [gameState.floor]
    );
    const crustDetailBPatternId = useMemo(
        () => `biome-crust-detail-b-${gameState.floor}`,
        [gameState.floor]
    );
    const crustMaskEnabled = Boolean(
        (crustHref && crustMode !== 'off')
        || (crustDetailAHref && crustDetailAMode !== 'off' && crustDetailAOpacity > 0)
        || (crustDetailBHref && crustDetailBMode !== 'off' && crustDetailBOpacity > 0)
        || crustTintActive
    );
    const crustMaskHoles = useMemo(() => {
        const holes: Array<{ key: string; x: number; y: number }> = [];
        for (const hex of cells) {
            const key = pointToKey(hex);
            const flags = tileVisualFlags.get(key);
            if (!flags || (!flags.isLava && !flags.isFire)) continue;
            const { x, y } = hexToPixel(hex, TILE_SIZE);
            holes.push({ key, x, y });
        }
        return holes;
    }, [cells, tileVisualFlags]);
    const stairsPropAsset = useMemo(() => {
        const id = resolvePropAssetId({ isStairs: true });
        return id ? assetById.get(id) : undefined;
    }, [assetById]);
    const shrinePropAsset = useMemo(() => {
        const id = resolvePropAssetId({ isShrine: true });
        return id ? assetById.get(id) : undefined;
    }, [assetById]);
    const boardProps = useMemo((): BoardProp[] => {
        const out: BoardProp[] = [];
        if (gameState.stairsPosition) {
            out.push({
                id: `stairs-${pointToKey(gameState.stairsPosition)}`,
                kind: 'stairs',
                position: gameState.stairsPosition,
                asset: stairsPropAsset
            });
        }
        if (gameState.shrinePosition) {
            out.push({
                id: `shrine-${pointToKey(gameState.shrinePosition)}`,
                kind: 'shrine',
                position: gameState.shrinePosition,
                asset: shrinePropAsset
            });
        }
        return out;
    }, [gameState.stairsPosition, gameState.shrinePosition, stairsPropAsset, shrinePropAsset]);
    const mountainAssets = useMemo(() => {
        const all = (assetManifest?.assets || []).filter(asset => {
            if (asset.type !== 'prop') return false;
            const id = asset.id.toLowerCase();
            const tags = new Set((asset.tags || []).map(t => t.toLowerCase()));
            const isMountain = id.includes('mountain') || tags.has('mountain');
            if (!isMountain) return false;
            if (!asset.theme) return true;
            const theme = asset.theme.toLowerCase();
            return theme === biomeThemeKey || theme === 'core';
        });
        const sorted = all.sort((a, b) => a.id.localeCompare(b.id));
        const presetPath = String(wallsThemeOverride?.mountainPath || wallsProfile?.mountainPath || '').trim();
        const overridePath = String(biomeDebug?.mountainAssetPath || presetPath).trim();
        if (!overridePath) return sorted;

        const exactMatch = sorted.find(asset => asset.path === overridePath);
        return exactMatch ? [exactMatch] : [];
    }, [assetManifest?.assets, biomeThemeKey, biomeDebug?.mountainAssetPath, wallsProfile?.mountainPath, wallsThemeOverride?.mountainPath]);
    const mountainSettingsByAssetId = useMemo(() => {
        const out = new Map<string, ResolvedMountainRenderSettings>();
        for (const asset of mountainAssets) {
            out.set(asset.id, resolveMountainSettings(asset));
        }
        return out;
    }, [mountainAssets, resolveMountainSettings]);
    const mountainSprites = useMemo((): BoardDepthSprite[] => {
        if (!mountainAssets.length) return [];
        const singleHexPool = mountainAssets.filter(asset => parseMountainClusterSize(asset) === 1);
        const assetPool = singleHexPool.length ? singleHexPool : mountainAssets;
        const wallHexes = cells
            .filter(hex => tileVisualFlags.get(pointToKey(hex))?.isWall)
            .sort((a, b) => pointToKey(a).localeCompare(pointToKey(b)));
        if (!wallHexes.length) return [];

        return wallHexes.map((hex) => {
            const key = pointToKey(hex);
            const pick = Math.floor(
                hashFloat(`${biomeSeed}|mountain-tile|${key}|asset`) * assetPool.length
            ) % assetPool.length;
            const asset = assetPool[pick];
            const settings = mountainSettingsByAssetId.get(asset.id) || resolveMountainSettings(asset);
            const { y } = hexToPixel(hex, TILE_SIZE);
            return {
                id: `mountain-${key}-${asset.id}`,
                kind: 'mountain',
                position: hex,
                asset,
                renderScale: settings.scale,
                zAnchorY: y + TILE_SIZE * 0.42 + settings.offsetY
            };
        });
    }, [mountainAssets, cells, tileVisualFlags, biomeSeed, mountainSettingsByAssetId, resolveMountainSettings]);
    const clutterAssets = useMemo(() => {
        const tags = new Set((clutterLayer?.tags?.length ? clutterLayer.tags : ['clutter', 'obstacle']).map(t => t.toLowerCase()));
        return (assetManifest?.assets || []).filter(asset => {
            if (asset.type !== 'prop' && asset.type !== 'decal') return false;
            const id = asset.id.toLowerCase();
            if (id.includes('mountain')) return false;
            const assetTags = (asset.tags || []).map(t => t.toLowerCase());
            if (assetTags.includes('mountain')) return false;
            if (!assetTags.some(tag => tags.has(tag))) return false;
            if (!asset.theme) return true;
            return asset.theme.toLowerCase() === biomeThemeKey || asset.theme.toLowerCase() === 'core';
        });
    }, [assetManifest?.assets, clutterLayer?.tags, biomeThemeKey]);
    const clutterSprites = useMemo((): BoardDepthSprite[] => {
        if (!clutterAssets.length) return [];
        const density = Math.min(0.6, Math.max(0, Number(clutterLayer?.density ?? 0.08)));
        const maxPerHex = Math.max(1, Math.floor(Number(clutterLayer?.maxPerHex ?? 1)));
        const bleedScaleMax = Math.min(2, Math.max(1, Number(clutterLayer?.bleedScaleMax ?? 2)));
        const out: BoardDepthSprite[] = [];

        for (const hex of cells) {
            const key = pointToKey(hex);
            const flags = tileVisualFlags.get(key);
            if (flags?.isWall || flags?.isLava || flags?.isFire) continue;
            const { y } = hexToPixel(hex, TILE_SIZE);

            for (let slot = 0; slot < maxPerHex; slot++) {
                const roll = hashFloat(`${biomeSeed}|clutter|${key}|slot:${slot}|roll`);
                if (roll > density / (slot + 1)) continue;
                const pick = Math.floor(hashFloat(`${biomeSeed}|clutter|${key}|slot:${slot}|pick`) * clutterAssets.length) % clutterAssets.length;
                const asset = clutterAssets[pick];
                const scale = 1 + hashFloat(`${biomeSeed}|clutter|${key}|slot:${slot}|scale`) * (bleedScaleMax - 1);
                const depthOffset = (hashFloat(`${biomeSeed}|clutter|${key}|slot:${slot}|depth`) - 0.5) * TILE_SIZE * 0.28;
                out.push({
                    id: `clutter-${key}-${slot}-${asset.id}`,
                    kind: 'clutter',
                    position: hex,
                    asset,
                    renderScale: scale,
                    zAnchorY: y + depthOffset
                });
            }
        }

        return out;
    }, [cells, tileVisualFlags, clutterAssets, clutterLayer?.density, clutterLayer?.maxPerHex, clutterLayer?.bleedScaleMax, biomeSeed]);
    const depthSortedSprites = useMemo((): BoardDepthSprite[] => {
        const out: BoardDepthSprite[] = [...mountainSprites, ...clutterSprites];
        for (const prop of boardProps) {
            const { y } = hexToPixel(prop.position, TILE_SIZE);
            const isShrine = prop.kind === 'shrine';
            out.push({
                id: prop.id,
                kind: prop.kind,
                position: prop.position,
                asset: prop.asset,
                renderScale: Math.min(2, isShrine ? 1.5 : 1.42),
                zAnchorY: y + (isShrine ? TILE_SIZE * 0.32 : TILE_SIZE * 0.28),
                fallback: prop.kind
            });
        }
        out.sort((a, b) => {
            if (a.zAnchorY === b.zAnchorY) return a.id.localeCompare(b.id);
            return a.zAnchorY - b.zAnchorY;
        });
        return out;
    }, [mountainSprites, clutterSprites, boardProps]);
    const mountainCoveredWallKeys = useMemo(() => {
        const out = new Set<string>();
        for (const sprite of mountainSprites) {
            out.add(pointToKey(sprite.position));
        }
        return out;
    }, [mountainSprites]);

    const resolveEventPoint = useCallback((payload: any): Point | null => {
        if (!payload) return null;
        const p = payload.position || payload.destination || payload.origin || payload.target;
        if (p && typeof p.q === 'number' && typeof p.r === 'number' && typeof p.s === 'number') return p;
        return null;
    }, []);

    useEffect(() => {
        if (!deathDecalHref) return;
        const timelineEvents = gameState.timelineEvents || [];
        const visualEvents = gameState.visualEvents || [];

        if (timelineEvents.length < processedTimelineDecalCountRef.current) {
            processedTimelineDecalCountRef.current = 0;
        }
        const newTimeline = timelineEvents.slice(processedTimelineDecalCountRef.current);
        processedTimelineDecalCountRef.current = timelineEvents.length;

        if (visualEvents.length < processedVisualDecalCountRef.current) {
            processedVisualDecalCountRef.current = 0;
        }
        const newVisual = visualEvents.slice(processedVisualDecalCountRef.current);
        processedVisualDecalCountRef.current = visualEvents.length;

        const additions: BoardDecal[] = [];
        const now = Date.now();

        for (const ev of newTimeline) {
            if (ev.phase !== 'DEATH_RESOLVE') continue;
            const p = resolveEventPoint(ev.payload);
            if (!p) continue;
            additions.push({
                id: `decal-tl-${ev.id}-${now}-${additions.length}`,
                position: p,
                href: deathDecalHref,
                createdAt: now
            });
        }

        for (const ev of newVisual) {
            if (ev.type !== 'vfx') continue;
            const vfxType = ev.payload?.type;
            if (vfxType !== 'vaporize' && vfxType !== 'explosion_ring') continue;
            const p = resolveEventPoint(ev.payload);
            if (!p) continue;
            additions.push({
                id: `decal-vx-${vfxType}-${now}-${additions.length}`,
                position: p,
                href: deathDecalHref,
                createdAt: now
            });
        }

        if (additions.length > 0) {
            setDecals(prev => [...prev, ...additions].slice(-80));
        }
    }, [gameState.timelineEvents, gameState.visualEvents, deathDecalHref, resolveEventPoint]);

    useEffect(() => {
        const events = gameState.simulationEvents || [];
        if (events.length < processedSimulationEventCountRef.current) {
            processedSimulationEventCountRef.current = 0;
        }
        const newEvents = events.slice(processedSimulationEventCountRef.current);
        processedSimulationEventCountRef.current = events.length;
        if (newEvents.length > 0) {
            onSimulationEvents?.(newEvents);
        }
    }, [gameState.simulationEvents, onSimulationEvents]);

    useEffect(() => {
        if (decals.length === 0) return;
        const ttlMs = 12_000;
        const timer = window.setTimeout(() => {
            const now = Date.now();
            setDecals(prev => prev.filter(d => now - d.createdAt < ttlMs));
        }, 1000);
        return () => window.clearTimeout(timer);
    }, [decals]);

    const clientToWorld = useCallback((clientX: number, clientY: number): CameraVec2 | null => {
        const svg = svgRef.current;
        if (!svg || !svg.getScreenCTM) return null;
        const ctm = svg.getScreenCTM();
        if (!ctm) return null;
        const point = svg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const transformed = point.matrixTransform(ctm.inverse());
        return { x: transformed.x, y: transformed.y };
    }, []);

    const updatePanFromWorldDelta = useCallback((deltaWorld: CameraVec2) => {
        const nextPan = {
            x: cameraPanOffsetRef.current.x + deltaWorld.x,
            y: cameraPanOffsetRef.current.y + deltaWorld.y,
        };
        cameraPanOffsetRef.current = nextPan;
        cancelCameraAnimation();
        commitCameraView(getCameraTarget({ panOffset: nextPan }));
    }, [cancelCameraAnimation, commitCameraView, getCameraTarget]);

    const setZoomPresetAnimated = useCallback((nextPreset: CameraZoomPreset) => {
        setZoomPreset(prev => (prev === nextPreset ? prev : nextPreset));
    }, []);

    const handleResetView = useCallback(() => {
        cameraPanOffsetRef.current = { x: 0, y: 0 };
        animateCameraToTarget({ panOffset: { x: 0, y: 0 }, durationMs: 220 });
    }, [animateCameraToTarget]);

    const handleTileClick = useCallback((hex: Point) => {
        if (Date.now() < suppressTileClickUntilRef.current) return;
        onMove(hex);
    }, [onMove]);

    const handleHoverTile = useCallback((hex: Point) => {
        if (isCameraPanningRef.current || isPinchingRef.current) return;
        setHoveredTile(hex);
    }, []);

    const getActivePointerList = useCallback(() => Array.from(activePointersRef.current.entries()), []);

    const handleBoardPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (e.pointerType !== 'mouse') {
            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
                // Pointer capture is optional across browsers.
            }
        }

        const pointers = getActivePointerList();
        if (pointers.length >= 2) {
            isPinchingRef.current = true;
            isCameraPanningRef.current = false;
            setIsCameraPanning(false);
            dragStateRef.current.didPan = true;
            suppressTileClickUntilRef.current = Date.now() + 250;

            const [a, b] = pointers;
            const dx = a[1].x - b[1].x;
            const dy = a[1].y - b[1].y;
            pinchStateRef.current = {
                startDistance: Math.hypot(dx, dy),
                startPreset: zoomPreset,
                appliedPreset: zoomPreset
            };
            return;
        }

        dragStateRef.current = {
            activePointerId: e.pointerId,
            startClient: { x: e.clientX, y: e.clientY },
            lastWorld: clientToWorld(e.clientX, e.clientY),
            didPan: false
        };
    }, [clientToWorld, getActivePointerList, zoomPreset]);

    const handleBoardPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
        if (!activePointersRef.current.has(e.pointerId)) return;
        activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        const pointers = getActivePointerList();
        if (isPinchingRef.current || pointers.length >= 2) {
            if (pointers.length >= 2) {
                isPinchingRef.current = true;
                const [a, b] = pointers;
                const dx = a[1].x - b[1].x;
                const dy = a[1].y - b[1].y;
                const distance = Math.max(1, Math.hypot(dx, dy));
                if (!pinchStateRef.current) {
                    pinchStateRef.current = {
                        startDistance: distance,
                        startPreset: zoomPreset,
                        appliedPreset: zoomPreset
                    };
                } else {
                    const ratio = distance / Math.max(1, pinchStateRef.current.startDistance);
                    let nextPreset = pinchStateRef.current.startPreset;
                    if (ratio > 1.08) nextPreset = 7;
                    if (ratio < 0.92) nextPreset = 11;
                    if (nextPreset !== pinchStateRef.current.appliedPreset) {
                        pinchStateRef.current.appliedPreset = nextPreset;
                        setZoomPresetAnimated(nextPreset);
                    }
                }
                suppressTileClickUntilRef.current = Date.now() + 250;
                e.preventDefault();
            }
            return;
        }

        const drag = dragStateRef.current;
        if (!drag.startClient || drag.activePointerId !== e.pointerId) return;

        const dxPx = e.clientX - drag.startClient.x;
        const dyPx = e.clientY - drag.startClient.y;
        const movedPx = Math.hypot(dxPx, dyPx);
        const thresholdPx = 10;

        if (!drag.didPan && movedPx > thresholdPx) {
            drag.didPan = true;
            isCameraPanningRef.current = true;
            setIsCameraPanning(true);
            suppressTileClickUntilRef.current = Date.now() + 250;
            setHoveredTile(null);
        }

        if (!drag.didPan) return;

        const currentWorld = clientToWorld(e.clientX, e.clientY);
        if (!drag.lastWorld || !currentWorld) return;
        const deltaWorld = {
            x: drag.lastWorld.x - currentWorld.x,
            y: drag.lastWorld.y - currentWorld.y
        };
        drag.lastWorld = currentWorld;
        updatePanFromWorldDelta(deltaWorld);
        e.preventDefault();
    }, [clientToWorld, getActivePointerList, setZoomPresetAnimated, updatePanFromWorldDelta, zoomPreset]);

    const endPointerInteraction = useCallback((pointerId: number) => {
        activePointersRef.current.delete(pointerId);
        const pointers = getActivePointerList();

        if (pointers.length < 2) {
            isPinchingRef.current = false;
            pinchStateRef.current = null;
        }

        const drag = dragStateRef.current;
        if (drag.activePointerId === pointerId) {
            if (drag.didPan) {
                suppressTileClickUntilRef.current = Date.now() + 250;
            }
            dragStateRef.current = {
                activePointerId: pointers[0]?.[0] ?? null,
                startClient: pointers[0] ? { ...pointers[0][1] } : null,
                lastWorld: pointers[0] ? clientToWorld(pointers[0][1].x, pointers[0][1].y) : null,
                didPan: false
            };
        }

        if (activePointersRef.current.size === 0) {
            isCameraPanningRef.current = false;
            setIsCameraPanning(false);
        }
    }, [clientToWorld, getActivePointerList]);

    const handleBoardPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
        endPointerInteraction(e.pointerId);
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
            // no-op
        }
    }, [endPointerInteraction]);

    const handleBoardPointerCancel = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
        endPointerInteraction(e.pointerId);
    }, [endPointerInteraction]);

    const handleBoardWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
        if (e.ctrlKey || e.deltaY !== 0) {
            e.preventDefault();
        }
        if (Math.abs(e.deltaY) < 0.1) return;
        const nextPreset: CameraZoomPreset = e.deltaY < 0 ? 7 : 11;
        setZoomPresetAnimated(nextPreset);
        suppressTileClickUntilRef.current = Date.now() + 120;
    }, [setZoomPresetAnimated]);

    useEffect(() => {
        onBusyStateChange?.(movementBusy || juiceBusy);
    }, [movementBusy, juiceBusy, onBusyStateChange]);

    const actorPositionById = useMemo(() => {
        const out = new Map<string, Point>();
        out.set(gameState.player.id, gameState.player.position);
        for (const e of gameState.enemies) out.set(e.id, e.position);
        for (const e of gameState.companions || []) out.set(e.id, e.position);
        for (const e of gameState.dyingEntities || []) out.set(e.id, e.position);
        return out;
    }, [gameState.player.id, gameState.player.position, gameState.enemies, gameState.companions, gameState.dyingEntities]);

    const juiceActorSnapshots = useMemo(() => ([
        { id: gameState.player.id, position: gameState.player.position, subtype: gameState.player.subtype || 'player' },
        ...gameState.enemies.map(e => ({ id: e.id, position: e.position, subtype: e.subtype })),
        ...(gameState.companions || []).map(e => ({ id: e.id, position: e.position, subtype: e.subtype })),
        ...(gameState.dyingEntities || []).map(e => ({ id: e.id, position: e.position, subtype: e.subtype }))
    ]), [gameState.player.id, gameState.player.position, gameState.player.subtype, gameState.enemies, gameState.companions, gameState.dyingEntities]);

    useEffect(() => {
        if (!onMirrorSnapshot) return;
        const snapshot: StateMirrorSnapshot = {
            turn: gameState.turnNumber || 0,
            stackTick: gameState.stackTrace?.length || 0,
            actors: [...actorPositionById.entries()].map(([id, position]) => ({
                id,
                position: { q: position.q, r: position.r, s: position.s }
            }))
        };
        onMirrorSnapshot(snapshot);
    }, [onMirrorSnapshot, gameState.turnNumber, gameState.stackTrace, actorPositionById]);

    const kineticTraces = useMemo(() => {
        return (gameState.visualEvents || [])
            .filter(ev => ev.type === 'kinetic_trace')
            .map(ev => ev.payload as MovementTrace)
            .filter(trace => {
                if (!trace?.actorId || !trace.origin || !trace.destination) return false;
                const actorPos = actorPositionById.get(trace.actorId);
                // Reject stale traces that do not match current actor snapshot.
                return !!actorPos && pointToKey(actorPos) === pointToKey(trace.destination);
            });
    }, [gameState.visualEvents, actorPositionById]);

    const movementBatchSignature = useMemo(() => {
        if (!kineticTraces.length) return '';
        const turn = gameState.turnNumber ?? 0;
        const traceSig = kineticTraces.map(trace => {
            const pathSig = (trace.path || [])
                .map(p => `${p.q},${p.r},${p.s}`)
                .join('>');
            return [
                trace.actorId,
                `${trace.origin.q},${trace.origin.r},${trace.origin.s}`,
                `${trace.destination.q},${trace.destination.r},${trace.destination.s}`,
                trace.movementType || 'slide',
                trace.startDelayMs || 0,
                trace.durationMs || 0,
                pathSig
            ].join('|');
        }).join('||');
        return `${turn}::${traceSig}`;
    }, [kineticTraces, gameState.turnNumber]);

    const runKeyframedAnimation = useCallback(async (
        node: Element,
        keyframes: Keyframe[],
        options: KeyframeAnimationOptions,
        token: number
    ) => {
        if (token !== runTokenRef.current) return;
        const animation = node.animate(keyframes, {
            ...options,
            fill: options.fill ?? 'forwards'
        });
        activeAnimationsRef.current.push(animation);
        try {
            await animation.finished;
        } catch {
            // Ignore canceled animation rejections.
        } finally {
            activeAnimationsRef.current = activeAnimationsRef.current.filter(a => a !== animation);
        }
    }, []);

    const runMovementTrace = useCallback(async (trace: MovementTrace, token: number, batchStartMs: number) => {
        if (token !== runTokenRef.current) return;
        const playbackScale = 0.76;
        const node = svgRef.current?.querySelector(`[data-actor-node="${trace.actorId}"]`) as SVGElement | null;
        const toAbsoluteTransform = (p: Point) => {
            const px = hexToPixel(p, TILE_SIZE);
            return `translate(${px.x}px, ${px.y}px)`;
        };
        const startDelayMs = Math.max(0, trace.startDelayMs || 0);
        const elapsedSinceBatchStart = Math.max(0, performance.now() - batchStartMs);
        const scaledStartDelayMs = Math.round(startDelayMs * playbackScale);
        const effectiveDelayMs = Math.max(0, scaledStartDelayMs - elapsedSinceBatchStart);

        const path = (trace.path && trace.path.length > 1)
            ? trace.path
            : [trace.origin, trace.destination];
        const segmentCount = Math.max(1, path.length - 1);
        const slideDurationMs = Math.max(90, Math.round((trace.durationMs || segmentCount * 110) * playbackScale));

        if (!node) {
            const fallback = Math.max(0, effectiveDelayMs + slideDurationMs);
            if (fallback > 0) {
                await new Promise<void>(resolve => window.setTimeout(resolve, fallback));
            }
            return;
        }

        if (effectiveDelayMs > 0) {
            await new Promise<void>(resolve => window.setTimeout(resolve, effectiveDelayMs));
            if (token !== runTokenRef.current) return;
        }

        if ((trace.movementType || 'slide') === 'teleport') {
            const duration = Math.max(100, Math.round((trace.durationMs || 180) * playbackScale));
            await runKeyframedAnimation(node, [
                { transform: toAbsoluteTransform(trace.origin), opacity: 1, offset: 0 },
                { transform: toAbsoluteTransform(trace.origin), opacity: 0, offset: 0.45 },
                { transform: toAbsoluteTransform(trace.destination), opacity: 0, offset: 0.55 },
                { transform: toAbsoluteTransform(trace.destination), opacity: 1, offset: 1 }
            ], { duration, easing: 'linear' }, token);
            if (token === runTokenRef.current) {
                node.style.transform = toAbsoluteTransform(trace.destination);
                node.style.opacity = '1';
            }
            return;
        }

        const normalizedPath = [...path];
        const last = normalizedPath[normalizedPath.length - 1];
        if (!last || last.q !== trace.destination.q || last.r !== trace.destination.r || last.s !== trace.destination.s) {
            normalizedPath.push(trace.destination);
        }

        const keyframes: Keyframe[] = normalizedPath.map((p, idx) => ({
            transform: toAbsoluteTransform(p),
            offset: normalizedPath.length === 1 ? 1 : idx / (normalizedPath.length - 1)
        }));
        keyframes[keyframes.length - 1] = {
            ...keyframes[keyframes.length - 1],
            transform: toAbsoluteTransform(trace.destination),
            offset: 1
        };

        await runKeyframedAnimation(node, keyframes, {
            duration: slideDurationMs,
            easing: 'linear'
        }, token);
        if (token === runTokenRef.current) {
            node.style.transform = toAbsoluteTransform(trace.destination);
            node.style.opacity = '1';
        }
    }, [runKeyframedAnimation]);

    const runMovementQueue = useCallback(async () => {
        if (runningMovementRef.current) return;
        runningMovementRef.current = true;
        setMovementBusy(true);
        const token = ++runTokenRef.current;
        const batchStartMs = performance.now();
        try {
            while (movementQueueRef.current.length > 0 && token === runTokenRef.current) {
                const trace = movementQueueRef.current.shift();
                if (!trace) continue;
                await runMovementTrace(trace, token, batchStartMs);
            }
        } finally {
            if (token === runTokenRef.current) {
                runningMovementRef.current = false;
                setMovementBusy(false);
            }
        }
    }, [runMovementTrace]);

    useEffect(() => {
        if (!movementBatchSignature) {
            lastMovementBatchSignatureRef.current = '';
            return;
        }
        if (movementBatchSignature === lastMovementBatchSignatureRef.current) return;
        lastMovementBatchSignatureRef.current = movementBatchSignature;
        movementQueueRef.current.push(...kineticTraces);
        void runMovementQueue();
    }, [movementBatchSignature, kineticTraces, runMovementQueue]);

    useEffect(() => {
        return () => {
            cancelCameraAnimation();
            runTokenRef.current++;
            movementQueueRef.current = [];
            runningMovementRef.current = false;
            activeAnimationsRef.current.forEach(anim => {
                try { anim.cancel(); } catch { /* no-op */ }
            });
            activeAnimationsRef.current = [];
            setMovementBusy(false);
        };
    }, [cancelCameraAnimation]);

    useEffect(() => {
        // Floor transitions remount board data in one reducer step; clear any in-flight
        // animation side-effects so actor visuals always rebind to new floor positions.
        cancelCameraAnimation();
        runTokenRef.current++;
        movementQueueRef.current = [];
        runningMovementRef.current = false;
        activeAnimationsRef.current.forEach(anim => {
            try { anim.cancel(); } catch { /* no-op */ }
        });
        activeAnimationsRef.current = [];
        setMovementBusy(false);
        lastMovementBatchSignatureRef.current = '';
        setDecals([]);
        processedTimelineDecalCountRef.current = 0;
        processedVisualDecalCountRef.current = 0;
    }, [gameState.floor, cancelCameraAnimation]);
    const gridPoints = useMemo(() => getHexPoints(TILE_SIZE - 1), []);
    const maskHexPoints = useMemo(() => getHexPoints(TILE_SIZE + 1), []);
    const biomeClipPoints = useMemo(() => getHexPoints(TILE_SIZE - 2), []);
    const biomeClipId = useMemo(() => `biome-map-clip-${gameState.floor}`, [gameState.floor]);
    const biomeFrame = useMemo(() => ({
        x: bounds.minX - TILE_SIZE * 2,
        y: bounds.minY - TILE_SIZE * 2,
        width: bounds.width + TILE_SIZE * 4,
        height: bounds.height + TILE_SIZE * 4
    }), [bounds.minX, bounds.minY, bounds.width, bounds.height]);
    const biomeCoverBleedPx = useMemo(() => {
        const maxShift = Math.max(
            Math.abs(Number(undercurrentOffset?.x ?? 0)),
            Math.abs(Number(undercurrentOffset?.y ?? 0)),
            Math.abs(Number(crustPatternShift?.x ?? 0)),
            Math.abs(Number(crustPatternShift?.y ?? 0)),
            Math.abs(Number(crustDetailAShift?.x ?? 0)),
            Math.abs(Number(crustDetailAShift?.y ?? 0)),
            Math.abs(Number(crustDetailBShift?.x ?? 0)),
            Math.abs(Number(crustDetailBShift?.y ?? 0))
        );
        return Math.min(TILE_SIZE * 32, Math.max(TILE_SIZE * 8, Math.ceil(maxShift + TILE_SIZE * 6)));
    }, [
        undercurrentOffset?.x,
        undercurrentOffset?.y,
        crustPatternShift?.x,
        crustPatternShift?.y,
        crustDetailAShift?.x,
        crustDetailAShift?.y,
        crustDetailBShift?.x,
        crustDetailBShift?.y
    ]);
    const biomeCoverFrame = useMemo(() => ({
        x: biomeFrame.x - biomeCoverBleedPx,
        y: biomeFrame.y - biomeCoverBleedPx,
        width: biomeFrame.width + biomeCoverBleedPx * 2,
        height: biomeFrame.height + biomeCoverBleedPx * 2
    }), [biomeFrame.x, biomeFrame.y, biomeFrame.width, biomeFrame.height, biomeCoverBleedPx]);

    return (
        <div
            ref={boardViewportRef}
            className={`relative w-full h-full flex justify-center items-center overflow-hidden transition-transform duration-75 ${isShaking ? 'animate-shake' : ''} ${isCameraPanning ? 'cursor-grabbing' : ''}`}
        >
            <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`${renderedViewBox.x} ${renderedViewBox.y} ${renderedViewBox.width} ${renderedViewBox.height}`}
                preserveAspectRatio="xMidYMid meet"
                shapeRendering="geometricPrecision"
                className="max-h-full max-w-full"
                onMouseLeave={() => setHoveredTile(null)}
                onWheel={handleBoardWheel}
                onPointerDown={handleBoardPointerDown}
                onPointerMove={handleBoardPointerMove}
                onPointerUp={handleBoardPointerUp}
                onPointerCancel={handleBoardPointerCancel}
                style={{ touchAction: 'none' }}
            >
                <defs>
                    <clipPath id={biomeClipId} clipPathUnits="userSpaceOnUse">
                        {cells.map((hex) => {
                            const { x, y } = hexToPixel(hex, TILE_SIZE);
                            return (
                                <polygon
                                    key={`biome-clip-${pointToKey(hex)}`}
                                    points={biomeClipPoints}
                                    transform={`translate(${x},${y})`}
                                />
                            );
                        })}
                    </clipPath>
                    {undercurrentHref && undercurrentMode === 'repeat' && (
                        <pattern
                            id={undercurrentPatternId}
                            patternUnits="userSpaceOnUse"
                            width={undercurrentScalePx}
                            height={undercurrentScalePx}
                            patternTransform={`translate(${undercurrentOffset.x} ${undercurrentOffset.y})`}
                        >
                            <image
                                href={undercurrentHref}
                                x="0"
                                y="0"
                                width={undercurrentScalePx}
                                height={undercurrentScalePx}
                                preserveAspectRatio="xMidYMid slice"
                            />
                            {(undercurrentScroll.x !== 0 || undercurrentScroll.y !== 0) && (
                                <animateTransform
                                    attributeName="patternTransform"
                                    type="translate"
                                    from={`${undercurrentOffset.x} ${undercurrentOffset.y}`}
                                    to={`${undercurrentOffset.x + undercurrentScroll.x} ${undercurrentOffset.y + undercurrentScroll.y}`}
                                    dur={`${undercurrentScroll.durationMs}ms`}
                                    repeatCount="indefinite"
                                />
                            )}
                        </pattern>
                    )}
                    {crustHref && crustMode === 'repeat' && (
                        <pattern
                            id={crustPatternId}
                            patternUnits="userSpaceOnUse"
                            width={crustScalePx}
                            height={crustScalePx}
                            patternTransform={`translate(${crustPatternShift.x} ${crustPatternShift.y})`}
                        >
                            <image
                                href={crustHref}
                                x="0"
                                y="0"
                                width={crustScalePx}
                                height={crustScalePx}
                                preserveAspectRatio="xMidYMid slice"
                            />
                        </pattern>
                    )}
                    {crustDetailAHref && crustDetailAMode === 'repeat' && (
                        <pattern
                            id={crustDetailAPatternId}
                            patternUnits="userSpaceOnUse"
                            width={crustDetailAScalePx}
                            height={crustDetailAScalePx}
                            patternTransform={`translate(${crustDetailAShift.x} ${crustDetailAShift.y})`}
                        >
                            <image
                                href={crustDetailAHref}
                                x="0"
                                y="0"
                                width={crustDetailAScalePx}
                                height={crustDetailAScalePx}
                                preserveAspectRatio="xMidYMid slice"
                            />
                            {(crustDetailAScroll.x !== 0 || crustDetailAScroll.y !== 0) && (
                                <animateTransform
                                    attributeName="patternTransform"
                                    type="translate"
                                    from={`${crustDetailAShift.x} ${crustDetailAShift.y}`}
                                    to={`${crustDetailAShift.x + crustDetailAScroll.x} ${crustDetailAShift.y + crustDetailAScroll.y}`}
                                    dur={`${crustDetailAScroll.durationMs}ms`}
                                    repeatCount="indefinite"
                                />
                            )}
                        </pattern>
                    )}
                    {crustDetailBHref && crustDetailBMode === 'repeat' && (
                        <pattern
                            id={crustDetailBPatternId}
                            patternUnits="userSpaceOnUse"
                            width={crustDetailBScalePx}
                            height={crustDetailBScalePx}
                            patternTransform={`translate(${crustDetailBShift.x} ${crustDetailBShift.y})`}
                        >
                            <image
                                href={crustDetailBHref}
                                x="0"
                                y="0"
                                width={crustDetailBScalePx}
                                height={crustDetailBScalePx}
                                preserveAspectRatio="xMidYMid slice"
                            />
                            {(crustDetailBScroll.x !== 0 || crustDetailBScroll.y !== 0) && (
                                <animateTransform
                                    attributeName="patternTransform"
                                    type="translate"
                                    from={`${crustDetailBShift.x} ${crustDetailBShift.y}`}
                                    to={`${crustDetailBShift.x + crustDetailBScroll.x} ${crustDetailBShift.y + crustDetailBScroll.y}`}
                                    dur={`${crustDetailBScroll.durationMs}ms`}
                                    repeatCount="indefinite"
                                />
                            )}
                        </pattern>
                    )}
                    {crustMaskEnabled && (
                        <mask id={crustMaskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
                            <rect
                                x={biomeFrame.x}
                                y={biomeFrame.y}
                                width={biomeFrame.width}
                                height={biomeFrame.height}
                                fill="white"
                            />
                            {crustMaskHoles.map((hole) => (
                                <polygon
                                    key={`hole-${hole.key}`}
                                    points={maskHexPoints}
                                    transform={`translate(${hole.x},${hole.y})`}
                                    fill="black"
                                    opacity={1}
                                />
                            ))}
                        </mask>
                    )}
                </defs>
                <g data-layer="biome-undercurrent" pointerEvents="none" clipPath={`url(#${biomeClipId})`}>
                    {undercurrentHref && undercurrentMode === 'repeat' && (
                        <rect
                            x={biomeFrame.x}
                            y={biomeFrame.y}
                            width={biomeFrame.width}
                            height={biomeFrame.height}
                            fill={`url(#${undercurrentPatternId})`}
                            opacity={undercurrentOpacity}
                        />
                    )}
                    {undercurrentHref && undercurrentMode === 'cover' && (
                        <image
                            href={undercurrentHref}
                            x={biomeCoverFrame.x + undercurrentOffset.x}
                            y={biomeCoverFrame.y + undercurrentOffset.y}
                            width={biomeCoverFrame.width}
                            height={biomeCoverFrame.height}
                            preserveAspectRatio="xMidYMid slice"
                            opacity={undercurrentOpacity}
                        />
                    )}
                </g>
                <g data-layer="biome-crust" pointerEvents="none" clipPath={`url(#${biomeClipId})`}>
                    {crustHref && crustMode === 'repeat' && (
                        <rect
                            x={biomeFrame.x}
                            y={biomeFrame.y}
                            width={biomeFrame.width}
                            height={biomeFrame.height}
                            fill={`url(#${crustPatternId})`}
                            opacity={crustOpacity}
                            mask={`url(#${crustMaskId})`}
                        />
                    )}
                    {crustHref && crustMode === 'cover' && (
                        <image
                            href={crustHref}
                            x={biomeCoverFrame.x + crustPatternShift.x}
                            y={biomeCoverFrame.y + crustPatternShift.y}
                            width={biomeCoverFrame.width}
                            height={biomeCoverFrame.height}
                            preserveAspectRatio="xMidYMid slice"
                            opacity={crustOpacity}
                            mask={`url(#${crustMaskId})`}
                        />
                    )}
                    {crustDetailAHref && crustDetailAMode === 'repeat' && crustDetailAOpacity > 0 && (
                        <rect
                            x={biomeFrame.x}
                            y={biomeFrame.y}
                            width={biomeFrame.width}
                            height={biomeFrame.height}
                            fill={`url(#${crustDetailAPatternId})`}
                            opacity={crustDetailAOpacity}
                            mask={`url(#${crustMaskId})`}
                        />
                    )}
                    {crustDetailAHref && crustDetailAMode === 'cover' && crustDetailAOpacity > 0 && (
                        <image
                            href={crustDetailAHref}
                            x={biomeCoverFrame.x + crustDetailAShift.x}
                            y={biomeCoverFrame.y + crustDetailAShift.y}
                            width={biomeCoverFrame.width}
                            height={biomeCoverFrame.height}
                            preserveAspectRatio="xMidYMid slice"
                            opacity={crustDetailAOpacity}
                            mask={`url(#${crustMaskId})`}
                        />
                    )}
                    {crustDetailBHref && crustDetailBMode === 'repeat' && crustDetailBOpacity > 0 && (
                        <rect
                            x={biomeFrame.x}
                            y={biomeFrame.y}
                            width={biomeFrame.width}
                            height={biomeFrame.height}
                            fill={`url(#${crustDetailBPatternId})`}
                            opacity={crustDetailBOpacity}
                            mask={`url(#${crustMaskId})`}
                        />
                    )}
                    {crustDetailBHref && crustDetailBMode === 'cover' && crustDetailBOpacity > 0 && (
                        <image
                            href={crustDetailBHref}
                            x={biomeCoverFrame.x + crustDetailBShift.x}
                            y={biomeCoverFrame.y + crustDetailBShift.y}
                            width={biomeCoverFrame.width}
                            height={biomeCoverFrame.height}
                            preserveAspectRatio="xMidYMid slice"
                            opacity={crustDetailBOpacity}
                            mask={`url(#${crustMaskId})`}
                        />
                    )}
                    {crustTintActive && crustTintColor && (
                        <rect
                            x={biomeFrame.x}
                            y={biomeFrame.y}
                            width={biomeFrame.width}
                            height={biomeFrame.height}
                            fill={crustTintColor}
                            opacity={crustTintOpacity}
                            mask={`url(#${crustMaskId})`}
                            style={crustTintBlendMode !== 'normal' ? { mixBlendMode: crustTintBlendMode } : undefined}
                        />
                    )}
                </g>
                <g data-layer="interaction-preview">
                    <PreviewOverlay
                        gameState={gameState}
                        selectedSkillId={selectedSkillId}
                        showMovementRange={showMovementRange}
                        hoveredTile={hoveredTile}
                        enginePreviewGhost={resolvedEnginePreviewGhost}
                    />
                </g>
                <g data-layer="interaction-tiles">
                    {cells.map((hex) => {
                        const tileKey = pointToKey(hex);
                        const flags = tileVisualFlags.get(tileKey) || { isWall: false, isLava: false, isFire: false };
                        const isWall = flags.isWall;
                        const isLava = flags.isLava;
                        const isFire = flags.isFire;

                        const isMoveHighlight =
                            (showMovementRange && !selectedSkillId && movementTargetSet.has(tileKey))
                            || (
                                showMovementRange
                                && !selectedSkillId
                                && !hasPrimaryMovementSkills
                                && fallbackNeighborSet.has(tileKey)
                                && !isWall
                            );
                        const isSkillHighlight = !!selectedSkillId && selectedSkillTargetSet.has(tileKey);
                        const showRangeHighlight = isSkillHighlight || isMoveHighlight;
                        const isStairs = tileKey === stairsKey;
                        const isShrine = shrineKey ? tileKey === shrineKey : false;
                        const renderWallTile = isWall && !mountainCoveredWallKeys.has(tileKey);
                        const interactionOnly = hybridInteractionLayerEnabled && !renderWallTile;
                        const tileAssetId = resolveTileAssetId({ isWall: renderWallTile, isLava, isFire, isStairs, isShrine, theme: gameState.theme });
                        const tileAssetHref = interactionOnly ? undefined : assetById.get(tileAssetId)?.path;

                        return (
                            <HexTile
                                key={tileKey}
                                hex={hex}
                                onClick={handleTileClick}
                                isValidMove={showRangeHighlight}
                                isTargeted={false}
                                isStairs={isStairs}
                                isLava={isLava}
                                isFire={isFire}
                                isShrine={isShrine}
                                isWall={renderWallTile}
                                onMouseEnter={handleHoverTile}
                                assetHref={tileAssetHref}
                                interactionOnly={interactionOnly}
                            />
                        );
                    })}

                    <g>
                        {decals.map((decal) => {
                            const { x, y } = hexToPixel(decal.position, TILE_SIZE);
                            const ageMs = Date.now() - decal.createdAt;
                            const opacity = Math.max(0.18, 0.75 - (ageMs / 12000) * 0.57);
                            return (
                                <image
                                    key={decal.id}
                                    href={decal.href}
                                    x={x - TILE_SIZE * 0.7}
                                    y={y - TILE_SIZE * 0.7}
                                    width={TILE_SIZE * 1.4}
                                    height={TILE_SIZE * 1.4}
                                    preserveAspectRatio="xMidYMid meet"
                                    opacity={opacity}
                                />
                            );
                        })}
                    </g>
                </g>
                <g data-layer="clutter-obstacles" pointerEvents="none">
                    {depthSortedSprites.map((sprite) => {
                        const { x, y } = hexToPixel(sprite.position, TILE_SIZE);
                        if (sprite.asset?.path) {
                            const baseAnchorX = Math.min(1, Math.max(0, sprite.asset.anchor?.x ?? 0.5));
                            const baseAnchorY = Math.min(1, Math.max(0, sprite.asset.anchor?.y ?? 0.5));
                            const isMountain = sprite.kind === 'mountain';
                            const mountainSettings = isMountain
                                ? (mountainSettingsByAssetId.get(sprite.asset.id) || resolveMountainSettings(sprite.asset))
                                : null;
                            const anchorX = mountainSettings ? mountainSettings.anchorX : baseAnchorX;
                            const anchorY = mountainSettings ? mountainSettings.anchorY : baseAnchorY;
                            const renderX = x + (mountainSettings ? mountainSettings.offsetX : 0);
                            const renderY = y + (mountainSettings ? mountainSettings.offsetY : 0);
                            const renderWidth = Math.max(8, sprite.asset.width * manifestUnitToBoardScale * sprite.renderScale);
                            const renderHeight = Math.max(8, sprite.asset.height * manifestUnitToBoardScale * sprite.renderScale);
                            const isShrineProp = sprite.kind === 'shrine';
                            const isStairsProp = sprite.kind === 'stairs';
                            const isObjectiveProp = isShrineProp || isStairsProp;
                            const haloColor = isShrineProp ? 'rgba(251,146,60,0.25)' : 'rgba(74,222,128,0.22)';
                            const haloStroke = isShrineProp ? '#fdba74' : '#86efac';
                            const haloCx = x;
                            const haloCy = y - renderHeight * anchorY + renderHeight * 0.84;
                            const haloRx = Math.max(14, renderWidth * 0.32);
                            const haloRy = Math.max(8, renderHeight * 0.14);
                            return (
                                <g key={sprite.id}>
                                    {isObjectiveProp && (
                                        <>
                                            <ellipse
                                                cx={haloCx}
                                                cy={haloCy}
                                                rx={haloRx}
                                                ry={haloRy}
                                                fill={haloColor}
                                                opacity={0.95}
                                            />
                                            <ellipse
                                                cx={haloCx}
                                                cy={haloCy}
                                                rx={haloRx * 1.14}
                                                ry={haloRy * 1.14}
                                                fill="none"
                                                stroke={haloStroke}
                                                strokeWidth={2}
                                                opacity={0.72}
                                                style={{ animation: `shrineGlow ${isShrineProp ? 1.8 : 2.4}s ease-in-out infinite` }}
                                            />
                                        </>
                                    )}
                                    {(() => {
                                        const baseFilter = isObjectiveProp
                                            ? (isShrineProp
                                                ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.55)) drop-shadow(0 0 4px rgba(251,146,60,0.45)) saturate(1.08) contrast(1.06)'
                                                : 'drop-shadow(0 4px 6px rgba(0,0,0,0.55)) drop-shadow(0 0 4px rgba(74,222,128,0.42)) saturate(1.08) contrast(1.06)')
                                            : (isMountain
                                                ? 'drop-shadow(0 7px 10px rgba(0,0,0,0.56)) saturate(1.04) contrast(1.08)'
                                                : 'drop-shadow(0 5px 8px rgba(0,0,0,0.48)) saturate(0.98) contrast(1.04)');
                                        const baseOpacity = isObjectiveProp ? 0.99 : (isMountain ? 0.96 : 0.9);
                                        const mountainBlendPassEnabled = Boolean(
                                            mountainSettings
                                            && mountainSettings.crustBlendMode !== 'off'
                                            && mountainSettings.crustBlendOpacity > 0
                                        );
                                        const mountainTintPassEnabled = Boolean(
                                            mountainSettings
                                            && mountainSettings.tintBlendMode !== 'off'
                                            && mountainSettings.tintOpacity > 0
                                        );
                                        const mountainBlendMode = (
                                            mountainSettings?.crustBlendMode !== 'off'
                                                ? mountainSettings?.crustBlendMode
                                                : undefined
                                        ) as React.CSSProperties['mixBlendMode'] | undefined;
                                        const mountainTintMode = (
                                            mountainSettings?.tintBlendMode !== 'off'
                                                ? mountainSettings?.tintBlendMode
                                                : undefined
                                        ) as React.CSSProperties['mixBlendMode'] | undefined;
                                        const imageX = renderX - renderWidth * anchorX;
                                        const imageY = renderY - renderHeight * anchorY;
                                        const spriteSafeId = toSvgSafeId(sprite.id);
                                        const mountainGroundGradientId = `mountain-ground-gradient-${gameState.floor}-${spriteSafeId}`;
                                        const mountainGroundMaskId = `mountain-ground-mask-${gameState.floor}-${spriteSafeId}`;
                                        const mountainTintFilterId = `mountain-tint-filter-${gameState.floor}-${spriteSafeId}`;
                                        return (
                                            <>
                                                {(mountainBlendPassEnabled || mountainTintPassEnabled) && (
                                                    <defs>
                                                        {mountainBlendPassEnabled && (
                                                            <>
                                                                <linearGradient id={mountainGroundGradientId} x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                                                                    <stop offset="42%" stopColor="#ffffff" stopOpacity="0.04" />
                                                                    <stop offset="64%" stopColor="#ffffff" stopOpacity="0.42" />
                                                                    <stop offset="82%" stopColor="#ffffff" stopOpacity="0.82" />
                                                                    <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                                                                </linearGradient>
                                                                <mask
                                                                    id={mountainGroundMaskId}
                                                                    maskUnits="userSpaceOnUse"
                                                                    maskContentUnits="userSpaceOnUse"
                                                                >
                                                                    <rect
                                                                        x={imageX}
                                                                        y={imageY}
                                                                        width={renderWidth}
                                                                        height={renderHeight}
                                                                        fill={`url(#${mountainGroundGradientId})`}
                                                                    />
                                                                </mask>
                                                            </>
                                                        )}
                                                        {mountainTintPassEnabled && (
                                                            <filter
                                                                id={mountainTintFilterId}
                                                                x="-10%"
                                                                y="-10%"
                                                                width="120%"
                                                                height="120%"
                                                            >
                                                                <feColorMatrix
                                                                    type="matrix"
                                                                    values={mountainSettings?.tintMatrixValues}
                                                                />
                                                            </filter>
                                                        )}
                                                    </defs>
                                                )}
                                                <image
                                                    href={sprite.asset.path}
                                                    x={imageX}
                                                    y={imageY}
                                                    width={renderWidth}
                                                    height={renderHeight}
                                                    preserveAspectRatio="xMidYMid meet"
                                                    opacity={baseOpacity}
                                                    style={{ filter: baseFilter }}
                                                />
                                                {mountainBlendPassEnabled && (
                                                    <image
                                                        href={sprite.asset.path}
                                                        x={imageX}
                                                        y={imageY}
                                                        width={renderWidth}
                                                        height={renderHeight}
                                                        preserveAspectRatio="xMidYMid meet"
                                                        opacity={Math.min(0.9, mountainSettings?.crustBlendOpacity || 0)}
                                                        mask={`url(#${mountainGroundMaskId})`}
                                                        style={{
                                                            mixBlendMode: mountainBlendMode,
                                                            filter: 'brightness(0.92) saturate(0.76) contrast(1.03)'
                                                        }}
                                                    />
                                                )}
                                                {mountainTintPassEnabled && (
                                                    <image
                                                        href={sprite.asset.path}
                                                        x={imageX}
                                                        y={imageY}
                                                        width={renderWidth}
                                                        height={renderHeight}
                                                        preserveAspectRatio="xMidYMid meet"
                                                        opacity={Math.min(0.95, mountainSettings?.tintOpacity || 0)}
                                                        filter={`url(#${mountainTintFilterId})`}
                                                        style={{ mixBlendMode: mountainTintMode }}
                                                    />
                                                )}
                                            </>
                                        );
                                    })()}
                                </g>
                            );
                        }

                        if (sprite.fallback === 'shrine') {
                            return (
                                <g key={sprite.id} transform={`translate(${x},${y})`}>
                                    <polygon
                                        points="0,-18 8,-4 5,12 -5,12 -8,-4"
                                        fill="#f97316"
                                        stroke="#fff"
                                        strokeWidth="1"
                                        opacity="0.9"
                                    />
                                    <polygon points="-2,-14 2,-14 1,-2 -1,-2" fill="rgba(255,255,255,0.6)" />
                                    <circle
                                        cx="0"
                                        cy="0"
                                        r="14"
                                        fill="none"
                                        stroke="#fdba74"
                                        strokeWidth="2"
                                        opacity="0.4"
                                        style={{ animation: 'shrineGlow 2s ease-in-out infinite' }}
                                    />
                                </g>
                            );
                        }

                        return (
                            <g key={sprite.id} transform={`translate(${x},${y})`}>
                                <rect x="-12" y="6" width="8" height="4" fill="#1f2937" rx="1" />
                                <rect x="-6" y="2" width="8" height="4" fill="#374151" rx="1" />
                                <rect x="0" y="-2" width="8" height="4" fill="#4b5563" rx="1" />
                                <rect x="6" y="-6" width="8" height="4" fill="#6b7280" rx="1" />
                                <path d="M 2 -14 L 2 -20 L -4 -20 L 2 -26 L 8 -20 L 2 -20" fill="#22c55e" stroke="#16a34a" strokeWidth="1" />
                            </g>
                        );
                    })}
                </g>
                <g>
                    {/* Spear Trail */}
                    {gameState.lastSpearPath && gameState.lastSpearPath.length >= 2 && (() => {
                        const pathPoints = gameState.lastSpearPath.map(p => hexToPixel(p, TILE_SIZE));
                        const d = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                        return <path d={d} stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" fill="none" strokeDasharray="4 2" strokeLinecap="round" />;
                    })()}

                    {/* Spear on ground */}
                    {gameState.spearPosition && (
                        <Entity entity={{
                            id: 'spear',
                            type: 'player',
                            subtype: 'footman',
                            position: gameState.spearPosition,
                            hp: 1, maxHp: 1,
                            statusEffects: [],
                            temporaryArmor: 0,
                            activeSkills: [],
                            speed: 0,
                            factionId: 'player'
                        } as any} isSpear={true} />
                    )}

                    <Entity
                        key={`player-${gameState.floor}`}
                        entity={gameState.player}
                        movementTrace={latestTraceByActor[gameState.player.id]}
                        waapiControlled={true}
                        assetHref={assetById.get(resolveUnitAssetId(gameState.player))?.path}
                        fallbackAssetHref={resolveUnitFallbackAssetHref(gameState.player)}
                        floorTheme={biomeThemeKey}
                    />
                    {gameState.enemies.map(e => (
                        <Entity
                            key={`${e.id}-${gameState.floor}`}
                            entity={e}
                            movementTrace={latestTraceByActor[e.id]}
                            waapiControlled={true}
                            assetHref={assetById.get(resolveUnitAssetId(e))?.path}
                            fallbackAssetHref={resolveUnitFallbackAssetHref(e)}
                            floorTheme={biomeThemeKey}
                        />
                    ))}
                    {gameState.dyingEntities?.map(e => (
                        <Entity
                            key={`dying-${e.id}-${gameState.floor}-${gameState.turnNumber}`}
                            entity={e}
                            isDying={true}
                            movementTrace={latestTraceByActor[e.id]}
                            waapiControlled={true}
                            assetHref={assetById.get(resolveUnitAssetId(e))?.path}
                            fallbackAssetHref={resolveUnitFallbackAssetHref(e)}
                            floorTheme={biomeThemeKey}
                        />
                    ))}

                    <JuiceManager
                        visualEvents={gameState.visualEvents || []}
                        timelineEvents={gameState.timelineEvents || []}
                        simulationEvents={gameState.simulationEvents || []}
                        actorSnapshots={juiceActorSnapshots}
                        onBusyStateChange={setJuiceBusy}
                        assetManifest={assetManifest}
                    />
                </g>
                <g data-layer="interaction-ui-grid" pointerEvents="none" shapeRendering="crispEdges">
                    {cells.map((hex) => {
                        const { x, y } = hexToPixel(hex, TILE_SIZE);
                        return (
                            <g key={`grid-${pointToKey(hex)}`} transform={`translate(${x},${y})`}>
                                <polygon
                                    points={gridPoints}
                                    fill="none"
                                    stroke="rgba(201,224,255,0.12)"
                                    strokeWidth={0.9}
                                />
                            </g>
                        );
                    })}
                </g>
                <g data-layer="ui-objective-markers" pointerEvents="none">
                    {boardProps.map((prop) => {
                        const { x, y } = hexToPixel(prop.position, TILE_SIZE);
                        const isShrineProp = prop.kind === 'shrine';
                        const markerFill = isShrineProp ? '#c2410c' : '#15803d';
                        const markerLabel = isShrineProp ? 'S' : 'E';
                        const markerX = x + TILE_SIZE * 0.52;
                        const markerY = y - TILE_SIZE * 0.52;
                        return (
                            <g key={`marker-${prop.id}`} transform={`translate(${markerX},${markerY})`}>
                                <circle r={14} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2} style={{ animation: `shrineGlow ${isShrineProp ? 1.6 : 1.9}s ease-in-out infinite` }} />
                                <circle r={10.5} fill={markerFill} stroke="#ffffff" strokeWidth={2} />
                                <text
                                    x={0}
                                    y={0}
                                    textAnchor="middle"
                                    dy=".34em"
                                    fill="#ffffff"
                                    fontSize={10}
                                    fontWeight={900}
                                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
                                >
                                    {markerLabel}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-30 flex items-center gap-1.5 pointer-events-auto">
                <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-black/35 backdrop-blur-sm p-1">
                    {CAMERA_ZOOM_PRESETS.map((preset) => {
                        const active = zoomPreset === preset;
                        return (
                            <button
                                key={`zoom-${preset}`}
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => setZoomPresetAnimated(preset)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${active
                                    ? 'bg-white text-black'
                                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                                    }`}
                                aria-label={`Set zoom to ${preset} tiles wide`}
                            >
                                {preset}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={handleResetView}
                        className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white/5 text-white/70 hover:bg-white/10"
                        aria-label="Reset camera to player"
                    >
                        Fit
                    </button>
                </div>
            </div>
        </div>
    );
};
