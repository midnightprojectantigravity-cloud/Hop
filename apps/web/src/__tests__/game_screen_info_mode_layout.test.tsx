import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateInitialState } from '@hop/engine';
import { GameScreen } from '../app/GameScreen';

const buildProps = (isSynapseMode: boolean) => {
  const gameState = generateInitialState(1, `game-screen-info-mode-${isSynapseMode ? 'on' : 'off'}`);
  return {
    gameState,
    uiPreferences: {
      colorMode: 'parchment' as const,
      motionMode: 'snappy' as const,
      hudDensity: 'compact' as const,
      mobileLayout: 'portrait_primary' as const
    },
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
    replayMarkerIndices: [],
    onCloseReplay: vi.fn(),
    onQuickRestart: vi.fn(),
    onViewReplay: vi.fn(),
    onRunLostActionsReady: vi.fn(),
    onSetColorMode: vi.fn(),
    mobileDockV2Enabled: false,
    replayChronicleEnabled: false
  };
};

describe('game screen info mode layout', () => {
  it('shows bottom actions and skills tray when info mode is off', () => {
    const html = renderToStaticMarkup(<GameScreen {...buildProps(false)} />);

    expect(html).toContain('Wait');
    expect(html).toContain('Hub');
    expect(html).toContain('Reset');
    expect(html).toContain('Skills');
  });

  it('hides bottom actions and shows info settings when info mode is on', () => {
    const html = renderToStaticMarkup(<GameScreen {...buildProps(true)} />);

    expect(html).not.toContain('>Wait<');
    expect(html).not.toContain('>Hub<');
    expect(html).not.toContain('>Reset<');
    expect(html).toContain('Info Settings');
    expect(html).not.toContain('Future Settings');
    expect(html).not.toContain('Intel controls moved to Settings');
    expect(html).not.toContain('>Force<');
    expect(html).not.toContain('>Strict<');
    expect(html).toContain('Info');
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
