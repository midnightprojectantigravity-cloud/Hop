import type { GameState, Loadout } from '@hop/engine';
import type { ReplayRecord } from '../components/ReplayManager';
import { Hub } from '../components/Hub';
import { ArcadeHub } from '../components/ArcadeHub';
import { ReplayErrorOverlay, TutorialInstructionsOverlay } from './AppOverlays';

interface HubScreenProps {
  gameState: GameState;
  isArcadeRoute: boolean;
  hubPath: string;
  arcadePath: string;
  biomesPath: string;
  replayError: string | null;
  tutorialInstructions: string | null;
  navigateTo: (path: string) => void;
  onStartArcadeRun: (loadoutId: string) => void;
  onSelectLoadout: (loadout: Loadout) => void;
  onStartRun: (mode: 'normal' | 'daily') => void;
  onLoadScenario: (state: GameState, instructions: string) => void;
  onStartReplay: (record: ReplayRecord) => void;
  onDismissTutorial: () => void;
}

export const HubScreen = ({
  gameState,
  isArcadeRoute,
  hubPath,
  arcadePath,
  biomesPath,
  replayError,
  tutorialInstructions,
  navigateTo,
  onStartArcadeRun,
  onSelectLoadout,
  onStartRun,
  onLoadScenario,
  onStartReplay,
  onDismissTutorial,
}: HubScreenProps) => {
  return (
    <div className="w-screen h-screen bg-[#030712] overflow-hidden text-white font-['Inter',_sans-serif]">
      {!isArcadeRoute && (
        <button
          type="button"
          onClick={() => navigateTo(biomesPath)}
          className="absolute top-4 right-4 z-40 px-4 py-2 rounded-xl border border-cyan-300/35 bg-cyan-500/10 hover:bg-cyan-500/20 text-[10px] font-black uppercase tracking-[0.2em]"
        >
          Biome Sandbox
        </button>
      )}
      {isArcadeRoute ? (
        <ArcadeHub
          onBack={() => navigateTo(hubPath)}
          onLaunchArcade={onStartArcadeRun}
        />
      ) : (
        <Hub
          gameState={gameState}
          onSelectLoadout={onSelectLoadout}
          onStartRun={onStartRun}
          onOpenArcade={() => navigateTo(arcadePath)}
          onLoadScenario={onLoadScenario}
          onStartReplay={onStartReplay}
        />
      )}
      <ReplayErrorOverlay replayError={replayError} />
      <TutorialInstructionsOverlay
        tutorialInstructions={tutorialInstructions}
        onDismiss={onDismissTutorial}
      />
    </div>
  );
};
