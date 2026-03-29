import { useCallback, useMemo, useState } from 'react';
import type { Action, GameState } from '@hop/engine';
import {
  advanceTutorialSession,
  createTutorialSession,
  getActiveTutorialStepId,
  readTutorialOnboardingState,
  readTutorialProgress,
  writeTutorialOnboardingState,
  resetTutorialProgress,
  writeTutorialProgress,
  type TutorialOnboardingState,
  type TutorialProgress,
  type TutorialSession,
  type TutorialStepId
} from './tutorial/tutorial-state-machine';
import { getGuidedTutorialStep } from './tutorial/tutorial-scenarios';

export interface TutorialSessionController {
  tutorialOnboardingState: TutorialOnboardingState;
  tutorialProgress: TutorialProgress;
  activeTutorialSession: TutorialSession | null;
  activeTutorialStepId: TutorialStepId | null;
  activeTutorialStep: ReturnType<typeof getGuidedTutorialStep> | null;
  tutorialInstructions: string | null;
  startGuidedTutorial: () => void;
  dismissTutorialOnboarding: () => void;
  finishGuidedTutorialStep: (stepId: 'movement' | 'attack' | 'wait') => void;
  skipGuidedTutorial: () => void;
  resetGuidedTutorialProgress: () => void;
  dismissTutorialInstructions: () => void;
  showTutorialInstructions: (instructions: string | null) => void;
}

export const useTutorialSession = ({
  gameStatus,
  homePath,
  navigateTo,
  dispatchWithTrace
}: {
  gameStatus: GameState['gameStatus'];
  homePath: string;
  navigateTo: (path: string) => void;
  dispatchWithTrace: (action: Action, source: string) => void;
}): TutorialSessionController => {
  const [tutorialInstructions, setTutorialInstructions] = useState<string | null>(null);
  const [tutorialOnboardingState, setTutorialOnboardingState] = useState<TutorialOnboardingState>(
    () => readTutorialOnboardingState()
  );
  const [tutorialProgress, setTutorialProgress] = useState<TutorialProgress>(() => readTutorialProgress());
  const [activeTutorialSession, setActiveTutorialSession] = useState<TutorialSession | null>(null);

  const activeTutorialStepId = getActiveTutorialStepId(activeTutorialSession);
  const activeTutorialStep = useMemo(
    () => (activeTutorialStepId ? getGuidedTutorialStep(activeTutorialStepId) : null),
    [activeTutorialStepId]
  );

  const dismissTutorialOnboarding = useCallback(() => {
    const dismissedOnboarding = writeTutorialOnboardingState({ dismissed: true });
    setTutorialOnboardingState(dismissedOnboarding);
  }, []);

  const startGuidedTutorial = useCallback(() => {
    dismissTutorialOnboarding();
    const session = createTutorialSession();
    const firstStep = getGuidedTutorialStep(session.stepIds[0]);
    setActiveTutorialSession(session);
    setTutorialInstructions(firstStep.body);
    dispatchWithTrace({ type: 'LOAD_STATE', payload: firstStep.state }, 'guided_tutorial_start');
  }, [dispatchWithTrace, dismissTutorialOnboarding]);

  const finishGuidedTutorialStep = useCallback((stepId: 'movement' | 'attack' | 'wait') => {
    const pendingProgress = writeTutorialProgress({
      completed: false,
      skipped: false,
      lastStepId: stepId
    });
    setTutorialProgress(pendingProgress);

    setActiveTutorialSession((current) => {
      if (!current) return current;
      const nextSession = advanceTutorialSession(current);
      if (!nextSession) {
        const completedProgress = writeTutorialProgress({
          completed: true,
          skipped: false,
          lastStepId: stepId
        });
        setTutorialProgress(completedProgress);
        setTutorialInstructions('Tutorial complete. You can relaunch it anytime from Tutorials.');
        return null;
      }
      const nextStep = getGuidedTutorialStep(nextSession.stepIds[nextSession.stepIndex]);
      setTutorialInstructions(nextStep.body);
      dispatchWithTrace({ type: 'LOAD_STATE', payload: nextStep.state }, 'guided_tutorial_advance');
      return nextSession;
    });
  }, [dispatchWithTrace]);

  const skipGuidedTutorial = useCallback(() => {
    dismissTutorialOnboarding();
    const skipped = writeTutorialProgress({
      completed: false,
      skipped: true,
      lastStepId: tutorialProgress.lastStepId
    });
    setTutorialProgress(skipped);
    setActiveTutorialSession(null);
    setTutorialInstructions(null);
    if (gameStatus !== 'hub') {
      dispatchWithTrace({ type: 'EXIT_TO_HUB' }, 'guided_tutorial_skip');
      navigateTo(homePath);
    }
  }, [dismissTutorialOnboarding, dispatchWithTrace, gameStatus, homePath, navigateTo, tutorialProgress.lastStepId]);

  const resetGuidedTutorialProgress = useCallback(() => {
    setTutorialProgress(resetTutorialProgress());
  }, []);

  const dismissTutorialInstructions = useCallback(() => {
    setTutorialInstructions(null);
  }, []);

  const showTutorialInstructions = useCallback((instructions: string | null) => {
    setTutorialInstructions(instructions);
  }, []);

  return {
    tutorialOnboardingState,
    tutorialProgress,
    activeTutorialSession,
    activeTutorialStepId,
    activeTutorialStep,
    tutorialInstructions,
    startGuidedTutorial,
    dismissTutorialOnboarding,
    finishGuidedTutorialStep,
    skipGuidedTutorial,
    resetGuidedTutorialProgress,
    dismissTutorialInstructions,
    showTutorialInstructions
  };
};
