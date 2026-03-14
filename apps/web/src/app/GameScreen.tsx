import { pointToKey, type GameState, type Point, type SimulationEvent, type StateMirrorSnapshot } from '@hop/engine';
import React from 'react';
import { GameBoard } from '../components/GameBoard';
import { UI } from '../components/UI';
import { UpgradeOverlay } from '../components/UpgradeOverlay';
import { SkillTray } from '../components/SkillTray';
import { SynapseBottomTray } from '../components/synapse/SynapseBottomTray';
import type { VisualAssetManifest } from '../visual/asset-manifest';
import { resolveBoardColorMode } from '../visual/biome-config';
import type { CameraInsetsPx } from '../visual/camera';
import { UI_THEME_OPTIONS, type UiColorMode, type UiPreferencesV1 } from './ui-preferences';
import {
  getUiInformationRevealMode,
  setUiInformationRevealMode,
  type UiInformationRevealMode
} from './information-reveal';
import {
  buildSynapseDeltaMap,
  buildSynapseScoreSnapshot,
  resolveSynapsePreview,
  type SynapseDeltaEntry,
  type SynapsePulse,
  type SynapseSelection
} from './synapse';
import {
  ResolvingTurnOverlay,
  MobileToastsOverlay,
  TutorialInstructionsOverlay,
  RunLostOverlay,
  RunWonOverlay,
  FloorIntroOverlay,
  ReplayControlsOverlay
} from './AppOverlays';
import { WorldgenBoardOverlay } from './WorldgenBoardOverlay';
import { WorldgenDebugPanel } from './WorldgenDebugPanel';
import { UiTriResourceHeader, getWaitDirectiveLabel } from '../components/ui/ui-status-panel-sections';

type MobileToast = {
  id: string;
  text: string;
  tone: 'damage' | 'heal' | 'status' | 'system';
  createdAt: number;
};

type FloorIntroState = { floor: number; theme: string } | null;

const InfoSettingsPanel = ({
  compact = false
}: {
  compact?: boolean;
}) => (
  <div className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] ${compact ? 'p-2.5' : 'p-3'}`}>
    <div className="font-black uppercase tracking-[0.2em] text-[var(--text-muted)]" style={{ fontSize: compact ? 'var(--hud-label-font, 9px)' : '10px' }}>
      Info Settings
    </div>
  </div>
);

const EnemyAlertChip = ({
  alerted
}: {
  alerted: boolean;
}) => (
  <div
    className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 font-black uppercase tracking-[0.16em] ${
      alerted
        ? 'border-[var(--accent-danger-border)] bg-[var(--accent-danger-soft)] text-[var(--accent-danger)]'
        : 'border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[var(--text-muted)]'
    }`}
    style={{ fontSize: 'var(--hud-label-font, 10px)' }}
    title="Binary enemy awareness state"
  >
    <span>Enemy Alert</span>
    <span>{alerted ? 'On' : 'Off'}</span>
  </div>
);

interface GameScreenProps {
  gameState: GameState;
  uiPreferences: UiPreferencesV1;
  selectedSkillId: string | null;
  showMovementRange: boolean;
  isInputLocked: boolean;
  isReplayMode: boolean;
  replayActionsLength: number;
  replayIndex: number;
  replayActive: boolean;
  mobileToasts: MobileToast[];
  tutorialInstructions: string | null;
  floorIntro: FloorIntroState;
  assetManifest?: VisualAssetManifest | null;
  isSynapseMode: boolean;
  synapseSelection: SynapseSelection;
  synapsePulse: SynapsePulse;
  onSetBoardBusy: (busy: boolean) => void;
  onTileClick: (hex: Point) => void;
  onSimulationEvents?: (events: SimulationEvent[]) => void;
  onMirrorSnapshot?: (snapshot: StateMirrorSnapshot) => void;
  onReset: () => void;
  onWait: () => void;
  onExitToHub: () => void;
  onSelectSkill: (skillId: string | null) => void;
  onSelectUpgrade: (upgradeId: string) => void;
  onToggleSynapseMode: () => void;
  onSynapseInspectEntity: (actorId: string) => void;
  onSynapseSelectSource: (actorId: string) => void;
  onSynapseClearSelection: () => void;
  onDismissTutorial: () => void;
  onToggleReplay: () => void;
  onStepReplay: () => void;
  onJumpReplay: (index: number) => void;
  replayMarkerIndices?: number[];
  onCloseReplay: () => void;
  onQuickRestart: () => void;
  onViewReplay: () => void;
  onRunLostActionsReady?: () => void;
  onSetColorMode: (mode: UiColorMode) => void;
  mobileDockV2Enabled?: boolean;
  replayChronicleEnabled?: boolean;
}

interface GuardedActionButtonProps {
  disabled?: boolean;
  onConfirm: () => void;
  label: string;
  className: string;
  style?: React.CSSProperties;
}

const GuardedActionButton = ({ disabled, onConfirm, label, className, style }: GuardedActionButtonProps) => {
  const [holding, setHolding] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  const clearHold = React.useCallback(() => {
    setHolding(false);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startHold = React.useCallback(() => {
    if (disabled) return;
    setHolding(true);
    timerRef.current = window.setTimeout(() => {
      onConfirm();
      clearHold();
    }, 600);
  }, [clearHold, disabled, onConfirm]);

  React.useEffect(() => clearHold, [clearHold]);

  return (
    <button
      disabled={disabled}
      onMouseDown={startHold}
      onMouseUp={clearHold}
      onMouseLeave={clearHold}
      onTouchStart={startHold}
      onTouchEnd={clearHold}
      onTouchCancel={clearHold}
      className={`${className} ${holding ? 'brightness-110' : ''}`}
      style={style}
      title={`${label} (hold)`}
    >
      {holding ? `${label}...` : label}
    </button>
  );
};

export const resolveLayoutMode = (
  width: number,
  height: number
): 'mobile_portrait' | 'tablet' | 'desktop_command_center' => {
  if (width >= 1200) return 'desktop_command_center';
  if (width >= 768) return 'tablet';
  if (height > width) return 'mobile_portrait';
  return 'tablet';
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const resolveHudScale = (width: number, height: number): number => {
  const shortestViewportEdge = Math.max(1, Math.min(width, height));
  return clamp(shortestViewportEdge / 390, 0.82, 1.24);
};

export const resolveBottomDockHeightPx = (width: number, height: number): number => {
  const safeWidth = Math.max(1, width);
  const ratio = height / safeWidth;
  const percent = ratio > 1.8 ? 0.27 : 0.24;
  return clamp(Math.round(height * percent), 176, 320);
};

export const GameScreen = ({
  gameState,
  uiPreferences,
  selectedSkillId,
  showMovementRange,
  isInputLocked,
  isReplayMode,
  replayActionsLength,
  replayIndex,
  replayActive,
  mobileToasts,
  tutorialInstructions,
  floorIntro,
  assetManifest,
  isSynapseMode,
  synapseSelection,
  synapsePulse,
  onSetBoardBusy,
  onTileClick,
  onSimulationEvents,
  onMirrorSnapshot,
  onReset,
  onWait,
  onExitToHub,
  onSelectSkill,
  onSelectUpgrade,
  onToggleSynapseMode,
  onSynapseInspectEntity,
  onSynapseSelectSource,
  onSynapseClearSelection,
  onDismissTutorial,
  onToggleReplay,
  onStepReplay,
  onJumpReplay,
  replayMarkerIndices,
  onCloseReplay,
  onQuickRestart,
  onViewReplay,
  onRunLostActionsReady,
  onSetColorMode,
  mobileDockV2Enabled = false,
  replayChronicleEnabled = false,
}: GameScreenProps) => {
  const showWorldgenDebug = React.useMemo(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('worldgenDebug') === '1';
  }, []);
  const [intelMode, setIntelMode] = React.useState<UiInformationRevealMode>(() => getUiInformationRevealMode());
  const [viewportSize, setViewportSize] = React.useState(() => {
    if (typeof window === 'undefined') return { width: 390, height: 844 };
    return { width: window.innerWidth, height: window.innerHeight };
  });
  const [layoutMode, setLayoutMode] = React.useState<'mobile_portrait' | 'tablet' | 'desktop_command_center'>(() => {
    if (typeof window === 'undefined') return 'desktop_command_center';
    return resolveLayoutMode(window.innerWidth, window.innerHeight);
  });
  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncFromLocation = () => {
      setIntelMode(getUiInformationRevealMode());
    };
    window.addEventListener('popstate', syncFromLocation);
    return () => {
      window.removeEventListener('popstate', syncFromLocation);
    };
  }, []);
  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setLayoutMode(resolveLayoutMode(width, height));
      setViewportSize({ width, height });
    };
    window.addEventListener('resize', syncViewport);
    syncViewport();
    return () => window.removeEventListener('resize', syncViewport);
  }, []);
  const handleIntelModeChange = React.useCallback((mode: UiInformationRevealMode) => {
    setIntelMode(mode);
    setUiInformationRevealMode(mode);
  }, []);
  const synapsePreview = React.useMemo(
    () => resolveSynapsePreview(gameState.intentPreview),
    [gameState.intentPreview]
  );
  const sigmaValue = React.useMemo(() => {
    const scores = (synapsePreview?.unitScores || []) as Array<{ zScore?: number }>;
    if (scores.length === 0) return 0;
    return scores.reduce((peak, entry) => {
      const z = Number((entry as any).zScore || 0);
      return Math.abs(z) > Math.abs(peak) ? z : peak;
    }, 0);
  }, [synapsePreview]);
  const hostilePeakZ = React.useMemo(() => {
    const scores = (synapsePreview?.unitScores || []) as Array<{ isHostileToPlayer?: boolean; zScore?: number }>;
    return scores.reduce((peak, entry) => {
      if (!entry.isHostileToPlayer) return peak;
      const z = Number(entry.zScore || 0);
      return z > peak ? z : peak;
    }, 0);
  }, [synapsePreview]);
  const dangerThreatActive = hostilePeakZ >= 2;
  const hpProjectionDelta = Number((gameState as any)?.intentPreview?.playerHpDelta || 0);
  const projectedHp = Math.max(0, Math.min(gameState.player.maxHp, gameState.player.hp + hpProjectionDelta));
  const waitLabel = React.useMemo(() => getWaitDirectiveLabel(gameState), [gameState]);
  const boardColorMode = React.useMemo(() => resolveBoardColorMode(gameState.theme), [gameState.theme]);
  const hostileEnemies = React.useMemo(
    () => gameState.enemies.filter(enemy => enemy.hp > 0 && enemy.factionId === 'enemy'),
    [gameState.enemies]
  );
  const enemyAlertActive = React.useMemo(() => {
    if (hostileEnemies.length === 0) return false;
    const awarenessByEnemyId = gameState.visibility?.enemyAwarenessById;
    if (!awarenessByEnemyId) return true;
    return hostileEnemies.some(enemy => {
      const awareness = awarenessByEnemyId[enemy.id];
      return Boolean(
        awareness
        && awareness.memoryTurnsRemaining > 0
        && awareness.lastKnownPlayerPosition
      );
    });
  }, [gameState.visibility?.enemyAwarenessById, hostileEnemies]);
  const hudScale = React.useMemo(
    () => resolveHudScale(viewportSize.width, viewportSize.height),
    [viewportSize.height, viewportSize.width]
  );
  const bottomDockHeightPx = React.useMemo(
    () => resolveBottomDockHeightPx(viewportSize.width, viewportSize.height),
    [viewportSize.height, viewportSize.width]
  );
  const buttonMinHeightPx = React.useMemo(
    () => clamp(Math.round(44 * hudScale), 40, 62),
    [hudScale]
  );
  const buttonFontPx = React.useMemo(
    () => clamp(10 * hudScale, 9, 14),
    [hudScale]
  );
  const labelFontPx = React.useMemo(
    () => clamp(9 * hudScale, 8.5, 12.5),
    [hudScale]
  );
  const valueFontPx = React.useMemo(
    () => clamp(18 * hudScale, 16, 28),
    [hudScale]
  );
  const hudCssVars = React.useMemo(
    () => ({
      '--hud-button-min-h': `${buttonMinHeightPx}px`,
      '--hud-button-font': `${buttonFontPx}px`,
      '--hud-label-font': `${labelFontPx}px`,
      '--hud-value-font': `${valueFontPx}px`,
    } as React.CSSProperties),
    [buttonFontPx, buttonMinHeightPx, labelFontPx, valueFontPx]
  );
  const bottomDockStyle = React.useMemo(
    () => ({
      ...hudCssVars,
      height: `${bottomDockHeightPx}px`
    } as React.CSSProperties),
    [bottomDockHeightPx, hudCssVars]
  );
  const hudActionButtonStyle = React.useMemo(
    () => ({
      minHeight: 'var(--hud-button-min-h)',
      fontSize: 'var(--hud-button-font)'
    } as React.CSSProperties),
    []
  );
  const [synapseDeltasByActorId, setSynapseDeltasByActorId] = React.useState<Record<string, SynapseDeltaEntry>>({});
  const prevSynapseScoresRef = React.useRef<ReturnType<typeof buildSynapseScoreSnapshot> | null>(null);
  const boardSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const desktopUtilityRef = React.useRef<HTMLDivElement | null>(null);
  const desktopSynapseTrayRef = React.useRef<HTMLDivElement | null>(null);
  const [cameraSafeInsetsPx, setCameraSafeInsetsPx] = React.useState<Partial<CameraInsetsPx>>({});

  React.useEffect(() => {
    if (!synapsePreview) {
      prevSynapseScoresRef.current = null;
      setSynapseDeltasByActorId({});
      return;
    }
    const nextSnapshot = buildSynapseScoreSnapshot(synapsePreview.unitScores);
    const nextDeltas = buildSynapseDeltaMap(prevSynapseScoresRef.current, nextSnapshot);
    prevSynapseScoresRef.current = nextSnapshot;
    setSynapseDeltasByActorId(nextDeltas);
  }, [synapsePreview]);

  React.useEffect(() => {
    if (!isSynapseMode || synapseSelection.mode !== 'entity') return;
    const actorId = synapseSelection.actorId;
    const stillExists = actorId === gameState.player.id
      || gameState.enemies.some(enemy => enemy.id === actorId)
      || (gameState.companions || []).some(companion => companion.id === actorId);
    if (!stillExists) {
      onSynapseClearSelection();
    }
  }, [
    gameState.companions,
    gameState.enemies,
    gameState.player.id,
    isSynapseMode,
    onSynapseClearSelection,
    synapseSelection
  ]);

  React.useEffect(() => {
    if (!isSynapseMode || synapseSelection.mode !== 'tile' || !synapsePreview) return;
    const tile = synapseSelection.tile;
    const tileKey = pointToKey(tile);
    const exists = synapsePreview.tiles.some(entry =>
      entry.tile.q === tile.q && entry.tile.r === tile.r && entry.tile.s === tile.s
    );
    const occupiedByActor =
      pointToKey(gameState.player.position) === tileKey
      || gameState.enemies.some(enemy => enemy.hp > 0 && pointToKey(enemy.position) === tileKey)
      || (gameState.companions || []).some(companion => companion.hp > 0 && pointToKey(companion.position) === tileKey);
    if (!exists && !occupiedByActor) {
      onSynapseClearSelection();
    }
  }, [
    gameState.companions,
    gameState.enemies,
    gameState.player.position,
    isSynapseMode,
    onSynapseClearSelection,
    synapsePreview,
    synapseSelection
  ]);

  React.useLayoutEffect(() => {
    const boardSurface = boardSurfaceRef.current;
    if (!boardSurface || typeof ResizeObserver === 'undefined') return undefined;

    const measureInsets = () => {
      if (layoutMode !== 'desktop_command_center') {
        setCameraSafeInsetsPx((prev) => (
          (prev.top || 0) === 0
          && (prev.right || 0) === 0
          && (prev.bottom || 0) === 0
          && (prev.left || 0) === 0
        ) ? prev : {});
        return;
      }

      const boardRect = boardSurface.getBoundingClientRect();
      const nextInsets: CameraInsetsPx = { top: 0, right: 0, bottom: 0, left: 0 };
      const utilityRect = desktopUtilityRef.current?.getBoundingClientRect();
      if (utilityRect && utilityRect.width > 0 && utilityRect.height > 0) {
        nextInsets.top = Math.max(nextInsets.top, Math.max(0, utilityRect.bottom - boardRect.top) + 12);
        nextInsets.right = Math.max(nextInsets.right, Math.max(0, boardRect.right - utilityRect.left) + 12);
      }

      const trayRect = desktopSynapseTrayRef.current?.getBoundingClientRect();
      if (trayRect && trayRect.width > 0 && trayRect.height > 0) {
        nextInsets.bottom = Math.max(nextInsets.bottom, Math.max(0, boardRect.bottom - trayRect.top) + 16);
      }

      setCameraSafeInsetsPx((prev) => (
        (prev.top || 0) === nextInsets.top
        && (prev.right || 0) === nextInsets.right
        && (prev.bottom || 0) === nextInsets.bottom
        && (prev.left || 0) === nextInsets.left
      ) ? prev : nextInsets);
    };

    measureInsets();
    const observer = new ResizeObserver(measureInsets);
    observer.observe(boardSurface);
    if (desktopUtilityRef.current) observer.observe(desktopUtilityRef.current);
    if (desktopSynapseTrayRef.current) observer.observe(desktopSynapseTrayRef.current);
    window.addEventListener('resize', measureInsets);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureInsets);
    };
  }, [layoutMode, isSynapseMode, synapseSelection.mode]);

  return (
    <div
      data-layout-mode={layoutMode}
      className={`surface-app-material flex flex-col lg:flex-row w-screen h-screen bg-[var(--surface-app)] overflow-hidden text-[var(--text-primary)] font-[var(--font-body)] ${isSynapseMode ? 'synapse-vision-active' : ''}`}
    >
      <div
        className="surface-panel-material torn-edge-shell lg:hidden shrink-0 border-b border-[var(--border-subtle)] bg-[color:var(--surface-panel)] backdrop-blur-sm z-20"
        style={hudCssVars}
      >
        <div className="px-4 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0 text-left">
            <div className="uppercase tracking-[0.2em] text-[var(--text-muted)] font-bold" style={{ fontSize: 'var(--hud-label-font)' }}>Floor</div>
            <div className="font-black text-[var(--text-primary)] leading-none" style={{ fontSize: 'var(--hud-value-font)' }}>
              {gameState.floor}
              <span className="text-[var(--text-muted)] ml-1" style={{ fontSize: 'calc(var(--hud-value-font) * 0.64)' }}>/ 10</span>
            </div>
          </div>
          <div className="min-w-0 text-center">
            <div className="uppercase tracking-[0.2em] text-[var(--text-muted)] font-bold" style={{ fontSize: 'var(--hud-label-font)' }}>HP</div>
            <div className="font-black text-[var(--accent-danger)] leading-none" style={{ fontSize: 'var(--hud-value-font)' }}>
              {gameState.player.hp}
              <span className="text-[var(--text-muted)] ml-1" style={{ fontSize: 'calc(var(--hud-value-font) * 0.64)' }}>/ {gameState.player.maxHp}</span>
            </div>
            {mobileDockV2Enabled && hpProjectionDelta !== 0 && (
              <div
                className={`font-black uppercase tracking-[0.16em] ${hpProjectionDelta < 0 ? 'text-[var(--accent-danger)]' : 'text-emerald-600'}`}
                style={{ fontSize: 'var(--hud-label-font)' }}
              >
                {hpProjectionDelta > 0 ? '+' : ''}{hpProjectionDelta}{' -> '}{projectedHp}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button
              onClick={onToggleSynapseMode}
              style={hudActionButtonStyle}
              className={`px-3 rounded-lg border font-black uppercase tracking-[0.16em] transition-colors ${isSynapseMode
                ? 'bg-[var(--synapse-soft)] border-[var(--synapse-border)] text-[var(--synapse-text)]'
                : 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)] text-[var(--text-muted)] active:bg-[var(--surface-panel-hover)]'
              }`}
            >
              Info
            </button>
          </div>
        </div>
        <div className="px-4 pb-3">
          <UiTriResourceHeader gameState={gameState} compact mobile />
        </div>
        <div className="px-4 pb-2 flex justify-center">
          <EnemyAlertChip alerted={enemyAlertActive} />
        </div>
        {mobileDockV2Enabled && (
          <div className="px-4 pb-3 grid grid-cols-2 gap-1.5">
            <div
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2 py-1.5 font-black uppercase tracking-[0.16em] text-[var(--text-muted)]"
              style={{ fontSize: 'var(--hud-label-font)' }}
            >
              {waitLabel}: {isInputLocked ? 'Resolving' : 'Ready'}
            </div>
            <div
              className={`rounded-lg border px-2 py-1.5 font-black uppercase tracking-[0.16em] ${Math.abs(sigmaValue) >= 2 ? 'border-[var(--accent-danger)] text-[var(--accent-danger)] bg-[var(--accent-danger-soft)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)] bg-[var(--surface-panel-muted)]'}`}
              style={{ fontSize: 'var(--hud-label-font)' }}
            >
              Sigma {sigmaValue >= 0 ? '+' : ''}{sigmaValue.toFixed(1)}
            </div>
          </div>
        )}
      </div>

      <aside className="surface-panel-material torn-edge-shell hidden lg:flex w-96 border-r border-[var(--border-subtle)] bg-[var(--surface-panel)] flex-col z-20 overflow-y-auto">
        <div className="px-4 pt-4 pb-3 border-b border-[var(--border-subtle)]">
          <EnemyAlertChip alerted={enemyAlertActive} />
        </div>
        <div className="min-h-0 flex-1">
          <UI
            gameState={gameState}
            onReset={onReset}
            onWait={onWait}
            onExitToHub={onExitToHub}
            intelMode={intelMode}
            onIntelModeChange={handleIntelModeChange}
            showIntelControls={false}
            inputLocked={isInputLocked}
          />
        </div>
      </aside>

      <main
        data-board-theme={boardColorMode}
        className={`board-theme-shell surface-board-material flex-1 min-h-0 relative flex items-center justify-center bg-[var(--surface-board)] overflow-hidden ${dangerThreatActive ? 'grim-filter-active' : ''}`}
      >
        <div ref={desktopUtilityRef} className="hidden lg:flex absolute top-5 right-5 z-30 items-start gap-2.5">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
            <select
              aria-label="Theme"
              value={uiPreferences.colorMode}
              onChange={(event) => onSetColorMode(event.target.value as UiColorMode)}
              className="min-h-8 rounded border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]"
            >
              {UI_THEME_OPTIONS.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={onToggleSynapseMode}
            className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-[0.16em] transition-colors ${isSynapseMode
              ? 'bg-[var(--synapse-soft)] border-[var(--synapse-border)] text-[var(--synapse-text)]'
              : 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-panel-hover)]'
              }`}
          >
            Info (I)
          </button>
        </div>
        <div className="w-full h-full p-0 sm:p-3 lg:p-8 flex items-center justify-center">
          <div ref={boardSurfaceRef} className={`surface-panel-material torn-edge-shell w-full h-full relative border border-[var(--border-subtle)] bg-[color:var(--surface-panel)] rounded-none sm:rounded-3xl lg:rounded-[40px] shadow-[inset_0_0_100px_rgba(0,0,0,0.2)] flex items-center justify-center overflow-hidden ${gameState.isShaking ? 'animate-shake' : ''}`}>
            <GameBoard
              gameState={gameState}
              onMove={onTileClick}
              selectedSkillId={selectedSkillId}
              showMovementRange={showMovementRange}
              onBusyStateChange={onSetBoardBusy}
              assetManifest={assetManifest}
              onSimulationEvents={onSimulationEvents}
              onMirrorSnapshot={onMirrorSnapshot}
              isSynapseMode={isSynapseMode}
              synapseSelection={synapseSelection}
              synapsePulse={synapsePulse}
              synapseDeltasByActorId={synapseDeltasByActorId}
              onSynapseInspectEntity={onSynapseInspectEntity}
              cameraSafeInsetsPx={cameraSafeInsetsPx}
              visualEchoesEnabled={mobileDockV2Enabled}
            />
            {isSynapseMode && (
              <div ref={desktopSynapseTrayRef} className="hidden lg:block absolute bottom-3 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,34rem)] pointer-events-auto space-y-2">
                <SynapseBottomTray
                  gameState={gameState}
                  synapsePreview={synapsePreview}
                  synapseSelection={synapseSelection}
                  intelMode={intelMode}
                  deltasByActorId={synapseDeltasByActorId}
                  onSelectSource={onSynapseSelectSource}
                  onClearSelection={onSynapseClearSelection}
                  docked
                />
                <InfoSettingsPanel
                  compact
                />
              </div>
            )}
            {showWorldgenDebug && <WorldgenBoardOverlay gameState={gameState} />}
            {showWorldgenDebug && <WorldgenDebugPanel gameState={gameState} />}
            <ResolvingTurnOverlay visible={isInputLocked && gameState.gameStatus === 'playing'} />
          </div>
        </div>
      </main>

      <MobileToastsOverlay mobileToasts={gameState.gameStatus === 'playing' ? mobileToasts : []} />

      <aside
        className="surface-panel-material torn-edge-shell lg:hidden shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-panel)] z-20 overflow-y-auto"
        style={bottomDockStyle}
      >
        <div className={`${uiPreferences.hudDensity === 'compact' ? 'p-3 gap-3' : 'p-4 gap-4'} flex flex-col h-full`} style={hudCssVars}>
          {!isSynapseMode && !mobileDockV2Enabled && (
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-black uppercase tracking-[0.2em] text-[var(--text-muted)]" style={{ fontSize: 'var(--hud-label-font)' }}>
                Skills
              </h3>
              <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto">
                <button
                  disabled={isInputLocked}
                  onClick={onWait}
                  style={hudActionButtonStyle}
                  className={`w-full px-2 rounded-lg border font-black uppercase tracking-widest ${isInputLocked
                    ? 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-50'
                    : 'bg-[var(--surface-panel-hover)] border-[var(--border-subtle)] text-[var(--text-primary)] active:bg-[var(--surface-panel)]'
                    }`}
                >
                  {waitLabel}
                </button>
                <button
                  onClick={onExitToHub}
                  style={hudActionButtonStyle}
                  className="w-full px-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-hover)] font-black uppercase tracking-widest text-[var(--text-primary)] active:bg-[var(--surface-panel)]"
                >
                  Hub
                </button>
                <button
                  onClick={onReset}
                  style={hudActionButtonStyle}
                  className="w-full px-2 rounded-lg border border-[var(--accent-danger-border)] bg-[var(--accent-danger-soft)] font-black uppercase tracking-widest text-[var(--accent-danger)] active:opacity-90"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
          {!isSynapseMode && mobileDockV2Enabled && (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    disabled={isInputLocked}
                    onClick={onWait}
                    style={hudActionButtonStyle}
                    className={`px-2 rounded-lg border font-black uppercase tracking-widest ${isInputLocked
                      ? 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-50'
                      : 'bg-[var(--surface-panel-hover)] border-[var(--border-subtle)] text-[var(--text-primary)] active:bg-[var(--surface-panel)]'
                    }`}
                  >
                    {waitLabel}
                  </button>
                  <GuardedActionButton
                    disabled={false}
                    onConfirm={onExitToHub}
                    label="Hub"
                    style={hudActionButtonStyle}
                    className="px-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-hover)] font-black uppercase tracking-widest text-[var(--text-primary)]"
                  />
                  <GuardedActionButton
                    disabled={false}
                    onConfirm={onReset}
                    label="Reset"
                    style={hudActionButtonStyle}
                    className="px-2 rounded-lg border border-[var(--accent-danger-border)] bg-[var(--accent-danger-soft)] font-black uppercase tracking-widest text-[var(--accent-danger)]"
                  />
                </div>
                <div className="font-black uppercase tracking-[0.2em] text-[var(--text-muted)]" style={{ fontSize: 'var(--hud-label-font)' }}>
                  Skills
                </div>
              </div>
            </>
          )}
          {!isSynapseMode && (
            <SkillTray
              skills={gameState.player.activeSkills || []}
              selectedSkillId={selectedSkillId}
              onSelectSkill={onSelectSkill}
              hasSpear={gameState.hasSpear}
              gameState={gameState}
              inputLocked={isInputLocked}
              compact
            />
          )}
          {isSynapseMode && (
            <div className="space-y-2.5">
              <div className="font-black uppercase tracking-[0.2em] text-[var(--text-muted)]" style={{ fontSize: 'var(--hud-label-font)' }}>
                Info
              </div>
              <SynapseBottomTray
                gameState={gameState}
                synapsePreview={synapsePreview}
                synapseSelection={synapseSelection}
                intelMode={intelMode}
                deltasByActorId={synapseDeltasByActorId}
                onSelectSource={onSynapseSelectSource}
                onClearSelection={onSynapseClearSelection}
                docked
              />
              <InfoSettingsPanel
                compact
              />
            </div>
          )}
        </div>
      </aside>

      <aside className="surface-panel-material torn-edge-shell hidden lg:flex w-72 border-l border-[var(--border-subtle)] bg-[var(--surface-panel)] flex-col z-20 overflow-y-auto">
        <div className="p-6 flex flex-col gap-8 h-full">
          <div className="flex-1">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-6">Tactical Skills</h3>
            <SkillTray
              skills={gameState.player.activeSkills || []}
              selectedSkillId={selectedSkillId}
              onSelectSkill={onSelectSkill}
              hasSpear={gameState.hasSpear}
              gameState={gameState}
              inputLocked={isInputLocked}
            />
          </div>

          <div className="pt-8 border-t border-[var(--border-subtle)] text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Hop Engine v5.0
            </div>
          </div>
        </div>
      </aside>

      <TutorialInstructionsOverlay
        tutorialInstructions={tutorialInstructions}
        onDismiss={onDismissTutorial}
      />

      {gameState.gameStatus === 'choosing_upgrade' && (
        <UpgradeOverlay onSelect={onSelectUpgrade} gameState={gameState} />
      )}
      <RunLostOverlay
        visible={gameState.gameStatus === 'lost'}
        onQuickRestart={onQuickRestart}
        onViewReplay={onViewReplay}
        onActionsReady={onRunLostActionsReady}
      />
      <RunWonOverlay visible={gameState.gameStatus === 'won'} score={gameState.completedRun?.score || 0} onExitToHub={onExitToHub} />

      <FloorIntroOverlay floorIntro={floorIntro} />

      <ReplayControlsOverlay
        isReplayMode={isReplayMode}
        replayIndex={replayIndex}
        replayLength={replayActionsLength}
        replayActive={replayActive}
        onToggleReplay={onToggleReplay}
        onStepReplay={onStepReplay}
        onJumpReplay={replayChronicleEnabled ? onJumpReplay : undefined}
        markerIndices={replayChronicleEnabled ? replayMarkerIndices : undefined}
        onCloseReplay={onCloseReplay}
      />
    </div>
  );
};
