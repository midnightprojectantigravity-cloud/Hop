import { Suspense } from 'react';
import type { GameState, GridSize, Loadout, MapShape } from '@hop/engine';
import type { UiPreferencesV2 } from './ui-preferences';
import type { TutorialProgress, TutorialSession } from './tutorial/tutorial-state-machine';
import { shouldPromptForTutorial } from './tutorial/tutorial-state-machine';
import { TutorialOnboardingPrompt } from './tutorial/tutorial-step-overlay';
import {
  LazyHubScreen,
  LazyLeaderboardScreen,
  LazySettingsScreen,
  LazyTutorialReplayScreen
} from './lazy-screens';
import { ScreenTransitionShell } from './screen-transition-shell';
import { AppScreenFallback, ArcadeSplashGate, WorldgenErrorOverlay, type WorldgenUiError } from './route-shell-shared';

export const HubRouteShell = ({
  gameState,
  homePath,
  isArcadeRoute,
  isHubRoute,
  isSettingsRoute,
  isLeaderboardRoute,
  isTutorialsRoute,
  hubPath,
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
  patchUiPreferences,
  mapShape,
  onMapShapeChange,
  mapSize,
  onMapSizeChange,
  onSelectLoadout,
  onStartRun,
  onLoadScenario,
  onStartReplay,
  onDismissTutorial,
  onStartGuidedTutorial,
  tutorialProgress,
  activeTutorialSession,
  onResetTutorialProgress,
  onSkipTutorial,
  worldgenUiError,
  worldgenProgressLabel,
  worldgenStatusLine,
  onDismissWorldgenError,
  worldgenInitialized,
  worldgenWarmState,
  arcadeSplashWaitingForReady,
  showArcadeDelayedPulse,
  onEnterArcadeSplash,
  onOpenHubFromArcadeSplash
}: {
  gameState: GameState;
  homePath: string;
  isArcadeRoute: boolean;
  isHubRoute: boolean;
  isSettingsRoute: boolean;
  isLeaderboardRoute: boolean;
  isTutorialsRoute: boolean;
  hubPath: string;
  biomesPath: string;
  themeLabPath: string;
  settingsPath: string;
  leaderboardPath: string;
  tutorialsPath: string;
  replayError: string | null;
  tutorialInstructions: string | null;
  uiPreferences: UiPreferencesV2;
  dedicatedRoutesEnabled: boolean;
  navigateTo: (path: string) => void;
  patchUiPreferences: (patch: Partial<UiPreferencesV2>) => void;
  mapShape: MapShape;
  onMapShapeChange: (shape: MapShape) => void;
  mapSize: GridSize;
  onMapSizeChange: (size: GridSize) => void;
  onSelectLoadout: (loadout: Loadout) => void;
  onStartRun: (mode: 'normal' | 'daily') => void;
  onLoadScenario: (state: GameState, instructions: string) => void;
  onStartReplay: (record: any) => void;
  onDismissTutorial: () => void;
  onStartGuidedTutorial: () => void;
  tutorialProgress: TutorialProgress;
  activeTutorialSession: TutorialSession | null;
  onResetTutorialProgress: () => void;
  onSkipTutorial: () => void;
  worldgenUiError: WorldgenUiError | null;
  worldgenProgressLabel?: string;
  worldgenStatusLine?: string;
  onDismissWorldgenError: () => void;
  worldgenInitialized: boolean;
  worldgenWarmState: 'idle' | 'warming' | 'ready' | 'error';
  arcadeSplashWaitingForReady: boolean;
  showArcadeDelayedPulse: boolean;
  onEnterArcadeSplash: () => void;
  onOpenHubFromArcadeSplash: () => void;
}) => {
  if (dedicatedRoutesEnabled && isSettingsRoute) {
    return (
      <ScreenTransitionShell motionMode={uiPreferences.motionMode} screenId="settings">
        <Suspense fallback={<AppScreenFallback label="Loading Settings..." />}>
          <LazySettingsScreen
            uiPreferences={uiPreferences}
            onSetColorMode={(colorMode) => patchUiPreferences({ colorMode })}
            onSetMotionMode={(motionMode) => patchUiPreferences({ motionMode })}
            onSetHudDensity={(hudDensity) => patchUiPreferences({ hudDensity })}
            onSetTurnFlowMode={(turnFlowMode) => patchUiPreferences({ turnFlowMode })}
            onSetAudioEnabled={(audioEnabled) => patchUiPreferences({ audioEnabled })}
            onSetHapticsEnabled={(hapticsEnabled) => patchUiPreferences({ hapticsEnabled })}
            onSetVitalsMode={(vitalsMode) => patchUiPreferences({ vitalsMode })}
            onBack={() => navigateTo(hubPath)}
          />
        </Suspense>
      </ScreenTransitionShell>
    );
  }

  if (dedicatedRoutesEnabled && isLeaderboardRoute) {
    return (
      <ScreenTransitionShell motionMode={uiPreferences.motionMode} screenId="leaderboard">
        <Suspense fallback={<AppScreenFallback label="Loading Leaderboard..." />}>
          <LazyLeaderboardScreen
            gameState={gameState}
            onStartReplay={onStartReplay}
            onBack={() => navigateTo(hubPath)}
          />
        </Suspense>
      </ScreenTransitionShell>
    );
  }

  if (dedicatedRoutesEnabled && isTutorialsRoute) {
    return (
      <ScreenTransitionShell motionMode={uiPreferences.motionMode} screenId="tutorials">
        <Suspense fallback={<AppScreenFallback label="Loading Tutorials..." />}>
          <LazyTutorialReplayScreen
            onLoadScenario={onLoadScenario}
            onStartGuidedTutorial={onStartGuidedTutorial}
            tutorialProgress={tutorialProgress}
            onResetTutorialProgress={onResetTutorialProgress}
            onSkipTutorial={onSkipTutorial}
            onBack={() => navigateTo(hubPath)}
          />
        </Suspense>
      </ScreenTransitionShell>
    );
  }

  if (isArcadeRoute) {
    return (
      <>
        <ScreenTransitionShell motionMode={uiPreferences.motionMode} screenId="arcade-home">
          <ArcadeSplashGate
            worldgenInitialized={worldgenInitialized}
            worldgenWarmState={worldgenWarmState}
            waitingForReady={arcadeSplashWaitingForReady}
            showDelayedPulse={showArcadeDelayedPulse}
            statusLine={worldgenStatusLine || worldgenProgressLabel}
            error={worldgenUiError?.message}
            onStartArcade={onEnterArcadeSplash}
            onOpenHub={onOpenHubFromArcadeSplash}
          />
        </ScreenTransitionShell>
        <WorldgenErrorOverlay
          error={worldgenUiError}
          progressLabel={worldgenProgressLabel}
          onDismiss={onDismissWorldgenError}
        />
      </>
    );
  }

  return (
    <>
      <ScreenTransitionShell motionMode={uiPreferences.motionMode} screenId={isHubRoute ? 'hub' : 'hub-shell'}>
        <Suspense fallback={<AppScreenFallback label="Loading Hub..." />}>
          <LazyHubScreen
            gameState={gameState}
            homePath={homePath}
            biomesPath={biomesPath}
            themeLabPath={themeLabPath}
            settingsPath={settingsPath}
            leaderboardPath={leaderboardPath}
            tutorialsPath={tutorialsPath}
            replayError={replayError}
            tutorialInstructions={tutorialInstructions}
            uiPreferences={uiPreferences}
            dedicatedRoutesEnabled={dedicatedRoutesEnabled}
            navigateTo={navigateTo}
            onSetColorMode={(colorMode) => patchUiPreferences({ colorMode })}
            onSetMotionMode={(motionMode) => patchUiPreferences({ motionMode })}
            onSetHudDensity={(hudDensity) => patchUiPreferences({ hudDensity })}
            mapShape={mapShape}
            onMapShapeChange={onMapShapeChange}
            mapSize={mapSize}
            onMapSizeChange={onMapSizeChange}
            onSelectLoadout={onSelectLoadout}
            onStartRun={onStartRun}
            onLoadScenario={onLoadScenario}
            onStartReplay={onStartReplay}
            onDismissTutorial={onDismissTutorial}
          />
        </Suspense>
      </ScreenTransitionShell>
      <WorldgenErrorOverlay
        error={worldgenUiError}
        progressLabel={worldgenProgressLabel}
        onDismiss={onDismissWorldgenError}
      />
      <TutorialOnboardingPrompt
        visible={!activeTutorialSession && shouldPromptForTutorial(tutorialProgress)}
        onStart={onStartGuidedTutorial}
        onSkip={onSkipTutorial}
      />
    </>
  );
};
