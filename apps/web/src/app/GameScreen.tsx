import type { GameState, Point, SimulationEvent, StateMirrorSnapshot } from '@hop/engine';
import React from 'react';
import { GameBoard } from '../components/GameBoard';
import { UI } from '../components/UI';
import { UpgradeOverlay } from '../components/UpgradeOverlay';
import { SkillTray } from '../components/SkillTray';
import { SynapseBottomTray } from '../components/synapse/SynapseBottomTray';
import type { VisualAssetManifest } from '../visual/asset-manifest';
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
  <div className={`rounded-lg border border-white/10 bg-white/[0.03] ${compact ? 'p-1.5' : 'p-2'} flex flex-col gap-1.5`}>
    <span className={`text-[10px] font-bold uppercase tracking-widest text-white/45 ${compact ? 'text-[9px]' : ''}`}>Intel</span>
    <div className="grid grid-cols-2 gap-1.5">
      <button
        onClick={() => onChange('force_reveal')}
        className={`${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} rounded border text-[10px] font-black uppercase tracking-widest transition-colors ${
          mode === 'force_reveal'
            ? 'bg-emerald-400/15 border-emerald-300/40 text-emerald-200'
            : 'bg-white/[0.03] border-white/10 text-white/55 hover:bg-white/[0.06]'
        }`}
      >
        Force
      </button>
      <button
        onClick={() => onChange('strict')}
        className={`${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} rounded border text-[10px] font-black uppercase tracking-widest transition-colors ${
          mode === 'strict'
            ? 'bg-amber-400/15 border-amber-300/40 text-amber-200'
            : 'bg-white/[0.03] border-white/10 text-white/55 hover:bg-white/[0.06]'
        }`}
      >
        Strict
      </button>
    </div>
  </div>
);

interface GameScreenProps {
  gameState: GameState;
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
}

export const GameScreen = ({
  gameState,
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
}: GameScreenProps) => {
  const [intelMode, setIntelMode] = React.useState<UiInformationRevealMode>(() => getUiInformationRevealMode());
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
    <div className="flex flex-col lg:flex-row w-screen h-screen bg-[#030712] overflow-hidden text-white font-['Inter',_sans-serif]">
      <div className="lg:hidden shrink-0 border-b border-white/5 bg-[#030712]/95 backdrop-blur-sm z-20">
        <div className="px-4 py-3 grid grid-cols-4 items-center gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35 font-bold">Level</div>
            <div className="text-lg font-black text-white leading-none">
              {gameState.floor}
              <span className="text-white/25 text-sm ml-1">/ 10</span>
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35 font-bold">HP</div>
            <div className="text-lg font-black text-red-400 leading-none">
              {gameState.player.hp}
              <span className="text-white/25 text-sm ml-1">/ {gameState.player.maxHp}</span>
            </div>
          </div>
          <IntelModeToggle mode={intelMode} onChange={handleIntelModeChange} compact />
          <button
            onClick={onToggleSynapseMode}
            className={`h-full rounded-lg border text-[10px] font-black uppercase tracking-[0.16em] transition-colors ${isSynapseMode
              ? 'bg-cyan-400/18 border-cyan-300/45 text-cyan-100'
              : 'bg-white/[0.03] border-white/12 text-white/60 active:bg-white/[0.08]'
              }`}
          >
            Synapse
          </button>
        </div>
      </div>

      <aside className="hidden lg:flex w-80 border-r border-white/5 bg-[#030712] flex-col z-20 overflow-y-auto">
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

      <main className="flex-1 min-h-0 relative flex items-center justify-center bg-[#020617] overflow-hidden">
        <div className="hidden lg:flex absolute top-5 right-5 z-30 items-start gap-2.5">
          <IntelModeToggle mode={intelMode} onChange={handleIntelModeChange} />
          <button
            onClick={onToggleSynapseMode}
            className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-[0.16em] transition-colors ${isSynapseMode
              ? 'bg-cyan-400/18 border-cyan-300/45 text-cyan-100'
              : 'bg-white/[0.03] border-white/12 text-white/60 hover:bg-white/[0.08]'
              }`}
          >
            Synapse (I)
          </button>
        </div>
        <div className="w-full h-full p-0 sm:p-3 lg:p-8 flex items-center justify-center">
          <div className={`w-full h-full relative border border-white/5 bg-[#030712]/50 rounded-none sm:rounded-3xl lg:rounded-[40px] shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden ${gameState.isShaking ? 'animate-shake' : ''}`}>
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
              <SynapseBottomTray
                gameState={gameState}
                synapsePreview={synapsePreview}
                synapseSelection={synapseSelection}
                intelMode={intelMode}
                deltasByActorId={synapseDeltasByActorId}
                onSelectSource={onSynapseSelectSource}
                onClearSelection={onSynapseClearSelection}
              />
            )}
            <ResolvingTurnOverlay visible={isInputLocked && gameState.gameStatus === 'playing'} />
          </div>
        </div>
      </main>

      <MobileToastsOverlay mobileToasts={gameState.gameStatus === 'playing' ? mobileToasts : []} />

      <aside className="lg:hidden shrink-0 h-[26svh] min-h-[160px] max-h-[250px] border-t border-white/5 bg-[#030712] z-20 overflow-y-auto">
        <div className="p-3 flex flex-col gap-3 h-full">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Skills</h3>
            <div className="flex items-center gap-1.5">
              <button
                disabled={isInputLocked}
                onClick={onWait}
                className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${isInputLocked
                  ? 'bg-white/[0.03] border-white/5 text-white/30 opacity-50'
                  : 'bg-white/5 border-white/10 text-white/70 active:bg-white/10'
                  }`}
              >
                Wait
              </button>
              <button
                onClick={onToggleSynapseMode}
                className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${isSynapseMode
                  ? 'bg-cyan-400/18 border-cyan-300/45 text-cyan-100'
                  : 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200/80 active:bg-cyan-500/20'
                  }`}
              >
                Synapse
              </button>
              <button
                onClick={onExitToHub}
                className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/70 active:bg-white/10"
              >
                Hub
              </button>
              <button
                onClick={onReset}
                className="px-2.5 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-[10px] font-black uppercase tracking-widest text-red-300/90 active:bg-red-500/20"
              >
                Reset
              </button>
            </div>
          </div>
          <SkillTray
            skills={gameState.player.activeSkills || []}
            selectedSkillId={selectedSkillId}
            onSelectSkill={onSelectSkill}
            hasSpear={gameState.hasSpear}
            gameState={gameState}
            inputLocked={isInputLocked}
            compact
          />
        </div>
      </aside>

      <aside className="hidden lg:flex w-80 border-l border-white/5 bg-[#030712] flex-col z-20 overflow-y-auto">
        <div className="p-6 flex flex-col gap-8 h-full">
          <div className="flex-1">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-6">Tactical Skills</h3>
            <SkillTray
              skills={gameState.player.activeSkills || []}
              selectedSkillId={selectedSkillId}
              onSelectSkill={onSelectSkill}
              hasSpear={gameState.hasSpear}
              gameState={gameState}
              inputLocked={isInputLocked}
            />
          </div>

          <div className="pt-8 border-t border-white/5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/20">
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
      <RunLostOverlay visible={gameState.gameStatus === 'lost'} onReset={onReset} />
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
