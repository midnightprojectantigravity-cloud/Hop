import type { GameState, Point, SimulationEvent, StateMirrorSnapshot } from '@hop/engine';
import React from 'react';
import { GameBoard } from '../components/GameBoard';
import { UI } from '../components/UI';
import { UpgradeOverlay } from '../components/UpgradeOverlay';
import { SkillTray } from '../components/SkillTray';
import { SynapseBottomTray } from '../components/synapse/SynapseBottomTray';
import type { VisualAssetManifest } from '../visual/asset-manifest';
import type { UiColorMode, UiPreferencesV1 } from './ui-preferences';
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

type MobileToast = {
  id: string;
  text: string;
  tone: 'damage' | 'heal' | 'status' | 'system';
  createdAt: number;
};

type FloorIntroState = { floor: number; theme: string } | null;

interface IntelModeToggleProps {
  mode: UiInformationRevealMode;
  onChange: (mode: UiInformationRevealMode) => void;
  compact?: boolean;
}

const IntelModeToggle = ({ mode, onChange, compact = false }: IntelModeToggleProps) => (
  <div className={`rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] ${compact ? 'p-1.5' : 'p-2'} flex flex-col gap-1.5`}>
    <span className={`text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] ${compact ? 'text-[9px]' : ''}`}>Intel</span>
    <div className="grid grid-cols-2 gap-1.5">
      <button
        onClick={() => onChange('force_reveal')}
        className={`${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} rounded border text-[10px] font-black uppercase tracking-widest transition-colors ${
          mode === 'force_reveal'
            ? 'bg-[var(--accent-brass-soft)] border-[var(--accent-brass)] text-[var(--text-primary)]'
            : 'bg-[var(--surface-panel)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-panel-hover)]'
        }`}
      >
        Force
      </button>
      <button
        onClick={() => onChange('strict')}
        className={`${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} rounded border text-[10px] font-black uppercase tracking-widest transition-colors ${
          mode === 'strict'
            ? 'bg-[var(--accent-danger-soft)] border-[var(--accent-danger)] text-[var(--accent-danger)]'
            : 'bg-[var(--surface-panel)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-panel-hover)]'
        }`}
      >
        Strict
      </button>
    </div>
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
  onCloseReplay: () => void;
  onQuickRestart: () => void;
  onViewReplay: () => void;
  onSetColorMode: (mode: UiColorMode) => void;
}

export const resolveLayoutMode = (
  width: number,
  height: number
): 'mobile_portrait' | 'tablet' | 'desktop_command_center' => {
  if (width >= 1200) return 'desktop_command_center';
  if (width >= 768) return 'tablet';
  if (height > width) return 'mobile_portrait';
  return 'tablet';
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
  onCloseReplay,
  onQuickRestart,
  onViewReplay,
  onSetColorMode,
}: GameScreenProps) => {
  const [intelMode, setIntelMode] = React.useState<UiInformationRevealMode>(() => getUiInformationRevealMode());
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
    const syncLayoutMode = () => {
      setLayoutMode(resolveLayoutMode(window.innerWidth, window.innerHeight));
    };
    window.addEventListener('resize', syncLayoutMode);
    syncLayoutMode();
    return () => window.removeEventListener('resize', syncLayoutMode);
  }, []);
  const handleIntelModeChange = React.useCallback((mode: UiInformationRevealMode) => {
    setIntelMode(mode);
    setUiInformationRevealMode(mode);
  }, []);
  const synapsePreview = React.useMemo(
    () => resolveSynapsePreview(gameState.intentPreview),
    [gameState.intentPreview]
  );
  const [synapseDeltasByActorId, setSynapseDeltasByActorId] = React.useState<Record<string, SynapseDeltaEntry>>({});
  const prevSynapseScoresRef = React.useRef<ReturnType<typeof buildSynapseScoreSnapshot> | null>(null);

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
    const exists = synapsePreview.tiles.some(entry =>
      entry.tile.q === tile.q && entry.tile.r === tile.r && entry.tile.s === tile.s
    );
    if (!exists) {
      onSynapseClearSelection();
    }
  }, [isSynapseMode, onSynapseClearSelection, synapsePreview, synapseSelection]);

  return (
    <div
      data-layout-mode={layoutMode}
      className={`flex flex-col lg:flex-row w-screen h-screen bg-[var(--surface-app)] overflow-hidden text-[var(--text-primary)] font-[var(--font-body)] ${isSynapseMode ? 'synapse-vision-active' : ''}`}
    >
      <div className="lg:hidden shrink-0 border-b border-[var(--border-subtle)] bg-[color:var(--surface-panel)] backdrop-blur-sm z-20">
        <div className="px-4 py-3 grid grid-cols-2 items-center gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-bold">Floor</div>
            <div className="text-lg font-black text-[var(--text-primary)] leading-none">
              {gameState.floor}
              <span className="text-[var(--text-muted)] text-sm ml-1">/ 10</span>
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-bold">HP</div>
            <div className="text-lg font-black text-[var(--accent-danger)] leading-none">
              {gameState.player.hp}
              <span className="text-[var(--text-muted)] text-sm ml-1">/ {gameState.player.maxHp}</span>
            </div>
          </div>
          <IntelModeToggle mode={intelMode} onChange={handleIntelModeChange} compact />
          <button
            onClick={onToggleSynapseMode}
            className={`h-full rounded-lg border text-[10px] font-black uppercase tracking-[0.16em] transition-colors ${isSynapseMode
              ? 'bg-[var(--synapse-soft)] border-[var(--synapse-border)] text-[var(--synapse-text)]'
              : 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)] text-[var(--text-muted)] active:bg-[var(--surface-panel-hover)]'
              }`}
          >
            Synapse
          </button>
        </div>
      </div>

      <aside className="hidden lg:flex w-80 border-r border-[var(--border-subtle)] bg-[var(--surface-panel)] flex-col z-20 overflow-y-auto">
        <UI
          gameState={gameState}
          onReset={onReset}
          onWait={onWait}
          onExitToHub={onExitToHub}
          intelMode={intelMode}
          onIntelModeChange={handleIntelModeChange}
          inputLocked={isInputLocked}
        />
      </aside>

      <main className="flex-1 min-h-0 relative flex items-center justify-center bg-[var(--surface-board)] overflow-hidden">
        <div className="hidden lg:flex absolute top-5 right-5 z-30 items-start gap-2.5">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-1">
            <button
              onClick={() => onSetColorMode(uiPreferences.colorMode === 'light' ? 'dark' : 'light')}
              className="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {uiPreferences.colorMode === 'light' ? 'Dark' : 'Light'}
            </button>
          </div>
          <IntelModeToggle mode={intelMode} onChange={handleIntelModeChange} />
          <button
            onClick={onToggleSynapseMode}
            className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-[0.16em] transition-colors ${isSynapseMode
              ? 'bg-[var(--synapse-soft)] border-[var(--synapse-border)] text-[var(--synapse-text)]'
              : 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-panel-hover)]'
              }`}
          >
            Synapse (I)
          </button>
        </div>
        <div className="w-full h-full p-0 sm:p-3 lg:p-8 flex items-center justify-center">
          <div className={`w-full h-full relative border border-[var(--border-subtle)] bg-[color:var(--surface-panel)] rounded-none sm:rounded-3xl lg:rounded-[40px] shadow-[inset_0_0_100px_rgba(0,0,0,0.2)] flex items-center justify-center overflow-hidden ${gameState.isShaking ? 'animate-shake' : ''}`}>
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
            />
            {isSynapseMode && (
              <div className="hidden lg:block">
                <SynapseBottomTray
                  gameState={gameState}
                  synapsePreview={synapsePreview}
                  synapseSelection={synapseSelection}
                  intelMode={intelMode}
                  deltasByActorId={synapseDeltasByActorId}
                  onSelectSource={onSynapseSelectSource}
                  onClearSelection={onSynapseClearSelection}
                />
              </div>
            )}
            <ResolvingTurnOverlay visible={isInputLocked && gameState.gameStatus === 'playing'} />
          </div>
        </div>
      </main>

      <MobileToastsOverlay mobileToasts={gameState.gameStatus === 'playing' ? mobileToasts : []} />

      <aside className="lg:hidden shrink-0 h-[25svh] min-h-[176px] max-h-[280px] border-t border-[var(--border-subtle)] bg-[var(--surface-panel)] z-20 overflow-y-auto">
        <div className={`${uiPreferences.hudDensity === 'compact' ? 'p-3 gap-3' : 'p-4 gap-4'} flex flex-col h-full`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {isSynapseMode ? 'Synapse' : 'Skills'}
            </h3>
            <div className="grid grid-cols-4 gap-1.5 w-full sm:w-auto">
              <button
                disabled={isInputLocked}
                onClick={onWait}
                className={`w-full px-2 min-h-11 rounded-lg border text-[10px] font-black uppercase tracking-widest ${isInputLocked
                  ? 'bg-[var(--surface-panel-muted)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-50'
                  : 'bg-[var(--surface-panel-hover)] border-[var(--border-subtle)] text-[var(--text-primary)] active:bg-[var(--surface-panel)]'
                  }`}
              >
                Wait
              </button>
              <button
                onClick={onToggleSynapseMode}
                className={`w-full px-2 min-h-11 rounded-lg border text-[10px] font-black uppercase tracking-widest ${isSynapseMode
                  ? 'bg-[var(--synapse-soft)] border-[var(--synapse-border)] text-[var(--synapse-text)]'
                  : 'border-[var(--synapse-border)] bg-[var(--synapse-soft)] text-[var(--synapse-text)] active:opacity-90'
                  }`}
              >
                Synapse
              </button>
              <button
                onClick={onExitToHub}
                className="w-full px-2 min-h-11 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-hover)] text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)] active:bg-[var(--surface-panel)]"
              >
                Hub
              </button>
              <button
                onClick={onReset}
                className="w-full px-2 min-h-11 rounded-lg border border-[var(--accent-danger-border)] bg-[var(--accent-danger-soft)] text-[10px] font-black uppercase tracking-widest text-[var(--accent-danger)] active:opacity-90"
              >
                Reset
              </button>
            </div>
          </div>
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
          )}
        </div>
      </aside>

      <aside className="hidden lg:flex w-80 border-l border-[var(--border-subtle)] bg-[var(--surface-panel)] flex-col z-20 overflow-y-auto">
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
        onCloseReplay={onCloseReplay}
      />
    </div>
  );
};

