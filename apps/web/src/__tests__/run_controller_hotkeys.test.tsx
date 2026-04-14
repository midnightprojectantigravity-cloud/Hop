// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '@hop/engine';
import { useRunController } from '../app/use-run-controller';

const buildGameState = (): GameState => ({
  gameStatus: 'playing',
  gridWidth: 8,
  gridHeight: 8,
  mapShape: 'square',
  dailyRunDate: null,
  selectedLoadoutId: 'test-loadout',
  player: {
    id: 'player',
    position: { q: 0, r: 0, s: 0 },
    hp: 10,
    archetype: 'VANGUARD',
    ires: null,
  },
} as unknown as GameState);

describe('run controller hotkeys', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
    vi.restoreAllMocks();
  });

  it('wires S, R, and H to the visible run directives', async () => {
    const dispatchWithTrace = vi.fn();
    const dispatchPlayerActionWithTurnPolicy = vi.fn();
    const dispatchSensory = vi.fn();
    const navigateTo = vi.fn();
    const resetReplayUi = vi.fn();
    const startRun = vi.fn().mockResolvedValue(undefined);
    const setSelectedSkillId = vi.fn();
    const setShowMovementRange = vi.fn();
    const setRunLostOverlayDelayElapsed = vi.fn();
    const setPendingAutoEnd = vi.fn();
    const setOverdriveState = vi.fn();
    const setIsSynapseMode = vi.fn();
    const setSynapseSelection = vi.fn();
    const setSynapsePulse = vi.fn();
    const setIsBusy = vi.fn();
    const setReplayActive = vi.fn();
    const stepReplay = vi.fn();
    const goToReplayIndex = vi.fn();
    const startReplay = vi.fn();
    const armPostCommitLock = vi.fn();
    const toggleOverdrive = vi.fn();
    const finishGuidedTutorialStep = vi.fn();
    const dismissTutorialInstructions = vi.fn();
    const showTutorialInstructions = vi.fn();

    function Harness() {
      useRunController({
        gameState: buildGameState(),
        isReplayMode: false,
        isInputLocked: false,
        isBusy: false,
        replayActive: false,
        setReplayActive,
        stepReplay,
        goToReplayIndex,
        resetReplayUi,
        startReplay,
        dispatchWithTrace,
        dispatchPlayerActionWithTurnPolicy,
        armPostCommitLock,
        dispatchSensory,
        navigateTo,
        homePath: '/hub',
        defeatLoopV2Enabled: false,
        runResumeContext: null,
        setRunResumeContext: vi.fn(),
        startRun,
        activeTutorialStepId: null,
        finishGuidedTutorialStep,
        dismissTutorialInstructions,
        showTutorialInstructions,
        selectedSkillId: null,
        setSelectedSkillId,
        showMovementRange: false,
        setShowMovementRange,
        setRunLostOverlayDelayElapsed,
        runLostOverlayDelayElapsed: false,
        setPendingAutoEnd,
        setOverdriveState,
        isSynapseMode: false,
        setIsSynapseMode,
        setSynapseSelection,
        setSynapsePulse,
        setIsBusy,
        toggleOverdrive,
      });
      return null;
    }

    await act(async () => {
      root?.render(<Harness />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
    });

    expect(dispatchWithTrace).toHaveBeenCalledWith({ type: 'WAIT' }, 'player_wait');
    expect(armPostCommitLock).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    });

    expect(dispatchWithTrace).toHaveBeenCalledWith({ type: 'RESET' }, 'reset');
    expect(resetReplayUi).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH' }));
    });

    expect(dispatchWithTrace).toHaveBeenCalledWith({ type: 'EXIT_TO_HUB' }, 'exit_to_hub');
    expect(navigateTo).toHaveBeenCalledWith('/hub');
  });
});
