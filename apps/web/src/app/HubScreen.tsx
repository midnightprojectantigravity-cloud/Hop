import type { GameState, Loadout } from '@hop/engine';
import type { ReplayRecord } from '../components/ReplayManager';
import { Hub } from '../components/Hub';
import { ArcadeHub } from '../components/ArcadeHub';
import { ReplayErrorOverlay, TutorialInstructionsOverlay } from './AppOverlays';
import type { UiColorMode, UiHudDensity, UiMotionMode, UiPreferencesV1 } from './ui-preferences';

interface HubScreenProps {
  gameState: GameState;
  isArcadeRoute: boolean;
  hubPath: string;
  arcadePath: string;
  biomesPath: string;
  replayError: string | null;
  tutorialInstructions: string | null;
  uiPreferences: UiPreferencesV1;
  navigateTo: (path: string) => void;
  onSetColorMode: (mode: UiColorMode) => void;
  onSetMotionMode: (mode: UiMotionMode) => void;
  onSetHudDensity: (density: UiHudDensity) => void;
  onStartArcadeRun: (loadoutId: string) => void;
  capabilityPassivesEnabled: boolean;
  onCapabilityPassivesEnabledChange: (enabled: boolean) => void;
  movementRuntimeEnabled: boolean;
  onMovementRuntimeEnabledChange: (enabled: boolean) => void;
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
  uiPreferences,
  navigateTo,
  onSetColorMode,
  onSetMotionMode,
  onSetHudDensity,
  onStartArcadeRun,
  capabilityPassivesEnabled,
  onCapabilityPassivesEnabledChange,
  movementRuntimeEnabled,
  onMovementRuntimeEnabledChange,
  onSelectLoadout,
  onStartRun,
  onLoadScenario,
  onStartReplay,
  onDismissTutorial,
}: HubScreenProps) => {
  return (
    <div className="w-screen h-screen bg-[var(--surface-app)] overflow-hidden text-[var(--text-primary)] font-[var(--font-body)] relative">
      <div className="absolute top-4 left-4 z-40 hidden sm:flex flex-wrap gap-2 max-w-[min(92vw,40rem)]">
        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
          <button
            type="button"
            onClick={() => onSetColorMode('light')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${
              uiPreferences.colorMode === 'light'
                ? 'bg-[var(--accent-brass-soft)] border-[var(--accent-brass)] text-[var(--text-primary)]'
                : 'bg-transparent border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Light
          </button>
          <button
            type="button"
            onClick={() => onSetColorMode('dark')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${
              uiPreferences.colorMode === 'dark'
                ? 'bg-[var(--accent-danger-soft)] border-[var(--accent-danger)] text-[var(--text-primary)]'
                : 'bg-transparent border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Dark
          </button>
        </div>
        <button
          type="button"
          onClick={() => onSetMotionMode(uiPreferences.motionMode === 'snappy' ? 'reduced' : 'snappy')}
          className="px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          {uiPreferences.motionMode === 'snappy' ? 'Snappy' : 'Reduced'}
        </button>
        <button
          type="button"
          onClick={() => onSetHudDensity(uiPreferences.hudDensity === 'compact' ? 'comfortable' : 'compact')}
          className="px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          {uiPreferences.hudDensity === 'compact' ? 'Compact HUD' : 'Comfort HUD'}
        </button>
      </div>
      <button
        type="button"
        onClick={() => onSetColorMode(uiPreferences.colorMode === 'light' ? 'dark' : 'light')}
        className="absolute top-4 left-4 z-40 sm:hidden px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]"
      >
        {uiPreferences.colorMode === 'light' ? 'Dark' : 'Light'}
      </button>
      {!isArcadeRoute && (
        <button
          type="button"
          onClick={() => navigateTo(biomesPath)}
          className="absolute top-4 right-4 z-40 px-4 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--accent-royal-soft)] hover:bg-[var(--accent-royal-soft-hover)] text-[10px] font-black uppercase tracking-[0.2em]"
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
          capabilityPassivesEnabled={capabilityPassivesEnabled}
          onCapabilityPassivesEnabledChange={onCapabilityPassivesEnabledChange}
          movementRuntimeEnabled={movementRuntimeEnabled}
          onMovementRuntimeEnabledChange={onMovementRuntimeEnabledChange}
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
