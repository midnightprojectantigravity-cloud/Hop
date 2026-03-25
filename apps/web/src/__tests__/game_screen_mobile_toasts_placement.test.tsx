// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { generateInitialState, recomputeVisibility } from '@hop/engine';
import { GameScreen } from '../app/GameScreen';
import type { GameScreenModel } from '../app/use-game-screen-model';

vi.mock('../components/GameBoard', () => ({
  GameBoard: () => <div data-testid="game-board">Game Board</div>
}));

vi.mock('../components/UpgradeOverlay', () => ({
  UpgradeOverlay: () => null
}));

vi.mock('../components/SkillTray', () => ({
  SkillTray: () => <div data-testid="skill-tray">Skills</div>
}));

vi.mock('../components/synapse/SynapseBottomTray', () => ({
  SynapseBottomTray: () => <div data-testid="synapse-bottom-tray">Synapse Bottom Tray</div>
}));

vi.mock('../components/ui/ui-log-feed', () => ({
  UiLogFeed: () => <div data-testid="ui-log-feed">Log Feed</div>
}));

vi.mock('../components/ui/ui-status-panel-sections', () => ({
  UiBoardStatsSection: () => <div>Board Stats</div>,
  UiDirectivesSection: () => <div>Directives</div>,
  UiSentinelDirectiveSection: () => <div>Sentinel Directive</div>,
  UiTriResourceHeader: () => <div>Vitals Header</div>,
  getWaitDirectiveLabel: () => 'Rest'
}));

vi.mock('../app/AppOverlays', async () => {
  const actual = await vi.importActual<typeof import('../app/AppOverlays')>('../app/AppOverlays');
  return {
    ...actual,
    ResolvingTurnOverlay: () => null,
    TutorialInstructionsOverlay: () => null,
    RunLostOverlay: () => null,
    RunWonOverlay: () => null,
    FloorIntroOverlay: () => null,
    ReplayControlsOverlay: () => null
  };
});

vi.mock('../app/WorldgenBoardOverlay', () => ({
  WorldgenBoardOverlay: () => null
}));

vi.mock('../app/WorldgenDebugPanel', () => ({
  WorldgenDebugPanel: () => null
}));

const buildProps = (): { screen: GameScreenModel } => {
  const gameState = recomputeVisibility({
    ...generateInitialState(1, 'game-screen-mobile-toasts'),
    enemies: []
  });

  return {
    screen: {
      run: {
        gameState,
        selectedSkillId: null,
        showMovementRange: false,
        isInputLocked: false,
        isReplayMode: false,
        replayActionsLength: 0,
        replayIndex: 0,
        replayActive: false,
        mobileToasts: [{ id: 'toast-1', text: 'Toast moved', tone: 'status', createdAt: 0 }],
        tutorialInstructions: null,
        floorIntro: null,
        assetManifest: null,
        isSynapseMode: false,
        synapseSelection: { mode: 'empty' } as const,
        synapsePulse: null,
        showRunLostOverlay: false
      },
      ui: {
        uiPreferences: {
          colorMode: 'parchment',
          motionMode: 'snappy',
          hudDensity: 'compact',
          mobileLayout: 'portrait_primary',
          turnFlowMode: 'protected_single',
          overdriveUiMode: 'per_turn_arm',
          audioEnabled: true,
          hapticsEnabled: true,
          vitalsMode: 'glance'
        },
        turnFlowMode: 'protected_single',
        overdriveArmed: false,
        replayMarkerIndices: [],
        mobileDockV2Enabled: true,
        replayChronicleEnabled: false,
        strictTargetPathParityV1Enabled: false
      },
      actions: {
        onSetBoardBusy: vi.fn(),
        onTileClick: vi.fn(),
        onSimulationEvents: vi.fn(),
        onMirrorSnapshot: vi.fn(),
        onReset: vi.fn(),
        onWait: vi.fn(),
        onExitToHub: vi.fn(),
        onSelectSkill: vi.fn(),
        onSelectUpgrade: vi.fn(),
        onToggleSynapseMode: vi.fn(),
        onSynapseInspectEntity: vi.fn(),
        onSynapseSelectSource: vi.fn(),
        onSynapseClearSelection: vi.fn(),
        onDismissTutorial: vi.fn(),
        onToggleReplay: vi.fn(),
        onStepReplay: vi.fn(),
        onJumpReplay: vi.fn(),
        onCloseReplay: vi.fn(),
        onQuickRestart: vi.fn(),
        onViewReplay: vi.fn(),
        onRunLostActionsReady: vi.fn(),
        onSetColorMode: vi.fn(),
        onSetVitalsMode: vi.fn(),
        onToggleOverdrive: vi.fn()
      }
    }
  };
};

const setMobileViewport = () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 844 });
};

describe('game screen mobile toasts placement', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    setMobileViewport();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('anchors mobile toasts inside the board region at the bottom-right', async () => {
    root = createRoot(container);

    await act(async () => {
      root?.render(<GameScreen {...buildProps()} />);
    });

    const overlay = container.querySelector('[data-mobile-toasts-overlay]') as HTMLDivElement | null;

    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain('Toast moved');
    expect(overlay?.closest('main')).not.toBeNull();
    expect(overlay?.className).toContain('absolute');
    expect(overlay?.className).toContain('bottom-3');
    expect(overlay?.className).toContain('right-3');
    expect(overlay?.className).toContain('items-end');
    expect(overlay?.className).toContain('lg:hidden');
    expect(overlay?.className).not.toContain('fixed');
    expect(overlay?.className).not.toContain('top-16');
    expect(overlay?.className).not.toContain('-translate-x-1/2');
  });
});
