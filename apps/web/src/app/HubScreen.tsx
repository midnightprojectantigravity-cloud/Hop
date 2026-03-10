import type { GameState, GridSize, Loadout, MapShape } from '@hop/engine';
import type { ReplayRecord } from '../components/ReplayManager';
import { Hub } from '../components/Hub';
import { ArcadeHub } from '../components/ArcadeHub';
import { ReplayErrorOverlay, TutorialInstructionsOverlay } from './AppOverlays';
import {
  UI_THEME_OPTIONS,
  type UiColorMode,
  type UiHudDensity,
  type UiMotionMode,
  type UiPreferencesV1
} from './ui-preferences';

interface HubScreenProps {
  gameState: GameState;
  isArcadeRoute: boolean;
  hubPath: string;
  arcadePath: string;
  biomesPath: string;
  themeLabPath: string;
  settingsPath: string;
  leaderboardPath: string;
  tutorialsPath: string;
  replayError: string | null;
  tutorialInstructions: string | null;
  uiPreferences: UiPreferencesV1;
  dedicatedRoutesEnabled: boolean;
  navigateTo: (path: string) => void;
  onSetColorMode: (mode: UiColorMode) => void;
  onSetMotionMode: (mode: UiMotionMode) => void;
  onSetHudDensity: (density: UiHudDensity) => void;
  onStartArcadeRun: (loadoutId: string) => void;
  capabilityPassivesEnabled: boolean;
  onCapabilityPassivesEnabledChange: (enabled: boolean) => void;
  movementRuntimeEnabled: boolean;
  onMovementRuntimeEnabledChange: (enabled: boolean) => void;
  mapShape: MapShape;
  onMapShapeChange: (shape: MapShape) => void;
  mapSize: GridSize;
  onMapSizeChange: (size: GridSize) => void;
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
  themeLabPath,
  settingsPath,
  leaderboardPath,
  tutorialsPath,
  replayError,
  tutorialInstructions,
  uiPreferences,
  dedicatedRoutesEnabled,
  navigateTo,
  onSetColorMode,
  onSetMotionMode,
  onSetHudDensity,
  onStartArcadeRun,
  capabilityPassivesEnabled,
  onCapabilityPassivesEnabledChange,
  movementRuntimeEnabled,
  onMovementRuntimeEnabledChange,
  mapShape,
  onMapShapeChange,
  mapSize,
  onMapSizeChange,
  onSelectLoadout,
  onStartRun,
  onLoadScenario,
  onStartReplay,
  onDismissTutorial,
}: HubScreenProps) => {
  return (
    <div className="surface-app-material w-screen h-screen bg-[var(--surface-app)] overflow-hidden text-[var(--text-primary)] font-[var(--font-body)] relative">
      <div className="absolute top-4 left-4 z-40 hidden sm:flex flex-wrap gap-2 max-w-[min(92vw,40rem)]">
        <div className="surface-panel-material torn-edge-shell flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
          <span className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Theme</span>
          <select
            aria-label="Theme"
            value={uiPreferences.colorMode}
            onChange={(event) => onSetColorMode(event.target.value as UiColorMode)}
            className="min-h-8 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]"
          >
            {UI_THEME_OPTIONS.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.label}
              </option>
            ))}
          </select>
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
      <div className="surface-panel-material torn-edge-shell absolute top-4 left-4 z-40 sm:hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2.5 py-2">
        <select
          aria-label="Theme"
          value={uiPreferences.colorMode}
          onChange={(event) => onSetColorMode(event.target.value as UiColorMode)}
          className="min-h-8 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]"
        >
          {UI_THEME_OPTIONS.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.label}
            </option>
          ))}
        </select>
      </div>
      {!isArcadeRoute && (
        <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigateTo(themeLabPath)}
            className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] hover:bg-[var(--surface-panel-hover)] text-[10px] font-black uppercase tracking-[0.2em]"
          >
            Theme Lab
          </button>
          <button
            type="button"
            onClick={() => navigateTo(biomesPath)}
            className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--accent-royal-soft)] hover:bg-[var(--accent-royal-soft-hover)] text-[10px] font-black uppercase tracking-[0.2em]"
          >
            Biome Sandbox
          </button>
        </div>
      )}
      {isArcadeRoute ? (
        <ArcadeHub
          onBack={() => navigateTo(hubPath)}
          onLaunchArcade={onStartArcadeRun}
          twoStepSelection
        />
      ) : (
        <Hub
          gameState={gameState}
          capabilityPassivesEnabled={capabilityPassivesEnabled}
          onCapabilityPassivesEnabledChange={onCapabilityPassivesEnabledChange}
          movementRuntimeEnabled={movementRuntimeEnabled}
          onMovementRuntimeEnabledChange={onMovementRuntimeEnabledChange}
          mapShape={mapShape}
          onMapShapeChange={onMapShapeChange}
          mapSize={mapSize}
          onMapSizeChange={onMapSizeChange}
          onSelectLoadout={onSelectLoadout}
          onStartRun={onStartRun}
          onOpenArcade={() => navigateTo(arcadePath)}
          onOpenSettings={dedicatedRoutesEnabled ? (() => navigateTo(settingsPath)) : undefined}
          onOpenLeaderboard={dedicatedRoutesEnabled ? (() => navigateTo(leaderboardPath)) : undefined}
          onOpenTutorials={dedicatedRoutesEnabled ? (() => navigateTo(tutorialsPath)) : undefined}
          onLoadScenario={onLoadScenario}
          onStartReplay={onStartReplay}
          dedicatedRoutesEnabled={dedicatedRoutesEnabled}
          hubTrainingOnly={dedicatedRoutesEnabled}
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
