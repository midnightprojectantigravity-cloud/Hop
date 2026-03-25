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
  SkillTray: ({
    skills,
    onSelectSkill
  }: {
    skills?: Array<{ id?: string; name?: string }>;
    onSelectSkill?: (skillId: string | null) => void;
  }) => (
    <div data-testid="skill-tray">
      {skills?.map((skill) => (
        <button
          key={skill.id || 'skill'}
          type="button"
          onClick={() => onSelectSkill?.(skill.id || null)}
        >
          {skill.id || 'skill'}
        </button>
      )) || 'skills'}
    </div>
  )
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

vi.mock('../app/AppOverlays', () => ({
  ResolvingTurnOverlay: () => null,
  MobileToastsOverlay: () => null,
  TutorialInstructionsOverlay: () => null,
  RunLostOverlay: () => null,
  RunWonOverlay: () => null,
  FloorIntroOverlay: () => null,
  ReplayControlsOverlay: () => null
}));

vi.mock('../app/WorldgenBoardOverlay', () => ({
  WorldgenBoardOverlay: () => null
}));

vi.mock('../app/WorldgenDebugPanel', () => ({
  WorldgenDebugPanel: () => null
}));

const buildProps = ({ isInputLocked = false }: { isInputLocked?: boolean } = {}): { screen: GameScreenModel } => {
  const gameState = recomputeVisibility({
    ...generateInitialState(1, 'game-screen-mobile-top-hud'),
    enemies: []
  });

  return {
    screen: {
      run: {
        gameState,
        selectedSkillId: null,
        showMovementRange: false,
        isInputLocked,
        isReplayMode: false,
        replayActionsLength: 0,
        replayIndex: 0,
        replayActive: false,
        mobileToasts: [],
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

describe('game screen mobile top hud', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
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
    vi.useRealTimers();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  const renderScreen = async (options?: { isInputLocked?: boolean }) => {
    root = createRoot(container);
    await act(async () => {
      root?.render(<GameScreen {...buildProps(options)} />);
    });
  };

  it('locks the compact header height and opens the tray only on explicit click', async () => {
    await renderScreen();

    const compact = container.querySelector('[data-mobile-top-hud-compact]');
    const chevron = container.querySelector('[data-mobile-top-hud-chevron]') as HTMLButtonElement | null;
    const foldToggle = container.querySelector('[data-mobile-top-hud-fold-toggle]');

    expect(compact).not.toBeNull();
    expect(chevron).not.toBeNull();
    expect(foldToggle).toBe(chevron);
    expect(container.querySelector('[data-mobile-top-hud-tray]')).toBeNull();

    const fixedHeight = compact?.getAttribute('data-mobile-top-hud-fixed-height');
    expect(fixedHeight).toBeTruthy();

    await act(async () => {
      chevron?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      chevron?.dispatchEvent(new Event('touchstart', { bubbles: true }));
      vi.advanceTimersByTime(750);
    });

    expect(container.querySelector('[data-mobile-top-hud-tray]')).toBeNull();

    await act(async () => {
      chevron?.click();
    });

    expect(container.querySelector('[data-mobile-top-hud-tray]')).not.toBeNull();
    expect(compact?.getAttribute('data-mobile-top-hud-fixed-height')).toBe(fixedHeight);
  });

  it('routes INFO to the bottom tray while keeping the compact header in place', async () => {
    await renderScreen();

    const chevron = container.querySelector('[data-mobile-top-hud-chevron]') as HTMLButtonElement | null;
    const infoButton = container.querySelector('[data-mobile-top-hud-info-button]') as HTMLButtonElement | null;

    expect(infoButton).not.toBeNull();

    await act(async () => {
      chevron?.click();
    });
    expect(container.querySelector('[data-mobile-top-hud-tray]')).not.toBeNull();

    await act(async () => {
      infoButton?.click();
    });

    expect(container.querySelector('[data-mobile-top-hud-compact]')).not.toBeNull();
    expect(container.querySelector('[data-mobile-top-hud-tray]')).toBeNull();
    expect(container.querySelector('[data-testid="synapse-bottom-tray"]')).not.toBeNull();
    expect(container.textContent).toContain('Info Settings');
  });

  it('renders the compact vitals strip with hp/mp values, spark bubble, and five exhaustion segments', async () => {
    await renderScreen();

    const hpValue = container.querySelector('[data-mobile-top-hud-hp-value]');
    const mpValue = container.querySelector('[data-mobile-top-hud-mp-value]');
    const sparkBubble = container.querySelector('[data-mobile-top-hud-spark-bubble]');
    const vitalsCore = container.querySelector('[data-mobile-top-hud-vitals-core]');
    const exhaustionSegments = container.querySelectorAll('[data-mobile-top-hud-exhaustion-segment]');

    expect(hpValue?.textContent).toMatch(/^\d+\/\d+$/);
    expect(mpValue?.textContent).toMatch(/^\d+\/\d+$/);
    expect(vitalsCore).not.toBeNull();
    expect(sparkBubble?.textContent).toBe('');
    expect(exhaustionSegments).toHaveLength(5);
  });

  it('collapses the mobile top tray after enabled action buttons and skill selection', async () => {
    await renderScreen();

    const chevron = container.querySelector('[data-mobile-top-hud-chevron]') as HTMLButtonElement | null;

    await act(async () => {
      chevron?.click();
    });
    expect(container.querySelector('[data-mobile-top-hud-tray]')).not.toBeNull();

    const waitButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Rest');
    expect(waitButton).toBeDefined();

    await act(async () => {
      waitButton?.click();
    });
    expect(container.querySelector('[data-mobile-top-hud-tray]')).toBeNull();

    await act(async () => {
      chevron?.click();
    });
    expect(container.querySelector('[data-mobile-top-hud-tray]')).not.toBeNull();

    const skillButton = container.querySelector('[data-testid="skill-tray"] button') as HTMLButtonElement | null;
    expect(skillButton).not.toBeNull();

    await act(async () => {
      skillButton?.click();
    });
    expect(container.querySelector('[data-mobile-top-hud-tray]')).toBeNull();
  });

  it('keeps the tray open for disabled buttons and only collapses hold actions after confirm fires', async () => {
    await renderScreen({ isInputLocked: true });

    const chevron = container.querySelector('[data-mobile-top-hud-chevron]') as HTMLButtonElement | null;

    await act(async () => {
      chevron?.click();
    });
    expect(container.querySelector('[data-mobile-top-hud-tray]')).not.toBeNull();

    const disabledWaitButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Rest') as HTMLButtonElement | undefined;
    expect(disabledWaitButton?.disabled).toBe(true);

    await act(async () => {
      disabledWaitButton?.click();
    });
    expect(container.querySelector('[data-mobile-top-hud-tray]')).not.toBeNull();

    const homeButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Home') as HTMLButtonElement | undefined;
    expect(homeButton).toBeDefined();

    await act(async () => {
      homeButton?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      vi.advanceTimersByTime(500);
    });
    expect(container.querySelector('[data-mobile-top-hud-tray]')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(container.querySelector('[data-mobile-top-hud-tray]')).toBeNull();
  });
});
