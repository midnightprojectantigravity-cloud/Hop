import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateInitialState, recomputeVisibility } from '@hop/engine';
import { GameScreen } from '../app/GameScreen';
import type { GameScreenModel } from '../app/use-game-screen-model';

const renderWithMobileViewport = (element: ReactElement): string => {
  const globalWithWindow = globalThis as typeof globalThis & { window: any };
  const previousWindow = globalWithWindow.window;
  globalWithWindow.window = {
    innerWidth: 390,
    innerHeight: 844,
    location: { search: '' } as Location,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    return renderToStaticMarkup(element);
  } finally {
    globalWithWindow.window = previousWindow;
  }
};

const buildProps = (isSynapseMode: boolean, mobileDockV2Enabled = true): { screen: GameScreenModel } => {
  const gameState = recomputeVisibility({
    ...generateInitialState(1, `game-screen-info-mode-${isSynapseMode ? 'on' : 'off'}`),
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
        mobileToasts: [],
        tutorialInstructions: null,
        floorIntro: null,
        assetManifest: null,
        isSynapseMode,
        synapseSelection: { mode: 'empty' } as const,
        synapsePulse: null,
        showRunLostOverlay: false,
      },
      ui: {
        uiPreferences: {
          colorMode: 'parchment' as const,
          motionMode: 'snappy' as const,
          hudDensity: 'compact' as const,
          mobileLayout: 'portrait_primary' as const,
          turnFlowMode: 'protected_single' as const,
          overdriveUiMode: 'per_turn_arm' as const,
          audioEnabled: true,
          hapticsEnabled: true,
          vitalsMode: 'glance' as const
        },
        turnFlowMode: 'protected_single' as const,
        overdriveArmed: false,
        replayMarkerIndices: [],
        mobileDockV2Enabled,
        replayChronicleEnabled: false
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
        onToggleOverdrive: vi.fn(),
      }
    },
  };
};

describe('game screen info mode layout', () => {
  it('shows the streamlined mobile top and bottom HUD when info mode is off', () => {
    const html = renderWithMobileViewport(<GameScreen {...buildProps(false)} />);

    expect(html).toContain('data-mobile-top-hud');
    expect(html).toContain('data-mobile-top-hud-info-button');
    expect(html).toContain('data-mobile-top-hud-chevron');
    expect(html).toContain('data-mobile-top-hud-fold-toggle');
    expect(html).toContain('Floor');
    expect(html).toContain('INFO');
    expect(html).not.toContain('Toggle vitals details');
    expect(html).toContain('Rest');
    expect(html).toContain('Home');
    expect(html).toContain('Override');
    expect(html).toContain('Spear Throw');
    expect(html).toContain('Shield Bash');
  });

  it('keeps legacy controls on the non-v2 mobile dock', () => {
    const html = renderWithMobileViewport(<GameScreen {...buildProps(false, false)} />);

    expect(html).toContain('Rest');
    expect(html).toContain('Home');
    expect(html).toContain('Reset');
    expect(html).toContain('Travel Mode');
  });

  it('shows the compact top rail in mobile dock v2 with the locked fixed-height surface', () => {
    const html = renderWithMobileViewport(<GameScreen {...buildProps(false, true)} />);

    expect(html).toContain('data-mobile-top-hud-fixed-height');
    expect(html).toContain('data-mobile-top-hud-vitals-core');
    expect(html).toContain('data-mobile-top-hud-spark-bubble');
    expect(html).toContain('aria-label="Spark reserve');
    expect(html).not.toContain('Toggle vitals details');
    expect(html.match(/data-mobile-top-hud-exhaustion-segment/g)?.length).toBe(5);
    expect(html).not.toContain('Pinch: zoom focus');
  });

  it('hides bottom actions and shows info settings when info mode is on', () => {
    const html = renderToStaticMarkup(<GameScreen {...buildProps(true)} />);

    expect(html).toContain('Info Settings');
    expect(html).not.toContain('Future Settings');
    expect(html).not.toContain('Intel controls moved to Settings');
    expect(html).not.toContain('>Force<');
    expect(html).not.toContain('>Strict<');
    expect(html).toContain('Info');
  });

  it('renders the cleaned desktop sidebars with stats, directives, and tactical skills', () => {
    const html = renderToStaticMarkup(<GameScreen {...buildProps(false)} />);

    expect(html).toContain('Theme');
    expect(html).toContain('Enemy Alert');
    expect(html).toContain('Core');
    expect(html).toContain('Derived');
    expect(html).toContain('Tactical Log');
    expect(html).toContain('Override Status');
    expect(html).toContain('Directives');
    expect(html).toContain('Tactical Skills');
    expect(html.indexOf('Override Status')).toBeLessThan(html.indexOf('Tactical Skills'));
    expect(html).not.toContain('Hoplite');
    expect(html).not.toContain('Tactical Arena');
    expect(html).not.toContain('Ruleset');
    expect(html).not.toContain('Hop Engine v5.0');
  });

  it('removes user-facing Synapse labels from gameplay controls', () => {
    const offHtml = renderToStaticMarkup(<GameScreen {...buildProps(false)} />);
    const onHtml = renderToStaticMarkup(<GameScreen {...buildProps(true)} />);

    expect(offHtml).not.toContain('>Synapse<');
    expect(offHtml).not.toContain('Synapse (I)');
    expect(onHtml).not.toContain('>Synapse<');
    expect(onHtml).not.toContain('Synapse (I)');
  });
});
