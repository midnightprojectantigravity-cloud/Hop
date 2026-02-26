import type { GameState, Point, SimulationEvent, StateMirrorSnapshot } from '@hop/engine';
import { GameBoard } from '../components/GameBoard';
import { UI } from '../components/UI';
import { UpgradeOverlay } from '../components/UpgradeOverlay';
import { SkillTray } from '../components/SkillTray';
import type { VisualAssetManifest } from '../visual/asset-manifest';
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
  onSetBoardBusy: (busy: boolean) => void;
  onTileClick: (hex: Point) => void;
  onSimulationEvents?: (events: SimulationEvent[]) => void;
  onMirrorSnapshot?: (snapshot: StateMirrorSnapshot) => void;
  onReset: () => void;
  onWait: () => void;
  onExitToHub: () => void;
  onSelectSkill: (skillId: string | null) => void;
  onSelectUpgrade: (upgradeId: string) => void;
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
  onSetBoardBusy,
  onTileClick,
  onSimulationEvents,
  onMirrorSnapshot,
  onReset,
  onWait,
  onExitToHub,
  onSelectSkill,
  onSelectUpgrade,
  onDismissTutorial,
  onToggleReplay,
  onStepReplay,
  onCloseReplay,
}: GameScreenProps) => {
  return (
    <div className="flex flex-col lg:flex-row w-screen h-screen bg-[#030712] overflow-hidden text-white font-['Inter',_sans-serif]">
      <div className="lg:hidden shrink-0 border-b border-white/5 bg-[#030712]/95 backdrop-blur-sm z-20">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35 font-bold">Level</div>
            <div className="text-lg font-black text-white leading-none">
              {gameState.floor}
              <span className="text-white/25 text-sm ml-1">/ 10</span>
            </div>
          </div>
          <div className="ml-auto min-w-0 text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35 font-bold">HP</div>
            <div className="text-lg font-black text-red-400 leading-none">
              {gameState.player.hp}
              <span className="text-white/25 text-sm ml-1">/ {gameState.player.maxHp}</span>
            </div>
          </div>
        </div>
      </div>

      <aside className="hidden lg:flex w-80 border-r border-white/5 bg-[#030712] flex-col z-20 overflow-y-auto">
        <UI
          gameState={gameState}
          onReset={onReset}
          onWait={onWait}
          onExitToHub={onExitToHub}
          inputLocked={isInputLocked}
        />
      </aside>

      <main className="flex-1 min-h-0 relative flex items-center justify-center bg-[#020617] overflow-hidden">
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
            />
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
