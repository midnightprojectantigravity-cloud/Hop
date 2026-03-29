export type TutorialStepId = 'movement' | 'attack' | 'wait';

export type TutorialProgress = {
  completed: boolean;
  skipped: boolean;
  lastStepId: TutorialStepId | null;
};

export type TutorialSession = {
  tutorialId: 'first_run';
  stepIds: TutorialStepId[];
  stepIndex: number;
};

export const TUTORIAL_PROGRESS_STORAGE_KEY = 'hop_tutorial_progress_v1';
export const TUTORIAL_ONBOARDING_STORAGE_KEY = 'hop_tutorial_onboarding_v1';

const DEFAULT_TUTORIAL_PROGRESS: TutorialProgress = {
  completed: false,
  skipped: false,
  lastStepId: null
};

export type TutorialOnboardingState = {
  dismissed: boolean;
};

const DEFAULT_TUTORIAL_ONBOARDING_STATE: TutorialOnboardingState = {
  dismissed: false
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const getBrowserStorage = (): StorageLike | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

export const readTutorialProgress = (storage: StorageLike | null = getBrowserStorage()): TutorialProgress => {
  if (!storage) return { ...DEFAULT_TUTORIAL_PROGRESS };
  try {
    const raw = storage.getItem(TUTORIAL_PROGRESS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TUTORIAL_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<TutorialProgress>;
    return {
      completed: parsed.completed === true,
      skipped: parsed.skipped === true,
      lastStepId:
        parsed.lastStepId === 'movement' || parsed.lastStepId === 'attack' || parsed.lastStepId === 'wait'
          ? parsed.lastStepId
          : null
    };
  } catch {
    return { ...DEFAULT_TUTORIAL_PROGRESS };
  }
};

export const writeTutorialProgress = (
  progress: TutorialProgress,
  storage: StorageLike | null = getBrowserStorage()
): TutorialProgress => {
  if (storage) {
    storage.setItem(TUTORIAL_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  }
  return progress;
};

export const resetTutorialProgress = (storage: StorageLike | null = getBrowserStorage()): TutorialProgress => {
  if (storage) {
    storage.removeItem(TUTORIAL_PROGRESS_STORAGE_KEY);
  }
  return { ...DEFAULT_TUTORIAL_PROGRESS };
};

export const readTutorialOnboardingState = (
  storage: StorageLike | null = getBrowserStorage()
): TutorialOnboardingState => {
  if (!storage) return { ...DEFAULT_TUTORIAL_ONBOARDING_STATE };
  try {
    const raw = storage.getItem(TUTORIAL_ONBOARDING_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TUTORIAL_ONBOARDING_STATE };
    const parsed = JSON.parse(raw) as Partial<TutorialOnboardingState>;
    return {
      dismissed: parsed.dismissed === true
    };
  } catch {
    return { ...DEFAULT_TUTORIAL_ONBOARDING_STATE };
  }
};

export const writeTutorialOnboardingState = (
  onboardingState: TutorialOnboardingState,
  storage: StorageLike | null = getBrowserStorage()
): TutorialOnboardingState => {
  if (storage) {
    storage.setItem(TUTORIAL_ONBOARDING_STORAGE_KEY, JSON.stringify(onboardingState));
  }
  return onboardingState;
};

export const resetTutorialOnboardingState = (
  storage: StorageLike | null = getBrowserStorage()
): TutorialOnboardingState => {
  if (storage) {
    storage.removeItem(TUTORIAL_ONBOARDING_STORAGE_KEY);
  }
  return { ...DEFAULT_TUTORIAL_ONBOARDING_STATE };
};

export const createTutorialSession = (): TutorialSession => ({
  tutorialId: 'first_run',
  stepIds: ['movement', 'attack', 'wait'],
  stepIndex: 0
});

export const getActiveTutorialStepId = (session: TutorialSession | null): TutorialStepId | null => {
  if (!session) return null;
  return session.stepIds[session.stepIndex] ?? null;
};

export const advanceTutorialSession = (session: TutorialSession): TutorialSession | null => {
  const nextIndex = session.stepIndex + 1;
  if (nextIndex >= session.stepIds.length) return null;
  return {
    ...session,
    stepIndex: nextIndex
  };
};

export const shouldPromptForTutorial = (progress: TutorialProgress): boolean =>
  !progress.completed && !progress.skipped;

export const shouldShowTutorialOnboarding = (
  progress: TutorialProgress,
  onboardingState: TutorialOnboardingState
): boolean =>
  !onboardingState.dismissed
  && !progress.completed
  && !progress.skipped
  && progress.lastStepId === null;
