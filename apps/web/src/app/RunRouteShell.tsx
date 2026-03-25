import { Suspense } from 'react';
import type { GameState } from '@hop/engine';
import type { GameScreenModel } from './use-game-screen-model';
import type { TutorialSession } from './tutorial/tutorial-state-machine';
import { LazyGameScreen } from './lazy-screens';
import { ScreenTransitionShell } from './screen-transition-shell';
import { TutorialSpotlightMask } from './tutorial/tutorial-spotlight-mask';
import { TutorialStepOverlay } from './tutorial/tutorial-step-overlay';
import { AppScreenFallback, WorldgenErrorOverlay, type WorldgenUiError } from './route-shell-shared';

export const RunRouteShell = ({
  motionMode,
  gameState,
  gameScreenModel,
  activeTutorialStep,
  activeTutorialSession,
  onSkipTutorial,
  worldgenUiError,
  worldgenProgressLabel,
  onDismissWorldgenError,
  onRetryPendingFloor,
  onExitToHub
}: {
  motionMode: 'snappy' | 'reduced';
  gameState: GameState;
  gameScreenModel: GameScreenModel;
  activeTutorialStep: { id: 'movement' | 'attack' | 'wait'; title: string; body: string; allowedActionLabel: string } | null;
  activeTutorialSession: TutorialSession | null;
  onSkipTutorial: () => void;
  worldgenUiError: WorldgenUiError | null;
  worldgenProgressLabel?: string;
  onDismissWorldgenError: () => void;
  onRetryPendingFloor: () => void;
  onExitToHub: () => void;
}) => (
  <>
    <ScreenTransitionShell motionMode={motionMode} screenId="run">
      <Suspense fallback={<AppScreenFallback label="Loading Run..." />}>
        <LazyGameScreen screen={gameScreenModel} />
      </Suspense>
    </ScreenTransitionShell>
    <TutorialSpotlightMask
      visible={Boolean(activeTutorialStep) && gameState.gameStatus === 'playing'}
      stepId={activeTutorialStep?.id || 'movement'}
    />
    <TutorialStepOverlay
      visible={Boolean(activeTutorialStep) && gameState.gameStatus === 'playing'}
      title={activeTutorialStep?.title || ''}
      body={activeTutorialStep?.body || ''}
      allowedActionLabel={activeTutorialStep?.allowedActionLabel || ''}
      stepId={activeTutorialStep?.id || 'movement'}
      stepIndex={activeTutorialSession?.stepIndex || 0}
      totalSteps={activeTutorialSession?.stepIds.length || 3}
      onSkip={onSkipTutorial}
    />
    <WorldgenErrorOverlay
      error={worldgenUiError}
      progressLabel={worldgenProgressLabel}
      onDismiss={onDismissWorldgenError}
      onRetry={worldgenUiError?.kind === 'stairs' ? onRetryPendingFloor : undefined}
      onExitToHub={worldgenUiError?.kind === 'stairs' ? onExitToHub : undefined}
    />
  </>
);
